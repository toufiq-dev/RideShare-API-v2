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
