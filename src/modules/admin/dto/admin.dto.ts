import { ApiProperty } from '@nestjs/swagger';
import { AppPlatform } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

export class SuperAdminLoginDto {
  @ApiProperty({ description: 'Email of the admin' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ description: 'Password of the admin' })
  @IsString()
  @IsNotEmpty()
  password: string;
}

export class CreateAdminDto extends SuperAdminLoginDto {}

export class AdminLoginDto extends SuperAdminLoginDto {}

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

class SupportPermissionDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  menuKey: string;

  @ApiProperty({ default: true })
  @IsBoolean()
  @IsOptional()
  isVisible?: boolean;
}

export class CreateSupportStuffDto {
  @ApiProperty({ description: 'Name of the support stuff' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ description: 'Phone number of the support stuff' })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiProperty({ type: [SupportPermissionDto], required: false })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SupportPermissionDto)
  @IsOptional()
  permissions?: SupportPermissionDto[];
}
