import { BookingStatus, VehicleTypeName } from '@prisma/client';

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

export interface AcceptRideRequest {
  customerName: string;
  customerPhone: string;
  averageRating: number;
  pickupLocation: any;
  dropLocation: any;
  rideStatus: BookingStatus;
  bookingId: string;
  fare: number;
}

export interface CustomerRideAcceptedEventPayload {
  bookingCode: string;
  bookingId: string;
  pilot: {
    pilotName: string;
    profilePicture: string;
    pilotPhone: string;
    rating: number;
    vehicleNumber: string;
    model: string;
    colour: string;
    vehicleType: string;
  };
  pickupInMinutes: number;
  pickupLocation: any;
  dropLocation: any;
  fairDetails: {
    origialFare: number;
    discountedFare: number;
    coupon: any;
  };
}
