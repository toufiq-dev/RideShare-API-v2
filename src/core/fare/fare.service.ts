import { Injectable, BadRequestException } from '@nestjs/common';
import { Client, DirectionsRequest, TravelMode } from '@googlemaps/google-maps-services-js';
import { ConfigService } from '@nestjs/config';
@Injectable()
export class FareService {
  private gmaps: Client;
  private readonly apiKey: string

  constructor(private onfigService: ConfigService) {
    this.gmaps = new Client({});
    this.apiKey = this.onfigService.get<string>('googleMaps.apiKey');
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
        throw new BadRequestException('No route found between the specified locations.');
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
      throw new BadRequestException('Failed to calculate distance and duration');
    }
  }

  estimateFare(distanceKm: number, durationMin: number): {
    baseFare: number;
    perKmRate: number;
    perMinRate: number;
    distanceKm: number;
    durationMin: number;
    fare: number;
  } {
    const baseFare = 50; // INR
    const perKmRate = 15; // INR per km
    const perMinRate = 2; // INR per minute

    const fare = baseFare + perKmRate * distanceKm + perMinRate * durationMin;

    return {
      baseFare,
      perKmRate,
      perMinRate,
      distanceKm: parseFloat(distanceKm.toFixed(2)),
      durationMin: parseFloat(durationMin.toFixed(2)),
      fare: parseFloat(fare.toFixed(2)),
    };
  }
}