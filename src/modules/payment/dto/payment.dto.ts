import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsNumber,
  IsBoolean,
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

export class SslcommerzCallbackQueryDto {
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

export class ReconcileSslcommerzDto {
  @ApiProperty({
    description: ' Transaction ID (tran_id)',
  })
  @IsNotEmpty({ message: 'transactionId is required' })
  @IsString({ message: 'transactionId must be a string' })
  @Length(16, 16, {
    message: 'transactionId must be exactly 16 characters long',
  })
  @Matches(/^FD[a-f0-9]{14}$/i, {
    message: 'TransactionId format invalid',
  })
  transactionId: string;

  @ApiProperty({
    description:
      'Whether the payment was successful according to the mobile app',
    example: true,
  })
  @IsNotEmpty({ message: 'success is required' })
  @IsBoolean({ message: 'success must be a boolean' })
  success: boolean;

  @ApiPropertyOptional({
    description:
      'Optional reason for reconciliation (e.g., network disruption)',
    example: 'Network disruption during payment callback',
  })
  @IsOptional()
  @IsString()
  reason?: string;
}
