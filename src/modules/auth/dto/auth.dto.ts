import {
  IsString,
  IsNotEmpty,
  IsPhoneNumber,
  Length,
  IsEnum,
  IsOptional,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum RoleEnum {
  CUSTOMER = 'CUSTOMER',
  PILOT = 'PILOT',
  ADMIN = 'ADMIN',
  SUPPORT = 'SUPPORT',
}

export class SendOtpDto {
  @ApiProperty({ description: 'Language Name' })
  @IsNotEmpty({ message: 'Language Name is required' })
  @IsString()
  language: string;

  @ApiProperty({ description: 'Phone number' })
  @IsNotEmpty({ message: 'Phone number is required' })
  @IsPhoneNumber('IN')
  phone: string;

  @ApiPropertyOptional({ description: 'Referral Code' })
  @IsString()
  @IsOptional({ message: 'Referral Code is optional' })
  referralCode?: string;
}

export class VerifyOtpDto {
  @ApiProperty({ description: 'Phone number' })
  @IsPhoneNumber('IN')
  @IsNotEmpty()
  phone: string;

  @ApiPropertyOptional({ description: 'OTP' })
  @IsString()
  @Length(4, 4)
  otp: string;

  @ApiProperty({
    description: 'Role of the user',
    enum: RoleEnum,
    example: RoleEnum.CUSTOMER,
  })
  @IsEnum(RoleEnum, { message: 'Role must be either CUSTOMER or PILOT' })
  role: RoleEnum;

  @ApiPropertyOptional({ description: 'FCM Token' })
  @IsString()
  @IsNotEmpty({ message: 'FCM Token must be given' })
  fcmToken?: string;
}

export class RefreshTokenDto {
  @ApiProperty({ description: 'Refresh token' })
  @IsString()
  @IsNotEmpty({ message: 'Refresh token is required' })
  refreshToken: string;
}

export class FindPilotDto {
  @ApiProperty({ description: 'Phone number' })
  @IsNotEmpty()
  @IsPhoneNumber('IN')
  phone: string;
}
