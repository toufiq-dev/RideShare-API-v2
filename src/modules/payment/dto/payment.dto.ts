import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Matches,
} from 'class-validator';

export class CreateOrderDto {
  @ApiProperty({ description: 'Subscription id' })
  @IsNotEmpty()
  @IsString()
  subscriptionId: string;

  @ApiProperty({ description: 'Multiplier of the subscription' })
  @IsNotEmpty()
  @IsNumber()
  times: number;

  @ApiPropertyOptional({ description: 'Coupon code' })
  @IsOptional()
  @IsString()
  couponCode?: string;
}

export class VerifyPaymentDto {
  @ApiProperty({ description: 'Subscription id' })
  @IsNotEmpty()
  @IsString()
  subscriptionId: string;

  @ApiProperty({ description: 'Transaction id' })
  @IsNotEmpty()
  @IsString()
  transactionId: string;

  @ApiProperty({ description: 'Multiplier of the subscription' })
  @IsNotEmpty()
  @IsNumber()
  times: number;
}

export class VerifySslcommerzDto {
  @ApiProperty({
    description: 'Transaction ID',
  })
  @IsNotEmpty()
  @IsString()
  @Length(16, 16, {
    message: 'transactionId must have required length',
  })
  @Matches(/^FD[a-f0-9]{14}$/i, {
    message: 'transactionId format invalid',
  })
  transactionId: string;
}
