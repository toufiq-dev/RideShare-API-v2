import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsNumber,
  IsString,
  Length,
  IsOptional,
  Min,
  Max,
} from 'class-validator';
import { IsMultiCountryPhoneNumber } from 'src/modules/auth/validator/IsMultiCountryPhoneNumber';

export class VerifyPhoneDto {
  @ApiProperty({ description: 'Phone number' })
  @IsNotEmpty({ message: 'Phone number is required' })
  @IsMultiCountryPhoneNumber(['IN', 'BD'], {
    message: 'Invalid phone number for India or Bangladesh',
  })
  phone: string;

  @ApiPropertyOptional({ description: 'OTP' })
  @IsString()
  @Length(4, 4)
  otp: string;
}

export class LocationDto {
  @ApiProperty({ description: 'Latitude' })
  @IsNumber()
  @Min(-90)
  @Max(90)
  @IsNotEmpty()
  lat: number;

  @ApiProperty({ description: 'Longitude' })
  @IsNumber()
  @Min(-180)
  @Max(180)
  @IsNotEmpty()
  lng: number;

  @ApiProperty({ description: 'Address' })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiProperty({ description: 'Address' })
  @IsString()
  @IsOptional()
  address?: string;
}
