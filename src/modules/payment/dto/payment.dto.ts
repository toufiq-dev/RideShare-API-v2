import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class CreateOrderDto {
  @ApiProperty({ description: 'Subscription id' })
  @IsNotEmpty()
  @IsString()
  subscriptionId: string;
}
