export interface VerificationResponseDL {
  licenseNumber: string;
  dateOfBirth: Date;
  nameOnLicense: string;
  dateOfIssue: Date;
  validUntill: Date;
}

export interface VerificationResponseVehicle {
  category?: string;
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
