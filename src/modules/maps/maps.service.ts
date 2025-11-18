import { HttpService } from '@nestjs/axios';
import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DirectionsDto, TravelMode } from './dto/directions.dto';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class MapsService {
  private readonly apiKey: string;
  private readonly baseUrl = 'https://maps.googleapis.com/maps/api';

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
  ) {
    this.apiKey = this.configService.get<string>('googleMaps.apiKey');
    if (!this.apiKey) {
      throw new Error('Google Maps API key is not configured');
    }
  }

  /**
   * Get directions between two points
   */
  async getDirections(directionsDto: DirectionsDto) {
    const { origin, destination, mode, waypoints } = directionsDto;

    try {
      const params = new URLSearchParams({
        origin,
        destination,
        mode: mode || TravelMode.DRIVING,
        key: this.apiKey,
      });

      if (waypoints) {
        params.append('waypoints', waypoints);
      }

      const url = `${this.baseUrl}/directions/json?${params.toString()}`;
      const response = await firstValueFrom(this.httpService.get(url));

      if (response.data.status === 'OK') {
        return response.data;
      } else {
        throw new BadRequestException(
          `Google Maps API error: ${response.data.status} - ${response.data.error_message || 'Unknown error'}`,
        );
      }
    } catch (error) {
      throw new BadRequestException(
        `Google Maps API error: ${error.message || 'Unknown error'}`,
      );
    }
  }
}
