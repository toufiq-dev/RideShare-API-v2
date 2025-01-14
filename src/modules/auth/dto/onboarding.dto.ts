import {
  IsString,
  IsNotEmpty,
  IsPhoneNumber,
  IsEmail,
  Length,
  IsEnum,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum RoleEnum {
  CUSTOMER = 'CUSTOMER',
  PILOT = 'PILOT',
}

export class SendOtpDto {
  @ApiProperty({ description: 'Language Name' })
  @IsString()
  @IsNotEmpty({ message: 'Language Name is required' })
  language: string;

  @ApiProperty({ description: 'Phone number' })
  @IsPhoneNumber()
  @IsNotEmpty({ message: 'Phone number is required' })
  phone: string;
}

export class VerifyOtpDto {
  @ApiProperty({ description: 'Phone number' })
  @IsPhoneNumber()
  @IsNotEmpty()
  phone: string;

  @ApiPropertyOptional({ description: 'OTP' })
  @IsString()
  @Length(6, 6)
  otp: string;

  @ApiProperty({
    description: 'Role of the user',
    enum: RoleEnum,
    example: RoleEnum.CUSTOMER,
  })
  @IsEnum(RoleEnum, { message: 'Role must be either CUSTOMER or PILOT' })
  role: RoleEnum;
}

export class RefreshTokenDto {
  @ApiProperty({ description: 'Refresh token' })
  @IsString()
  @IsNotEmpty({ message: 'Refresh token is required' })
  refreshToken: string;
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
