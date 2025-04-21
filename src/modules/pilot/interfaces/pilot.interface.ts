import { BookingStatus, VehicleTypeName } from '@prisma/client';
import { JsonValue } from '@prisma/client/runtime/library';

export interface VerificationResponseDL {
  licenseNumber: string;
  dateOfBirth: Date;
  nameOnLicense: string;
  dateOfIssue: Date;
  validUntill: Date;
}

export interface VerificationResponseVehicle {
  category?: VehicleTypeName;
  regNo?: string;
  regUpto?: Date;
  permitUpto?: any;
  status?: string;
  manufacturer?: string;
  model?: string;
  colour?: string;
  seatCapacity?: string;
  state?: string;
  fitUpto?: Date;
  puccUpto?: Date;
  insuranceUpto?: Date;
  verificationFailed: boolean;
}

export interface OtherPassengerInfo {
  name: string;
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
