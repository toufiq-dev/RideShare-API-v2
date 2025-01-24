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
  makerModel: string;
  vehicleColour: string;
  fitUpto: Date;
  puccUpto: Date;
  type: string;
}
