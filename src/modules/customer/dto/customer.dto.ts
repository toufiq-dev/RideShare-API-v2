import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
  IsEmail,
  IsPhoneNumber,
  Length,
} from 'class-validator';

enum SavedPlaveTypeEnum {
  WORK = 'WORK',
  HOME = 'HOME',
  RESTAURANT = 'RESTAURANT',
  GYM = 'GYM',
  COLLEGE = 'COLLEGE',
  OTHERS = 'OTHERS',
}

export class CompleteCustomerOnboardingDto {
  @ApiProperty({ description: 'Name' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ description: 'Email' })
  @IsEmail()
  @IsNotEmpty()
  email: string;
}

export class UpdateCustomerNameDto {
  @ApiProperty({ description: 'Name' })
  @IsString()
  @IsNotEmpty()
  name: string;
}

export class UpdateCustomerPhoneDto {
  @ApiProperty({ description: 'Phone number' })
  @IsNotEmpty({ message: 'Phone number is required' })
  @IsPhoneNumber('IN')
  phone: string;
}

export class VerifyCustomerPhoneDto {
  @ApiProperty({ description: 'Phone number' })
  @IsNotEmpty({ message: 'Phone number is required' })
  @IsPhoneNumber('IN')
  phone: string;

  @ApiPropertyOptional({ description: 'OTP' })
  @IsString()
  @Length(4, 4)
  otp: string;
}

class LocationDto {
  @ApiProperty({ description: 'Latitude' })
  @IsNumber()
  @IsNotEmpty()
  latitude: number;

  @ApiProperty({ description: 'Longitude' })
  @IsNumber()
  @IsNotEmpty()
  longitude: number;
}

export class CreateSavedPlaceDto {
  @ApiProperty({ description: 'Name of the address type' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({ description: 'Address' })
  @IsNotEmpty({ message: 'Address is required' })
  @IsString()
  address: string;

  @ApiProperty({
    description: 'Location in latitude and longitude',
    required: false,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => LocationDto)
  location?: LocationDto;

  @IsOptional()
  @ApiProperty({ enum: SavedPlaveTypeEnum, required: false })
  @IsEnum(SavedPlaveTypeEnum)
  type?: SavedPlaveTypeEnum;
}

export class UpdateSavedPlaceDto {
  @ApiProperty({ description: 'Name of the address type' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({ description: 'Address' })
  @IsNotEmpty({ message: 'Address is required' })
  @IsString()
  address: string;

  @ApiProperty({
    description: 'Location in latitude and longitude',
    required: false,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => LocationDto)
  location?: LocationDto;

  @IsOptional()
  @ApiProperty({ enum: SavedPlaveTypeEnum, required: false })
  @IsEnum(SavedPlaveTypeEnum)
  type?: SavedPlaveTypeEnum;
}
