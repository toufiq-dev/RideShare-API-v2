import { LocationType } from 'src/common/types/location.type';

export interface RideRequestPayload {
  userId: string;
  bookingId: string;
  estimatedFare: any;
  vehicleTypeId: string;
  distanceKm: number;
  durationMin: number;
  pickupLocation: LocationType;
  dropLocation: LocationType;
}

export interface NotifyDriverPayload {
  pilotId: string;
  userId: string;
  bookingId: string;
  vehicleTypeId: string;
  pickupLocation: LocationType;
  dropLocation: LocationType;
  estimatedFare: any;
  nearestPilotDistance: number;
  distanceKm: number;
  durationMin: number;
  server: any;
}
