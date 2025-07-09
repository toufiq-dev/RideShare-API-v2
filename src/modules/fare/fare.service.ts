import { Injectable, BadRequestException } from '@nestjs/common';
import {
  Client,
  DirectionsRequest,
  TravelMode,
} from '@googlemaps/google-maps-services-js';
import { ConfigService } from '@nestjs/config';
import { UpdateFareDto } from './dto/fare.dto';
import { PrismaService } from 'src/core/database/prisma.service';
import { VehicleTypeNameBD } from '@prisma/client';
@Injectable()
export class FareService {
  private gmaps: Client;
  private readonly apiKey: string;
  private readonly aPlus: number;
  private readonly bPlus: number;
  private readonly cPlus: number;

  constructor(
    private configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.gmaps = new Client({});
    this.apiKey = this.configService.get<string>('googleMaps.apiKey');
    this.aPlus = this.configService.get<number>('pricing.aPlus');
    this.bPlus = this.configService.get<number>('pricing.bPlus');
    this.cPlus = this.configService.get<number>('pricing.cPlus');
  }

  async updateFare(updateFareDto: UpdateFareDto) {
    const { vehicleType, baseFare, perKmRate, perMinRate } = updateFareDto;

    try {
      const data = await this.prisma.vehicleTypeBD.update({
        where: { name: vehicleType as VehicleTypeNameBD },
        data: {
          baseFare,
          perKmRate,
          perMinRate,
        },
      });

      return {
        message: 'Fare updated successfully',
        data,
      };
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  async calculateDistanceAndDuration(
    origin: { lat: number; lng: number },
    destination: { lat: number; lng: number },
  ): Promise<{ distanceKm: number; durationMin: number }> {
    const request: DirectionsRequest = {
      params: {
        origin,
        destination,
        mode: TravelMode.driving,
        departure_time: 'now',
        key: this.apiKey,
      },
    };

    try {
      const response = await this.gmaps.directions(request);
      if (!response.data.routes.length) {
        throw new BadRequestException(
          'No route found between the specified locations.',
        );
      }

      const leg = response.data.routes[0].legs[0];
      const distanceMeters = leg.distance.value; // in meters
      const durationSeconds = leg.duration.value; // in seconds

      return {
        distanceKm: distanceMeters / 1000, // Convert to km
        durationMin: durationSeconds / 60, // Convert to minutes
      };
    } catch (error) {
      console.error(error);
      throw new BadRequestException(
        'Failed to calculate distance and duration',
      );
    }
  }

  estimateFare(
    distanceKm: number,
    durationMin: number,
    baseFare: number,
    perMinRate: number,
    minFare: number,
    vehicleType: VehicleTypeNameBD,
    perKmFare?: number,
  ): number {
    let perKmRate: number = 0;

    if (vehicleType === VehicleTypeNameBD.FAIR_PLUS) {
      perKmRate = this.calculatePerKmFare(distanceKm, vehicleType);
    } else {
      perKmRate = perKmFare;
    }

    return Math.ceil(
      Math.max(
        (baseFare + perKmRate * distanceKm + perMinRate * durationMin) * 0.95,
        minFare,
      ),
    );
  }

  private calculatePerKmFare(
    distanceKm: number,
    vehicleType: VehicleTypeNameBD,
  ): number {
    const a = this.aPlus;
    const b = this.bPlus;
    const c = this.cPlus;

    // Per-km fare for this distance
    const perKmFare = a * Math.exp(-b * distanceKm) + c;

    // round to 2 decimal places
    return Math.round(perKmFare * 100) / 100;
  }
}
