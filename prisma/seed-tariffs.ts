// prisma/seed-tariffs.ts
import { PrismaClient, Prisma, VehicleTypeNameBD } from '@prisma/client';
import * as fs from 'node:fs';
import * as path from 'node:path';

const prisma = new PrismaClient();
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
  const seedPath = process.env.TARIFF_SEED_PATH || path.join(process.cwd(), 'artifacts', 'tariff_seed.json');
  const mapPath  = process.env.SERVICE_MAP_PATH || path.join(process.cwd(), 'artifacts', 'service_map.json');

  const rows: SeedRow[] = JSON.parse(fs.readFileSync(seedPath, 'utf-8'));
  const serviceMap = JSON.parse(fs.readFileSync(mapPath,  'utf-8')) as Record<string, VehicleTypeNameBD>;

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
    const data: Prisma.TariffCreateInput = {
      city: r.city || CITY,
      intercity: r.intercity,
      vehicleTypeBD: { connect: { id: vt.id } },
      baseFare: new Prisma.Decimal(r.baseFare),
      perKmRate: new Prisma.Decimal(r.perKmRate),
      perMinRate: new Prisma.Decimal(r.perMinRate),
      minFare: new Prisma.Decimal(r.minFare),
      insuranceFee: new Prisma.Decimal(r.insuranceFee),
      pickupFee: r.pickupActive ? new Prisma.Decimal(r.pickupFee ?? 0) : null,
      pickupActive: r.pickupActive,
      version: 1, // or bump if you re-seed and want versioning
      effectiveFrom,
      effectiveTo: null,
      isActive: true,
    };

    // If you want versioning, first inactivate previous active tariffs for (city, svc, intercity)
    await prisma.tariff.updateMany({
      where: {
        city: data.city,
        intercity: data.intercity,
        vehicleTypeBDId: vt.id,
        isActive: true,
      },
      data: { isActive: false, effectiveTo: effectiveFrom },
    });

    await prisma.tariff.create({ data });
    upserts++;
  }

  console.log(`Upserted ${upserts} tariffs`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
}).finally(async () => {
  await prisma.$disconnect();
});
