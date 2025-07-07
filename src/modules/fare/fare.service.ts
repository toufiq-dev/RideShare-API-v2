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
  private readonly a: number;
  private readonly b: number;
  private readonly c: number;

  constructor(
    private configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.gmaps = new Client({});
    this.apiKey = this.configService.get<string>('googleMaps.apiKey');
    this.a = this.configService.get<number>('pricing.a');
    this.b = this.configService.get<number>('pricing.b');
    this.c = this.configService.get<number>('pricing.c');
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
  ): number {
    const perKmRate = this.calculatePerKmFare(distanceKm);

    return Math.ceil(
      Math.max(
        baseFare + perKmRate * distanceKm + perMinRate * durationMin,
        minFare,
      ),
    );
  }

  private calculatePerKmFare(distanceKm: number): number {
    // Per-km fare for this distance
    const perKmFare = this.a * Math.exp(-this.b * distanceKm) + this.c;
    // Optionally, round to 2 decimal places
    return Math.round(perKmFare * 100) / 100;
  }
}
