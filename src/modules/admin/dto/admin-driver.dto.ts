import { ApiProperty, OmitType, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  ValidateNested,
  ValidateIf,
} from 'class-validator';
import { IsNumberString } from 'class-validator';
import { IsEnum } from 'class-validator';
import { DocumentType } from './admin.dto';
import { VerificationStatus } from '@prisma/client';

export enum FilterDriverSortOptions {
  CREATED_AT = 'createdAt',
  UPDATED_AT = 'updatedAt',
  NAME = 'name',
  MOST_DOCUMENTS_UPLOADED = 'mostDocumentsUploaded',
  LEAST_DOCUMENTS_UPLOADED = 'leastDocumentsUploaded',
}

export enum FilterDriverSortOrderOptions {
  ASC = 'asc',
  DESC = 'desc',
}

export enum FilterDriverStatusOptions {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  IN_REVIEW = 'IN_REVIEW',
  ONBOARDING = 'ONBOARDING',
}

export class FilterDriverDto {
  @ApiProperty({
    type: Number,
    description: 'Limit the number of results',
    default: 10,
    required: false,
  })
  @IsOptional()
  @IsNumberString()
  readonly pageSize: number = 10;

  @ApiProperty({
    type: Number,
    description: 'The page number',
    default: 1,
    required: false,
  })
  @IsOptional()
  @IsNumberString()
  readonly page: number = 1;

  @ApiProperty({
    type: 'string',
    description: Object.values(FilterDriverSortOptions).join('/'),
    required: false,
    example: FilterDriverSortOptions.CREATED_AT,
  })
  @IsOptional()
  @IsEnum(FilterDriverSortOptions)
  readonly sortBy = FilterDriverSortOptions.CREATED_AT;

  @ApiProperty({
    type: 'string',
    description: Object.values(FilterDriverSortOrderOptions).join('/'),
    required: false,
    example: FilterDriverSortOrderOptions.ASC,
  })
  @IsOptional()
  @IsEnum(FilterDriverSortOrderOptions)
  readonly sortOrder = FilterDriverSortOrderOptions.ASC;

  @ApiProperty({
    type: String,
    description: 'The vehicle type id',
    required: false,
    example: '',
  })
  @IsOptional()
  @IsUUID()
  readonly vehicleTypeId!: string;

  // @ApiProperty({
  //     type: Array,
  //     description: 'The fields to include in the response',
  //     required: false,
  //     example: ['id', 'name', 'phone', 'createdAt', 'updatedAt'],
  // })
  // @IsOptional()
  // @IsArray()
  // @IsString({ each: true })
  // readonly fields: string[] = [];

  @ApiProperty({
    type: String,
    description: 'The search term',
    required: false,
    example: '',
  })
  @IsOptional()
  @IsString()
  readonly search!: string;

  @ApiProperty({
    type: 'string',
    description: Object.values(FilterDriverStatusOptions).join('/'),
    required: false,
    example: FilterDriverStatusOptions.ACTIVE,
  })
  @IsOptional()
  @IsEnum(FilterDriverStatusOptions)
  readonly status = FilterDriverStatusOptions.ACTIVE;

  @ApiProperty({
    type: 'string',
    description: 'The start date',
    required: false,
    example: '',
  })
  @IsOptional()
  @IsDateString()
  readonly startDate!: string;

  @ApiProperty({
    type: 'string',
    description: 'The end date',
    required: false,
    example: '',
  })
  @IsOptional()
  @IsDateString()
  readonly endDate!: string;

  @ApiProperty({
    type: 'string',
    description: 'The start date',
    required: false,
    example: '',
  })
  @IsOptional()
  @IsDateString()
  readonly updatedStartDate!: string;

  @ApiProperty({
    type: 'string',
    description: 'The end date',
    required: false,
    example: '',
  })
  @IsOptional()
  @IsDateString()
  readonly updatedEndDate!: string;

  @ApiProperty({
    type: 'string',
    description: 'The verification status',
    required: false,
    example: VerificationStatus.PENDING,
  })
  @IsOptional()
  @IsEnum(VerificationStatus)
  readonly verificationStatus!: VerificationStatus;
}

export class UpdateProfileImageDto {
  @ApiProperty({
    type: String,
    description: 'The driver id',
    required: true,
    example: 'c389a85c-fbf6-4b22-a4d0-0c4ab441a5d9',
  })
  @IsNotEmpty()
  @IsUUID()
  readonly pilotId!: string;

  @ApiProperty({
    type: String,
    description: 'The selfie url',
    required: true,
    example: 'https://example.com/selfie.jpg',
  })
  @IsString()
  @IsNotEmpty()
  @IsUrl()
  readonly selfieUrl!: string;
}

export class UpdateDrivingLicenseDto {
  @ApiProperty({
    type: String,
    description: 'The pilot id',
    example: 'c389a85c-fbf6-4b22-a4d0-0c4ab441a5d9',
    required: true,
  })
  @IsNotEmpty({
    message: 'Pilot id is required',
  })
  @IsUUID()
  readonly pilotId!: string;

  @ApiProperty({
    type: 'string',
    description: 'Driving license front side image',
    example: 'https://example.com/dl-front-side.jpg',
  })
  @IsNotEmpty({
    message: 'Driving license front side image is required',
  })
  @IsUrl()
  readonly dlFrontSideUrl?: string;

  @ApiProperty({
    type: 'string',
    description: 'Driving license back side image',
    example: 'https://example.com/dl-back-side.jpg',
  })
  @IsNotEmpty({
    message: 'Driving license back side image is required',
  })
  @IsUrl()
  readonly dlBackSideUrl?: string;

  @ApiProperty({
    type: String,
    description: 'Name on driving license',
    example: 'John Doe',
  })
  @IsNotEmpty({
    message: 'Name on driving license is required',
  })
  @IsString()
  readonly nameOnLicense!: string;

  @ApiProperty({
    type: 'string',
    description: 'Date of birth',
    example: '1990-01-15',
  })
  @IsNotEmpty({
    message: 'Date of birth is required',
  })
  @IsDateString()
  readonly dateOfBirth!: string;

  @ApiProperty({
    type: String,
    description: 'Driving license number',
    example: 'DL1234567890',
  })
  @IsNotEmpty({
    message: 'Driving license number is required',
  })
  @IsString()
  readonly licenseNumber!: string;

  @ApiProperty({
    type: 'string',
    description: 'License expiry date',
    example: '2025-12-31',
  })
  @IsNotEmpty({
    message: 'License expiry date is required',
  })
  @IsDateString()
  readonly validUntill!: string;
}

export class UpdateNidDto {
  @ApiProperty({
    type: String,
    description: 'The pilot id',
    example: 'c389a85c-fbf6-4b22-a4d0-0c4ab441a5d9',
    required: true,
  })
  @IsNotEmpty({
    message: 'Pilot id is required',
  })
  @IsUUID()
  readonly pilotId!: string;

  @ApiProperty({
    type: 'string',
    description: 'NID front side image',
    example: 'https://example.com/nid-front-side.jpg',
  })
  @IsNotEmpty({
    message: 'NID front side image is required',
  })
  @IsUrl()
  nidFrontSideUrl?: string;

  @ApiProperty({
    type: 'string',
    description: 'NID back side image',
    example: 'https://example.com/nid-back-side.jpg',
  })
  @IsNotEmpty({
    message: 'NID back side image is required',
  })
  @IsUrl()
  nidBackSideUrl?: string;

  @ApiProperty({
    type: String,
    description: 'Name on NID',
    example: 'John Doe',
  })
  @IsNotEmpty({
    message: 'Name on NID is required',
  })
  @IsString()
  readonly name!: string;

  @ApiProperty({
    type: 'string',
    description: 'Date of birth',
    example: '1990-01-15',
  })
  @IsNotEmpty({
    message: 'Date of birth is required',
  })
  @IsDateString()
  readonly dateOfBirth!: string;

  @ApiProperty({
    type: String,
    description: 'NID number',
    example: '1234567890123',
  })
  @IsNotEmpty({
    message: 'NID number is required',
  })
  @IsString()
  readonly nidNumber!: string;
}

export class UpdateRegistrationCardDto {
  @ApiProperty({
    type: String,
    description: 'The pilot id',
    example: 'c389a85c-fbf6-4b22-a4d0-0c4ab441a5d9',
    required: true,
  })
  @IsNotEmpty({
    message: 'Pilot id is required',
  })
  @IsUUID()
  readonly pilotId!: string;

  @ApiProperty({
    type: String,
    description: 'Registration card front side image',
    example: 'https://example.com/rc-front-side.jpg',
  })
  @IsNotEmpty({
    message: 'Registration card front side image is required',
  })
  @IsUrl()
  rcFrontSideUrl?: string;

  @ApiProperty({
    type: String,
    description: 'Registration card back side image',
    example: 'https://example.com/rc-back-side.jpg',
  })
  @IsNotEmpty({
    message: 'Registration card back side image is required',
  })
  @IsUrl()
  rcBackSideUrl?: string;

  @ApiProperty({
    type: String,
    description: 'Vehicle registration number',
    required: true,
    example: 'ABC-1234',
  })
  @IsNotEmpty({
    message: 'Vehicle registration number is required',
  })
  @IsString()
  readonly regNo!: string;

  @ApiProperty({
    type: String,
    description: 'The vehicle type id',
    example: 'c389a85c-fbf6-4b22-a4d0-0c4ab441a5d9',
  })
  @IsNotEmpty({
    message: 'Vehicle type id is required',
  })
  @IsUUID()
  readonly vehicleTypeIdBD!: string;

  @ApiProperty({
    type: String,
    description: 'Vehicle color',
    example: 'Red',
  })
  @IsNotEmpty({
    message: 'Vehicle color is required',
  })
  @IsString()
  readonly colour!: string;

  @ApiProperty({
    type: String,
    description: 'Registration date',
    example: '2020-01-15',
  })
  @IsNotEmpty({
    message: 'Registration date is required',
  })
  @IsDateString()
  readonly registrationDate!: string;
}

export class UpdateNumberPlateDto {
  @ApiProperty({
    type: String,
    description: 'The pilot id',
    required: true,
    example: 'c389a85c-fbf6-4b22-a4d0-0c4ab441a5d9',
  })
  @IsNotEmpty({
    message: 'Pilot id is required',
  })
  @IsUUID()
  readonly pilotId!: string;

  @ApiProperty({
    type: String,
    description: 'Number plate image',
    example: 'https://example.com/number-plate.jpg',
  })
  @IsNotEmpty({
    message: 'Number plate image is required',
  })
  @IsUrl()
  readonly numberPlateUrl?: string;

  @ApiProperty({
    type: String,
    description: 'Vehicle registration number',
    example: 'ABC-1234',
  })
  @IsNotEmpty({
    message: 'Vehicle registration number is required',
  })
  @IsString()
  readonly regNo!: string;
}

export class UpdateTaxTokenDto {
  @ApiProperty({
    type: String,
    description: 'The pilot id',
    required: true,
    example: 'c389a85c-fbf6-4b22-a4d0-0c4ab441a5d9',
  })
  @IsNotEmpty({
    message: 'Pilot id is required',
  })
  @IsUUID()
  readonly pilotId!: string;

  @ApiProperty({
    type: String,
    description: 'Tax token image',
    example: 'https://example.com/tax-token.jpg',
  })
  @IsNotEmpty({
    message: 'Tax token image is required',
  })
  @IsUrl()
  readonly taxTokenUrl?: string;

  @ApiProperty({
    type: String,
    description: 'Vehicle registration number',
    example: 'ABC-1234',
  })
  @IsNotEmpty({
    message: 'Vehicle registration number is required',
  })
  @IsString()
  readonly regNo!: string;

  @ApiProperty({
    type: String,
    description: 'The vehicle type id',
    example: 'c389a85c-fbf6-4b22-a4d0-0c4ab441a5d9',
  })
  @IsNotEmpty({
    message: 'Vehicle type id is required',
  })
  @IsUUID()
  readonly vehicleTypeIdBD!: string;

  @ApiProperty({
    type: String,
    description: 'Vehicle color',
    example: 'Red',
  })
  @IsNotEmpty({
    message: 'Vehicle color is required',
  })
  @IsString()
  readonly colour!: string;

  @ApiProperty({
    type: String,
    description: 'Registration date',
    example: '2020-01-15',
  })
  @IsNotEmpty({
    message: 'Registration date is required',
  })
  @IsDateString()
  readonly registrationDate!: string;
}

export class UpdateVehicleOwnerNidDto {
  @ApiProperty({
    type: String,
    description: 'The pilot id',
    required: true,
    example: 'c389a85c-fbf6-4b22-a4d0-0c4ab441a5d9',
  })
  @IsNotEmpty({
    message: 'Pilot id is required',
  })
  @IsUUID()
  readonly pilotId!: string;

  @ApiProperty({
    type: String,
    description: 'NID front side image',
    example: 'https://example.com/vehicle-owners-nid-front-side.jpg',
  })
  @IsNotEmpty({
    message: 'Vehicle owner NID front side image is required',
  })
  @IsUrl()
  vehicleOwnersNidFrontSideUrl?: string;

  @ApiProperty({
    type: String,
    description: 'NID back side image',
    example: 'https://example.com/vehicle-owners-nid-back-side.jpg',
  })
  @IsNotEmpty({
    message: 'Vehicle owner NID back side image is required',
  })
  @IsUrl()
  vehicleOwnersNidBackSideUrl?: string;

  @ApiProperty({
    type: String,
    description: 'Name on NID',
    example: 'John Doe',
  })
  @IsNotEmpty({
    message: 'Name on NID is required',
  })
  @IsString()
  readonly vehicleOwnerNidName!: string;

  @ApiProperty({
    type: String,
    description: 'Date of birth',
    example: '1990-01-15',
  })
  @IsNotEmpty({
    message: 'Date of birth is required',
  })
  @IsDateString()
  readonly vehicleOwnerNidDateOfBirth!: string;

  @ApiProperty({
    type: String,
    description: 'NID number',
    example: '1234567890123',
  })
  @IsNotEmpty({
    message: 'NID number is required',
  })
  @IsString()
  readonly vehicleOwnerNidNumber!: string;
}

export class RejectDocumentDto {
  @ApiProperty({
    type: String,
    description: 'The pilot id',
    required: true,
    example: 'c389a85c-fbf6-4b22-a4d0-0c4ab441a5d9',
  })
  @IsNotEmpty()
  @IsUUID()
  readonly pilotId!: string;

  @ApiProperty({
    type: String,
    description: 'The document type',
    required: true,
    example: DocumentType.DRIVING_LICENSE,
  })
  @IsNotEmpty()
  @IsEnum(DocumentType)
  readonly documentType!: DocumentType.DRIVING_LICENSE;

  @ApiProperty({
    type: String,
    description: 'The rejection reason',
    required: true,
    example: 'The driving license is not valid',
  })
  @IsNotEmpty()
  @IsString()
  readonly rejectionReason!: string;
}

/**
 * Optional update payloads for document approval
 * These are partial versions of the update DTOs without pilotId
 */
export class ApproveSelfieUpdateDto {
  @ApiProperty({
    type: String,
    description: 'The selfie url',
    required: false,
    example: 'https://example.com/selfie.jpg',
  })
  @IsOptional()
  @IsString()
  @IsUrl()
  readonly selfieUrl?: string;
}

export class ApproveDrivingLicenseUpdateDto {
  @ApiProperty({
    type: 'string',
    description: 'Driving license front side image',
    example: 'https://example.com/dl-front-side.jpg',
    required: false,
  })
  @IsOptional()
  @IsUrl()
  readonly dlFrontSideUrl?: string;

  @ApiProperty({
    type: 'string',
    description: 'Driving license back side image',
    example: 'https://example.com/dl-back-side.jpg',
    required: false,
  })
  @IsOptional()
  @IsUrl()
  readonly dlBackSideUrl?: string;

  @ApiProperty({
    type: String,
    description: 'Name on driving license',
    example: 'John Doe',
    required: false,
  })
  @IsOptional()
  @IsString()
  readonly nameOnLicense?: string;

  @ApiProperty({
    type: 'string',
    description: 'Date of birth',
    example: '1990-01-15',
    required: false,
  })
  @IsOptional()
  @IsDateString()
  readonly dateOfBirth?: string;

  @ApiProperty({
    type: String,
    description: 'Driving license number',
    example: 'DL1234567890',
    required: false,
  })
  @IsOptional()
  @IsString()
  readonly licenseNumber?: string;

  @ApiProperty({
    type: 'string',
    description: 'License expiry date',
    example: '2025-12-31',
    required: false,
  })
  @IsOptional()
  @IsDateString()
  readonly validUntill?: string;
}

export class ApproveNidUpdateDto {
  @ApiProperty({
    type: 'string',
    description: 'NID front side image',
    example: 'https://example.com/nid-front-side.jpg',
    required: false,
  })
  @IsOptional()
  @IsUrl()
  readonly nidFrontSideUrl?: string;

  @ApiProperty({
    type: 'string',
    description: 'NID back side image',
    example: 'https://example.com/nid-back-side.jpg',
    required: false,
  })
  @IsOptional()
  @IsUrl()
  readonly nidBackSideUrl?: string;

  @ApiProperty({
    type: String,
    description: 'Name on NID',
    example: 'John Doe',
    required: false,
  })
  @IsOptional()
  @IsString()
  readonly name?: string;

  @ApiProperty({
    type: 'string',
    description: 'Date of birth',
    example: '1990-01-15',
    required: false,
  })
  @IsOptional()
  @IsDateString()
  readonly dateOfBirth?: string;

  @ApiProperty({
    type: String,
    description: 'NID number',
    example: '1234567890123',
    required: false,
  })
  @IsOptional()
  @IsString()
  readonly nidNumber?: string;
}

export class ApproveVehicleOwnerNidUpdateDto {
  @ApiProperty({
    type: String,
    description: 'NID front side image',
    example: 'https://example.com/vehicle-owners-nid-front-side.jpg',
    required: false,
  })
  @IsOptional()
  @IsUrl()
  readonly vehicleOwnersNidFrontSideUrl?: string;

  @ApiProperty({
    type: String,
    description: 'NID back side image',
    example: 'https://example.com/vehicle-owners-nid-back-side.jpg',
    required: false,
  })
  @IsOptional()
  @IsUrl()
  readonly vehicleOwnersNidBackSideUrl?: string;

  @ApiProperty({
    type: String,
    description: 'Name on NID',
    example: 'John Doe',
    required: false,
  })
  @IsOptional()
  @IsString()
  readonly vehicleOwnerNidName?: string;

  @ApiProperty({
    type: String,
    description: 'Date of birth',
    example: '1990-01-15',
    required: false,
  })
  @IsOptional()
  @IsDateString()
  readonly vehicleOwnerNidDateOfBirth?: string;

  @ApiProperty({
    type: String,
    description: 'NID number',
    example: '1234567890123',
    required: false,
  })
  @IsOptional()
  @IsString()
  readonly vehicleOwnerNidNumber?: string;
}

export class ApproveRegistrationCardUpdateDto {
  @ApiProperty({
    type: String,
    description: 'Registration card front side image',
    example: 'https://example.com/rc-front-side.jpg',
    required: false,
  })
  @IsOptional()
  @IsUrl()
  readonly rcFrontSideUrl?: string;

  @ApiProperty({
    type: String,
    description: 'Registration card back side image',
    example: 'https://example.com/rc-back-side.jpg',
    required: false,
  })
  @IsOptional()
  @IsUrl()
  readonly rcBackSideUrl?: string;

  @ApiProperty({
    type: String,
    description: 'Vehicle registration number',
    example: 'ABC-1234',
    required: false,
  })
  @IsOptional()
  @IsString()
  readonly regNo?: string;

  @ApiProperty({
    type: String,
    description: 'The vehicle type id',
    example: 'c389a85c-fbf6-4b22-a4d0-0c4ab441a5d9',
    required: false,
  })
  @IsOptional()
  @IsUUID()
  readonly vehicleTypeIdBD?: string;

  @ApiProperty({
    type: String,
    description: 'Vehicle color',
    example: 'Red',
    required: false,
  })
  @IsOptional()
  @IsString()
  readonly colour?: string;

  @ApiProperty({
    type: String,
    description: 'Registration date',
    example: '2020-01-15',
    required: false,
  })
  @IsOptional()
  @IsDateString()
  readonly registrationDate?: string;
}

export class ApproveNumberPlateUpdateDto {
  @ApiProperty({
    type: String,
    description: 'Number plate image',
    example: 'https://example.com/number-plate.jpg',
    required: false,
  })
  @IsOptional()
  @IsUrl()
  readonly numberPlateUrl?: string;

  @ApiProperty({
    type: String,
    description: 'Vehicle registration number',
    example: 'ABC-1234',
    required: false,
  })
  @IsOptional()
  @IsString()
  readonly regNo?: string;
}

export class ApproveTaxTokenUpdateDto {
  @ApiProperty({
    type: String,
    description: 'Tax token image',
    example: 'https://example.com/tax-token.jpg',
    required: false,
  })
  @IsOptional()
  @IsUrl()
  readonly taxTokenUrl?: string;

  @ApiProperty({
    type: String,
    description: 'Vehicle registration number',
    example: 'ABC-1234',
    required: false,
  })
  @IsOptional()
  @IsString()
  readonly regNo?: string;

  @ApiProperty({
    type: String,
    description: 'The vehicle type id',
    example: 'c389a85c-fbf6-4b22-a4d0-0c4ab441a5d9',
    required: false,
  })
  @IsOptional()
  @IsUUID()
  readonly vehicleTypeIdBD?: string;

  @ApiProperty({
    type: String,
    description: 'Vehicle color',
    example: 'Red',
    required: false,
  })
  @IsOptional()
  @IsString()
  readonly colour?: string;

  @ApiProperty({
    type: String,
    description: 'Registration date',
    example: '2020-01-15',
    required: false,
  })
  @IsOptional()
  @IsDateString()
  readonly registrationDate?: string;
}

export class ApproveSelfieDto {
  @ApiProperty({
    type: String,
    description: 'The pilot id',
    required: true,
    example: 'c389a85c-fbf6-4b22-a4d0-0c4ab441a5d9',
  })
  @IsNotEmpty()
  @IsUUID()
  readonly pilotId!: string;

  @ApiProperty({
    type: ApproveSelfieUpdateDto,
    description: 'Optional update data when approving selfie',
    required: false,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => ApproveSelfieUpdateDto)
  readonly updateData?: ApproveSelfieUpdateDto;
}

export class ApproveDrivingLicenseDto {
  @ApiProperty({
    type: String,
    description: 'The pilot id',
    required: true,
    example: 'c389a85c-fbf6-4b22-a4d0-0c4ab441a5d9',
  })
  @IsNotEmpty()
  @IsUUID()
  readonly pilotId!: string;

  @ApiProperty({
    type: ApproveDrivingLicenseUpdateDto,
    description: 'Optional update data when approving driving license',
    required: false,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => ApproveDrivingLicenseUpdateDto)
  readonly updateData?: ApproveDrivingLicenseUpdateDto;
}

export class ApproveNidDto {
  @ApiProperty({
    type: String,
    description: 'The pilot id',
    required: true,
    example: 'c389a85c-fbf6-4b22-a4d0-0c4ab441a5d9',
  })
  @IsNotEmpty()
  @IsUUID()
  readonly pilotId!: string;

  @ApiProperty({
    type: ApproveNidUpdateDto,
    description: 'Optional update data when approving NID',
    required: false,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => ApproveNidUpdateDto)
  readonly updateData?: ApproveNidUpdateDto;
}

export class ApproveVehicleOwnerNidDto {
  @ApiProperty({
    type: String,
    description: 'The pilot id',
    required: true,
    example: 'c389a85c-fbf6-4b22-a4d0-0c4ab441a5d9',
  })
  @IsNotEmpty()
  @IsUUID()
  readonly pilotId!: string;

  @ApiProperty({
    type: ApproveVehicleOwnerNidUpdateDto,
    description: 'Optional update data when approving vehicle owner NID',
    required: false,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => ApproveVehicleOwnerNidUpdateDto)
  readonly updateData?: ApproveVehicleOwnerNidUpdateDto;
}

export class ApproveRegistrationCertificateDto {
  @ApiProperty({
    type: String,
    description: 'The pilot id',
    required: true,
    example: 'c389a85c-fbf6-4b22-a4d0-0c4ab441a5d9',
  })
  @IsNotEmpty()
  @IsUUID()
  readonly pilotId!: string;

  @ApiProperty({
    type: ApproveRegistrationCardUpdateDto,
    description: 'Optional update data when approving registration certificate',
    required: false,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => ApproveRegistrationCardUpdateDto)
  readonly updateData?: ApproveRegistrationCardUpdateDto;
}

export class ApproveNumberPlateDto {
  @ApiProperty({
    type: String,
    description: 'The pilot id',
    required: true,
    example: 'c389a85c-fbf6-4b22-a4d0-0c4ab441a5d9',
  })
  @IsNotEmpty()
  @IsUUID()
  readonly pilotId!: string;

  @ApiProperty({
    type: ApproveNumberPlateUpdateDto,
    description: 'Optional update data when approving number plate',
    required: false,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => ApproveNumberPlateUpdateDto)
  readonly updateData?: ApproveNumberPlateUpdateDto;
}

export class ApproveTaxTokenDto {
  @ApiProperty({
    type: String,
    description: 'The pilot id',
    required: true,
    example: 'c389a85c-fbf6-4b22-a4d0-0c4ab441a5d9',
  })
  @IsNotEmpty()
  @IsUUID()
  readonly pilotId!: string;

  @ApiProperty({
    type: ApproveTaxTokenUpdateDto,
    description: 'Optional update data when approving tax token',
    required: false,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => ApproveTaxTokenUpdateDto)
  readonly updateData?: ApproveTaxTokenUpdateDto;
}
