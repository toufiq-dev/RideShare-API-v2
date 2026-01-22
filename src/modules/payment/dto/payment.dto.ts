import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

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
  @ApiPropertyOptional({
    description: 'Returned by SSLCommerz. Preferred for validation.',
  })
  @IsOptional()
  @IsString()
  val_id?: string;

  @ApiPropertyOptional({
    description: 'Your tran_id (merchant transaction id). If not in URL.',
  })
  @IsOptional()
  @IsString()
  tran_id?: string;

  @ApiPropertyOptional({
    description: 'Local Transaction.id (optional; helpful)',
  })
  @IsOptional()
  @IsString()
  transactionId?: string;
}
