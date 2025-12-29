import { Injectable } from '@nestjs/common';
import { Tariff, VehicleTypeNameBD } from '@prisma/client';
import { PrismaService } from 'src/core/database/database.service';

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
    serviceName: VehicleTypeNameBD, // FAIR_BIKE, FAIR_PLUS
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
      // STRONG OPTION: hard fail so you notice missing tariff
      throw new Error(`No active Tariff for ${city}/${serviceName}}`);
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

  async computeDetourRatio(
    poly: string | undefined,
    pickup: any,
    drop: any,
  ): Promise<number | undefined> {
    try {
      if (!poly) return undefined;

      // Calculate straight-line distance (Haversine formula)
      const straightLineDistance = this.calculateHaversineDistance(
        pickup.lat,
        pickup.lng,
        drop.lat,
        drop.lng,
      );

      // Calculate route distance from polyline
      const routeDistance = this.calculatePolylineDistance(poly);

      // Avoid division by zero
      if (straightLineDistance < 0.001) return undefined;

      // Return detour ratio (route distance / straight line distance)
      const detourRatio = routeDistance / straightLineDistance;

      // Return undefined if ratio is invalid (too high or too low)
      if (detourRatio < 1.0 || detourRatio > 3.0) return undefined;

      return detourRatio;
    } catch (error) {
      console.error('Error calculating detour ratio:', error);
      return undefined;
    }
  }

  private calculateHaversineDistance(
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number,
  ): number {
    const R = 6371; // Earth's radius in kilometers
    const dLat = this.toRadians(lat2 - lat1);
    const dLng = this.toRadians(lng2 - lng1);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(lat1)) *
        Math.cos(this.toRadians(lat2)) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private calculatePolylineDistance(polyline: string): number {
    // Decode polyline and calculate total distance
    const points = this.decodePolyline(polyline);
    let totalDistance = 0;

    for (let i = 0; i < points.length - 1; i++) {
      totalDistance += this.calculateHaversineDistance(
        points[i].lat,
        points[i].lng,
        points[i + 1].lat,
        points[i + 1].lng,
      );
    }

    return totalDistance;
  }

  private decodePolyline(encoded: string): Array<{ lat: number; lng: number }> {
    const points = [];
    let index = 0;
    let lat = 0;
    let lng = 0;

    while (index < encoded.length) {
      let b,
        shift = 0,
        result = 0;
      do {
        b = encoded.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);

      const dlat = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
      lat += dlat;

      shift = 0;
      result = 0;
      do {
        b = encoded.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);

      const dlng = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
      lng += dlng;

      points.push({
        lat: lat / 1e5,
        lng: lng / 1e5,
      });
    }

    return points;
  }

  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }
}
