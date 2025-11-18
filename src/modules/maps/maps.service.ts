import { HttpService } from '@nestjs/axios';
import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DirectionsDto, TravelMode } from './dto/directions.dto';
import { firstValueFrom } from 'rxjs';
import { ReverseGeocodingDto } from './dto/geocoding.dto';
import { AutocompleteDto } from './dto/autocomplete.dto';
import { PlaceDetailsDto } from './dto/place-details.dto';

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

  /**
   * Reverse geocoding - convert coordinates to address
   */
  async reverseGeocode(geocodingDto: ReverseGeocodingDto) {
    const { latlng, language } = geocodingDto;

    try {
      const params = new URLSearchParams({
        latlng,
        language: language || 'en',
        key: this.apiKey,
      });

      const url = `${this.baseUrl}/geocode/json?${params.toString()}`;
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
        `Failed to reverse geocode: ${error.message || 'Unknown error'}`,
      );
    }
  }

  /**
   * Get place autocomplete suggestions
   */
  async getAutocomplete(autocompleteDto: AutocompleteDto) {
    const { input, components, language } = autocompleteDto;

    try {
      const params = new URLSearchParams({
        input: encodeURIComponent(input),
        components,
        language,
        key: this.apiKey,
      });

      const url = `${this.baseUrl}/place/autocomplete/json?${params.toString()}`;
      const response = await firstValueFrom(this.httpService.get(url));

      if (
        response.data.status === 'OK' ||
        response.data.status === 'ZERO_RESULTS'
      ) {
        return response.data;
      } else {
        throw new BadRequestException(
          `Google Maps API error: ${response.data.status} - ${response.data.error_message || 'Unknown error'}`,
        );
      }
    } catch (error) {
      throw new BadRequestException(
        `Failed to get autocomplete suggestions: ${error.message || 'Unknown error'}`,
      );
    }
  }

  /**
   * Get place details by place ID
   */
  async getPlaceDetails(placeDetailsDto: PlaceDetailsDto) {
    const { place_id, language } = placeDetailsDto;

    try {
      const params = new URLSearchParams({
        place_id,
        language,
        key: this.apiKey,
      });

      const url = `${this.baseUrl}/place/details/json?${params.toString()}`;
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
        `Failed to get place details: ${error.message || 'Unknown error'}`,
      );
    }
  }
}
