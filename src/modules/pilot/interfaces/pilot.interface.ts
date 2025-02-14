export interface VerificationResponseDL {
  licenseNumber: string;
  dateOfBirth: Date;
  nameOnLicense: string;
  dateOfIssue: Date;
  validUntill: Date;
}

export interface VerificationResponseVehicle {
  isrcExpired: boolean;
  ispermitExpired: boolean;
  regNo: string;
  regUpto: Date;
  permitUpto: Date;
  status: string;
  manufacturer: string;
  model: string;
  colour: string;
  state: string;
  fitUpto: Date;
  puccUpto: Date;
  insuranceUpto: Date;
}
