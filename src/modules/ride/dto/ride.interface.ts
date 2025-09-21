import { BookingStatus, VehicleTypeNameBD } from '@prisma/client';
import { Decimal, JsonValue } from '@prisma/client/runtime/library';

interface Coupon {
  id: string;
  name: string;
  discount: Decimal;
  validUntil: Date | null;
}

export interface Location {
  lat: number;
  lng: number;
  name?: string;
  address?: string;
}

export interface RideRequestPayload {
  userId: string;
  bookingId: string;
  estimatedFare: any;
  discountedFare: any;
  vehicleTypeId: string;
  distanceKm: number;
  durationMin: number;
  pickupLocation: any;
  dropLocation: any;
}

export interface NotifyDriverPayload {
  pilotUserId: string;
  bookingId: string;
  vehicleTypeId: string;
  pickupLocation: any;
  dropLocation: any;
  estimatedFare: any;
  nearestPilotDistance: number;
  distanceKm: number;
  durationMin: number;
  // server: any;
}

export interface OtherPassengerInfo {
  name: string;
}

export interface CustomerRidePayload {
  bookingCode: string;
  bookingId: string;
  bookingStatus: BookingStatus;
  estimatedDuration: number;
  tripStart: Date | null;
  vehicleType: VehicleTypeNameBD;
  vehicleTypeId: string;
  pilot: {
    pilotId: string;
    pilotName: string;
    profilePicture: string;
    pilotPhone: string;
    rating: number;
    pilotLocation: any;
    vehicleNumber: string;
    model: string;
    colour: string;
    vehicleType: VehicleTypeNameBD;
  } | null;
  passenger: {
    passengerId: string;
    name: string;
    phone: string;
    rating: number;
  };
  pickupInMinutes: number | null;
  pickupLocation: JsonValue;
  dropLocation: JsonValue;
  fairDetails: {
    originalFare: number;
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
