import { Injectable, BadRequestException } from '@nestjs/common';
import {
  Client,
  DirectionsRequest,
  TravelMode,
} from '@googlemaps/google-maps-services-js';
import { ConfigService } from '@nestjs/config';
import { UpdateFareDto } from './dto/fare.dto';
import { PrismaService } from 'src/core/database/prisma.service';
@Injectable()
export class FareService {
  private gmaps: Client;
  private readonly apiKey: string;

  constructor(
    private configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.gmaps = new Client({});
    this.apiKey = this.configService.get<string>('googleMaps.apiKey');
  }

  async updateFare(updateFareDto: UpdateFareDto) {
    const { vehicleType, baseFare, perKmRate, perMinRate } = updateFareDto;

    try {
      const data = await this.prisma.vehicleType.update({
        where: { name: vehicleType },
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
    perKmRate: number,
    perMinRate: number,
  ): number {
    return baseFare + perKmRate * distanceKm + perMinRate * durationMin;
  }
}
