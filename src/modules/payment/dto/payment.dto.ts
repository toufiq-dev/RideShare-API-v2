import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsString } from 'class-validator';

export class CreateOrderDto {
  @ApiProperty({ description: 'Subscription id' })
  @IsNotEmpty()
  @IsString()
  subscriptionId: string;

  @ApiProperty({ description: 'Multiplier of the subscription' })
  @IsNotEmpty()
  @IsNumber()
  times: number;
}

export class VerifyPaymentDto {
  @ApiProperty({ description: 'Subscription id' })
  @IsNotEmpty()
  @IsString()
  subscriptionId: string;
}
