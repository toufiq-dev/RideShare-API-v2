import { ApiProperty } from '@nestjs/swagger';
import {
  AppPlatform,
  VehicleTypeBD,
  VehicleTypeNameBD,
  VerificationStatus,
} from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEmail,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

export class LoginDto {
  @ApiProperty({ description: 'Email credentials' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ description: 'Password credentials' })
  @IsString()
  @IsNotEmpty()
  password: string;
}

export class CreateAdminDto extends LoginDto {}

export class VerifyEmailDto {
  @ApiProperty({ description: 'Email of the admin' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ description: 'Otp sent in the email' })
  @IsString()
  @IsNotEmpty()
  otp: string;
}

export class CreateSupportRoleDto {
  @ApiProperty({ description: 'Name of the user role' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ description: 'Description of the user role' })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiProperty({ description: 'Support permission ids' })
  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty()
  supportPermissionIds?: string[];
}

export enum DocumentType {
  SELFIE = 'SELFIE',
  DRIVING_LICENSE = 'DRIVING_LICENSE',
  NID = 'NID',
  REGISTRATION_CERTIFICATE = 'REGISTRATION_CERTIFICATE',
  NUMBER_PLATE = 'NUMBER_PLATE',
  TAX_TOKEN = 'TAX_TOKEN',
  VEHICLE_OWNERS_NID = 'VEHICLE_OWNERS_NID',
  POLICE_CLEARANCE = 'POLICE_CLEARANCE',
}

export class GetDriverDocumentDto {
  @ApiProperty({ description: 'Document type' })
  @IsString()
  @IsNotEmpty()
  documentType: DocumentType;
}

export class VerifyDriverDto {
  @ApiProperty({ description: 'Verification status' })
  @IsString()
  @IsNotEmpty()
  verificationStatus: VerificationStatus;

  @ApiProperty({ description: 'Verification document' })
  @IsString()
  @IsNotEmpty()
  verificationDocument: DocumentType;

  @ApiProperty({
    description: 'Rejection reason (required if status is REJECTED)',
    required: false,
  })
  @IsString()
  @ValidateIf((o) => o.verificationStatus === VerificationStatus.REJECTED)
  @IsNotEmpty({
    message: 'Rejection reason is required when status is REJECTED',
  })
  rejectionReason?: string;

  // Additional fields for comprehensive updates
  @ApiProperty({
    description: 'Name from document (for NID, DL, etc.)',
    required: false,
  })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiProperty({
    description: 'Date of birth from document',
    required: false,
  })
  @IsDateString()
  @IsOptional()
  dateOfBirth?: string;

  @ApiProperty({
    description: 'Document number (NID number, License number, etc.)',
    required: false,
  })
  @IsString()
  @IsOptional()
  documentNumber?: string;

  @ApiProperty({
    description: 'Vehicle registration number',
    required: false,
  })
  @IsString()
  @IsOptional()
  vehicleRegNo?: string;

  @ApiProperty({
    description: 'Vehicle type',
    required: false,
  })
  @IsString()
  @IsOptional()
  vehicleType?: VehicleTypeNameBD;

  @ApiProperty({
    description: 'Vehicle color',
    required: false,
  })
  @IsString()
  @IsOptional()
  vehicleColor?: string;

  @ApiProperty({
    description: 'Vehicle model',
    required: false,
  })
  @IsString()
  @IsOptional()
  vehicleModel?: string;

  @ApiProperty({
    description: 'Vehicle seat capacity',
    required: false,
  })
  @IsOptional()
  seatCapacity?: number;

  @ApiProperty({
    description: 'Document expiry date',
    required: false,
  })
  @IsDateString()
  @IsOptional()
  expiryDate?: string;

  @ApiProperty({
    description: 'Document issue date',
    required: false,
  })
  @IsDateString()
  @IsOptional()
  issueDate?: string;
}

export class AppUpdateDto {
  @ApiProperty({ description: 'App version' })
  @IsNumber()
  @IsOptional()
  adDriverVersion: number;

  @ApiProperty({ description: 'App version' })
  @IsNumber()
  @IsOptional()
  adCustomerVersion: number;

  @ApiProperty({ description: 'App version' })
  @IsString()
  @IsOptional()
  iosCustomerVersion: string;

  @ApiProperty({ description: 'App description' })
  @IsString()
  @IsNotEmpty()
  appDescription: AppPlatform;
}

export class CreateSubscriptionTypeDto {
  @ApiProperty({ description: 'Name of the subscription type' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ description: 'Coins for the subscription' })
  @IsNotEmpty()
  @IsNumber()
  coins: number;

  @ApiProperty({ description: 'Price of the subscription' })
  @IsNumber()
  @IsNotEmpty()
  price: string;

  @ApiProperty({ description: 'Price of the subscription brfore discount' })
  @IsNumber()
  @IsOptional()
  priceBeforeDiscount?: string;
}

export class UpdateSubscriptionTypeDto {
  @ApiProperty({ description: 'Name of the subscription type' })
  @IsString()
  @IsOptional()
  name: string;

  @ApiProperty({ description: 'Coins for the subscription' })
  @IsOptional()
  @IsNumber()
  coins: number;

  @ApiProperty({ description: 'Price of the subscription' })
  @IsNumber()
  @IsNotEmpty()
  price: string;

  @ApiProperty({ description: 'Price of the subscription brfore discount' })
  @IsNumber()
  @IsOptional()
  priceBeforeDiscount?: string;
}

export class CreateSupportStuffDto {
  @ApiProperty({ description: 'Name of the support stuff' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ description: 'Email of the support stuff' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ description: 'Password of the support stuff' })
  @IsString()
  @IsNotEmpty()
  password: string;

  @ApiProperty({ description: 'Phone number of the support stuff' })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiProperty({ description: 'Support role id' })
  @IsString()
  @IsNotEmpty()
  supportRoleId: string;
}

export class PromoterDetailsDto {
  @ApiProperty({ description: 'Promoter name', required: false })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiProperty({ description: 'Promoter address', required: false })
  @IsString()
  @IsOptional()
  address?: string;

  @ApiProperty({ description: 'Promoter blood group', required: false })
  @IsString()
  @IsOptional()
  bloodGroup?: string;
}
