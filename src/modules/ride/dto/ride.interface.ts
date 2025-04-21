import { BookingStatus } from '@prisma/client';
import { JsonValue } from '@prisma/client/runtime/library';

export interface RideRequestPayload {
  userId: string;
  bookingId: string;
  estimatedFare: any;
  vehicleTypeId: string;
  distanceKm: number;
  durationMin: number;
  pickupLocation: any;
  dropLocation: any;
}

export interface NotifyDriverPayload {
  pilotId: string;
  userId: string;
  bookingId: string;
  vehicleTypeId: string;
  pickupLocation: any;
  dropLocation: any;
  estimatedFare: any;
  nearestPilotDistance: number;
  distanceKm: number;
  durationMin: number;
}

export interface OtherPassengerInfo {
  name: string;
}

export interface CustomerRidePayload {
  bookingCode: string;
  bookingId: string;
  bookingStatus: BookingStatus;
  estimatedDuration: number;
  pilot: {
    pilotName: string;
    profilePicture: string;
    pilotPhone: string;
    rating: number;
    pilotLocation: any;
    vehicleNumber: string;
    model: string;
    colour: string;
    vehicleType: string;
  };
  pickupInMinutes: number | null;
  pickupLocation: JsonValue;
  dropLocation: JsonValue;
  fairDetails: {
    origialFare: number;
    discountedFare: number;
    coupon: any;
  };
  otherPassengerInfo: OtherPassengerInfo | null;
}

export interface PilotRideResponse {
  customerName: string;
  customerPhone: string;
  averageRating: number;
  pickupLocation: any;
  dropLocation: any;
  rideStatus: BookingStatus;
  bookingId: string;
  fare: number;
  otherPassengerInfo: OtherPassengerInfo | null;
}
