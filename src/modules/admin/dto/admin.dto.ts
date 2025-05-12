import { ApiProperty } from '@nestjs/swagger';
import { AppPlatform } from '@prisma/client';
import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

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

  @ApiProperty({ description: 'Phone number of the support stuff' })
  @IsString()
  @IsNotEmpty()
  phone: string;
}
