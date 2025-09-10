import { Injectable } from '@nestjs/common';
import { Tariff, VehicleTypeNameBD } from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma.service';

type Baseline = {
  baseFare: number;
  perKm: number;
  perMin: number;
  minFare: number;
  insuranceFee: number;
  pickupFee: number;
  pickupActive?: boolean;
  version: number;
};

@Injectable()
export class TariffService {
  constructor(private prisma: PrismaService) {}

  async getActiveTariff(
    city: string,
    serviceName: VehicleTypeNameBD, // FAIR_BIKE, FAIR_PLUS, ...
    intercity: boolean,
    when: Date = new Date(),
  ): Promise<Tariff> {
    const vt = await this.prisma.vehicleTypeBD.findUnique({
      where: { name: serviceName },
    });
    if (!vt) {
      throw new Error(`Unknown VehicleTypeBD: ${serviceName}`);
    }

    const t = await this.prisma.tariff.findFirst({
      where: {
        vehicleTypeBDId: vt.id,
        city,
        intercity,
        isActive: true,
        effectiveFrom: { lte: when },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: when } }],
      },
      orderBy: [{ version: 'desc' }, { effectiveFrom: 'desc' }],
    });

    if (!t) {
      // Optional: fall back to VehicleTypeBD as a last resort
      return {
        id: 'fallback',
        city,
        intercity,
        vehicleTypeBDId: vt.id,
        baseFare: vt.baseFare,
        perKmRate: vt.perKmRate,
        perMinRate: vt.perMinRate,
        minFare: vt.minFare,
        insuranceFee: vt.insuranceFee,
        pickupFee: null,
        pickupActive: false,
        version: 1,
        effectiveFrom: when,
        effectiveTo: null,
        isActive: true,
        createdAt: when,
        updatedAt: when,
        vehicleTypeBD: null as any, // ignored
      } as unknown as Tariff;
    }

    return t;
  }

  toBaseline(t: Tariff) {
    return {
      baseFare: Number(t.baseFare),
      perKm: Number(t.perKmRate),
      perMin: Number(t.perMinRate),
      minFare: Number(t.minFare),
      insuranceFee: t.insuranceFee ? Number(t.insuranceFee) : 0,
      pickupFee: t.pickupActive ? Number(t.pickupFee ?? 0) : 0,
      version: t.version,
    };
  }

  computeB(b: Baseline, distKm: number, durMin: number): number {
    const naive =
      b.baseFare +
      b.perKm * distKm +
      b.perMin * durMin +
      b.insuranceFee +
      b.pickupFee;
    return Math.max(b.minFare, naive);
  }
}
