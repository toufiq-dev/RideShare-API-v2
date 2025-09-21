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
import { MultiplierService } from '../pricing/multiplier.service';
import { TariffService } from '../pricing/tariff.service';
import { h3Cell } from 'src/core/utils/h3.util';

@Injectable()
export class FareService {
  private gmaps: Client;
  private readonly apiKey: string;
  private readonly CITY: string;
  private readonly MU_MAX: number;
  private readonly MU_MIN: number;

  constructor(
    private configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly tariffService: TariffService,
    private readonly multService: MultiplierService,
  ) {
    this.gmaps = new Client({});
    this.apiKey = this.configService.get<string>('googleMaps.apiKey');
    this.CITY = this.configService.get<string>('pricing.city');
    this.MU_MAX = this.configService.get<number>('pricing.MU_MAX');
    this.MU_MIN = this.configService.get<number>('pricing.MU_MIN');
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
  ): Promise<{
    distanceKm: number;
    durationMin: number;
    routePolyline: string;
  }> {
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

      const route = response.data.routes[0];
      const leg = route.legs[0];
      const distanceMeters = leg.distance.value; // in meters
      const durationSeconds = leg.duration.value; // in seconds

      // Get the encoded polyline
      const routePolyline = route.overview_polyline.points;

      return {
        distanceKm: distanceMeters / 1000, // Convert to km
        durationMin: durationSeconds / 60, // Convert to minutes
        routePolyline,
      };
    } catch (error) {
      console.error(error);
      throw new BadRequestException(
        'Failed to calculate distance and duration',
      );
    }
  }

  async calculateTariffBasedFare(params: {
    pickupLocation: { lat: number; lng: number };
    dropLocation: { lat: number; lng: number };
    vehicleTypeName: VehicleTypeNameBD;
    customerCoupon?: { discount: number } | null;
    intercity?: boolean;
  }): Promise<{
    originalPrice: number;
    discountedPrice: number;
    finalPrice: number;
    distanceKm: number;
    durationMin: number;
    routePolyline: string;
    surgeMultiplier: number;
    tariff: any;
  }> {
    const {
      pickupLocation,
      dropLocation,
      vehicleTypeName,
      customerCoupon,
      intercity = false,
    } = params;

    try {
      // Calculate distance and duration
      const distanceData = await this.calculateDistanceAndDuration(
        pickupLocation,
        dropLocation,
      );
      const { distanceKm, durationMin, routePolyline } = distanceData;

      // Get H3 cell and current hour for surge calculation
      const h3 = h3Cell(pickupLocation.lat, pickupLocation.lng, 8);
      const hour = new Date().getHours();

      // Get active tariff
      const tariff = await this.tariffService.getActiveTariff(
        this.CITY,
        vehicleTypeName,
        intercity,
      );

      // Calculate baseline price
      const baseline = this.tariffService.computeB(
        this.tariffService.toBaseline(tariff),
        distanceKm,
        durationMin,
      );

      // Calculate detour ratio
      const detourRatio = await this.tariffService.computeDetourRatio(
        routePolyline,
        pickupLocation,
        dropLocation,
      );

      // Get base surge multiplier
      const muBase = await this.multService.getMu(this.CITY, h3, hour);

      // Apply surge adjustments
      let surgeMultiplier = this.multService.applyAdjustments(
        muBase,
        vehicleTypeName,
        distanceKm,
        detourRatio,
      );

      // Clamp surge multiplier within bounds
      surgeMultiplier = Math.min(
        this.MU_MAX,
        Math.max(this.MU_MIN, surgeMultiplier),
      );

      // Calculate raw price with surge
      const originalPrice = Math.round(baseline * surgeMultiplier);

      // Apply coupon discount
      const discount = customerCoupon?.discount
        ? Number(customerCoupon.discount)
        : 0;
      const discountedPrice =
        discount && originalPrice > discount
          ? originalPrice - discount
          : originalPrice;

      // Apply minimum fare constraint
      const finalPrice = Math.max(discountedPrice, Number(tariff.minFare));

      return {
        originalPrice,
        discountedPrice,
        finalPrice,
        distanceKm,
        durationMin,
        routePolyline,
        surgeMultiplier,
        tariff,
      };
    } catch (error) {
      console.error('Error in calculateTariffBasedFare:', error);
      throw new BadRequestException('Failed to calculate fare');
    }
  }

  async calculateMultipleVehicleFares(params: {
    pickupLocation: { lat: number; lng: number };
    dropLocation: { lat: number; lng: number };
    vehicleTypes: Array<{
      id: string;
      name: VehicleTypeNameBD;
      airCondition: string[];
      isFaster: boolean;
      passengerCapacity: number;
    }>;
    customerCoupon?: { discount: number } | null;
    intercity?: boolean;
  }): Promise<
    Array<{
      id: string;
      vehicleType: VehicleTypeNameBD;
      airCondition: string[];
      isFaster: boolean;
      passengerCapacity: number;
      originalPrice: number;
      price: number;
      tolls: number;
      timeAway: string;
    }>
  > {
    const {
      pickupLocation,
      dropLocation,
      vehicleTypes,
      customerCoupon,
      intercity = false,
    } = params;

    try {
      // Calculate distance and duration once
      const distanceData = await this.calculateDistanceAndDuration(
        pickupLocation,
        dropLocation,
      );
      const { distanceKm, durationMin, routePolyline } = distanceData;

      // Get H3 cell and current hour for surge calculation
      const h3 = h3Cell(pickupLocation.lat, pickupLocation.lng, 8);
      const hour = new Date().getHours();

      // Calculate detour ratio once
      const detourRatio = await this.tariffService.computeDetourRatio(
        routePolyline,
        pickupLocation,
        dropLocation,
      );

      // Get base surge multiplier
      const muBase = await this.multService.getMu(this.CITY, h3, hour);

      const results = [];

      for (const vehicleType of vehicleTypes) {
        try {
          // Get active tariff for this vehicle type
          const tariff = await this.tariffService.getActiveTariff(
            this.CITY,
            vehicleType.name,
            intercity,
          );

          // Calculate baseline price
          const baseline = this.tariffService.computeB(
            this.tariffService.toBaseline(tariff),
            distanceKm,
            durationMin,
          );

          // Apply surge adjustments
          let surgeMultiplier = this.multService.applyAdjustments(
            muBase,
            vehicleType.name,
            distanceKm,
            detourRatio,
          );

          // Clamp surge multiplier within bounds
          surgeMultiplier = Math.min(
            this.MU_MAX,
            Math.max(this.MU_MIN, surgeMultiplier),
          );

          // Calculate raw price with surge
          const originalPrice = Math.round(baseline * surgeMultiplier);

          // Apply coupon discount
          const discount = customerCoupon?.discount
            ? Number(customerCoupon.discount)
            : 0;
          const discountedPrice =
            discount && originalPrice > discount
              ? originalPrice - discount
              : originalPrice;

          // Apply minimum fare constraint
          const finalPrice = Math.max(discountedPrice, Number(tariff.minFare));

          results.push({
            id: vehicleType.id,
            vehicleType: vehicleType.name,
            airCondition: vehicleType.airCondition,
            isFaster: vehicleType.isFaster,
            passengerCapacity: vehicleType.passengerCapacity,
            originalPrice,
            price: finalPrice,
            tolls: 0.0,
            timeAway: `${Math.floor(Math.random() * 5) + 1} min away`, // You can implement proper time calculation
          });
        } catch (error) {
          console.error(
            `Error calculating fare for vehicle type ${vehicleType.name}:`,
            error,
          );
          // Skip this vehicle type if there's an error
          continue;
        }
      }

      return results;
    } catch (error) {
      console.error('Error in calculateMultipleVehicleFares:', error);
      throw new BadRequestException('Failed to calculate vehicle fares');
    }
  }
}
