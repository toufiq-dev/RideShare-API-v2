import {
  IsString,
  IsNotEmpty,
  Length,
  IsEnum,
  IsOptional,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsMultiCountryPhoneNumber } from '../validator/IsMultiCountryPhoneNumber';
import { Country, UserRole } from '@prisma/client';

export class SendOtpDto {
  @ApiProperty({ description: 'Language Name' })
  @IsNotEmpty({ message: 'Language Name is required' })
  @IsString()
  language: string;

  @ApiProperty({ description: 'Phone number' })
  @IsNotEmpty({ message: 'Phone number is required' })
  @IsMultiCountryPhoneNumber(['IN', 'BD'], {
    message: 'Please provide a valid phone number',
  })
  phone: string;

  @ApiPropertyOptional({ description: 'Referral Code' })
  @IsString()
  @IsOptional({ message: 'Referral Code is optional' })
  referralCode?: string;

  @ApiPropertyOptional({ description: 'Country code' })
  @IsEnum(Country, { message: 'Country code must be either IN or BD' })
  @IsOptional({ message: 'Country code is optional' })
  countryCode?: Country;
}

export class VerifyOtpDto {
  @ApiProperty({ description: 'Phone number' })
  @IsMultiCountryPhoneNumber(['IN', 'BD'], {
    message: 'Please provide a valid phone number',
  })
  @IsNotEmpty()
  phone: string;

  @ApiPropertyOptional({ description: 'OTP' })
  @IsString()
  @Length(4, 4)
  otp: string;

  @ApiProperty({
    description: 'Role of the user',
    enum: UserRole,
    example: UserRole.CUSTOMER,
  })
  @IsEnum(UserRole, { message: 'Role must be either CUSTOMER or PILOT' })
  role: UserRole;

  @ApiPropertyOptional({ description: 'FCM Token' })
  @IsString()
  @IsNotEmpty({ message: 'FCM Token must be given' })
  fcmToken: string;

  @ApiPropertyOptional({ description: 'Promoter name' })
  @IsString()
  @IsOptional({ message: 'Promoter name is optional' })
  promoterName?: string;
}

export class RefreshTokenDto {
  @ApiProperty({ description: 'Refresh token' })
  @IsString()
  @IsNotEmpty({ message: 'Refresh token is required' })
  refreshToken: string;
}

export class RefreshFcmTokenDto {
  @ApiProperty({ description: 'FCM Token' })
  @IsString()
  @IsNotEmpty({ message: 'FCM Token is required' })
  fcmToken: string;
}

export class FindPilotDto {
  @ApiProperty({ description: 'Phone number' })
  @IsNotEmpty()
  @IsMultiCountryPhoneNumber(['IN', 'BD'], {
    message: 'Invalid phone number for India or Bangladesh',
  })
  phone: string;
}
