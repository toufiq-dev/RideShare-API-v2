import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';



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
