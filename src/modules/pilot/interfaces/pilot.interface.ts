export interface VerificationResponseDL {
  licenseNumber: string;
  dateOfBirth: Date;
  nameOnLicense: string;
  dateOfIssue: Date;
  validUntill: Date;
}

export interface VerificationResponseVehicle {
  regNo: string;
  status: string;
  insuranceUpto: Date;
  manufacturer: string;
  makerModel: string;
  vehicleColour: string;
  fitUpto: Date;
  puccUpto: Date;
  rcExpiryDate: Date;
  permitUpto?: Date | null;
  vehicleState: string;
  vehicleSeatingCapacity: number;
  vehicleClass: string;
}
