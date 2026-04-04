import { PrismaClient, VehicleTypeNameBD } from '@prisma/client';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

if (!process.env.DATABASE_URL) {
  try {
    const envPath = path.resolve(process.cwd(), '.env');
    const raw = fs.readFileSync(envPath, 'utf8');
    raw.split(/\r?\n/).forEach((line) => {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
      if (!m) return;
      let val = m[2].trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (process.env[m[1]] === undefined) process.env[m[1]] = val;
    });
  } catch {
    // ignore
  }
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
const CITY = process.env.CITY || 'dhaka';

type SeedRow = {
  city: string;
  service_name: string;
  intercity: boolean;
  baseFare: number;
  perKmRate: number;
  perMinRate: number;
  minFare: number;
  insuranceFee: number;
  pickupActive: boolean;
  pickupFee: number;
  effectiveFromEpoch: number;
};

async function main() {
  const seedPath = path.join(process.cwd(), 'artifacts', 'tariff_seed.json');
  const mapPath = path.join(process.cwd(), 'artifacts', 'service_map.json');

  const rows: SeedRow[] = JSON.parse(fs.readFileSync(seedPath, 'utf-8'));
  const serviceMap = JSON.parse(fs.readFileSync(mapPath, 'utf-8')) as Record<string, VehicleTypeNameBD>;

  let upserts = 0;

  for (const r of rows) {
    const svcEnum = serviceMap[r.service_name];
    if (!svcEnum) {
      console.warn(`No VehicleTypeNameBD mapping for ${r.service_name}, skipping`);
      continue;
    }
    
    const vt = await prisma.vehicleTypeBD.findUnique({ where: { name: svcEnum } });
    if (!vt) {
      console.warn(`vehicleTypeBD not found for enum ${svcEnum}, skipping`);
      continue;
    }

    const effectiveFrom = new Date((r.effectiveFromEpoch || Date.now()) * 1000);
    
    // Inactivate previous active tariffs for this service
    await prisma.tariff.updateMany({
      where: {
        city: r.city || CITY,
        intercity: r.intercity,
        vehicleTypeBDId: vt.id,
        isActive: true,
      },
      data: { isActive: false, effectiveTo: effectiveFrom },
    });

    // Create new tariff
    await prisma.tariff.create({
      data: {
        city: r.city || CITY,
        intercity: r.intercity,
        vehicleTypeBDId: vt.id,
        baseFare: r.baseFare,
        perKmRate: r.perKmRate,
        perMinRate: r.perMinRate,
        minFare: r.minFare,
        insuranceFee: r.insuranceFee,
        pickupFee: r.pickupActive ? r.pickupFee : null,
        pickupActive: r.pickupActive,
        version: 1,
        effectiveFrom,
        effectiveTo: null,
        isActive: true,
      },
    });
    
    upserts++;
  }

  console.log(`Upserted ${upserts} tariffs`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
}).finally(async () => {
  await prisma.$disconnect();
  await pool.end();
});