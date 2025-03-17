import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsString } from 'class-validator';

export class UpdateFareDto {
  @ApiProperty({ description: 'Vehicle type' })
  @IsNotEmpty()
  @IsString()
  vehicleType: string;

  @ApiProperty({ description: 'Base Fare' })
  @IsNotEmpty()
  @IsNumber()
  baseFare: number;

  @ApiProperty({ description: 'Per KM Rate' })
  @IsNotEmpty()
  @IsNumber()
  perKmRate: number;

  @ApiProperty({ description: 'Per Min Rate' })
  @IsNotEmpty()
  @IsNumber()
  perMinRate: number;
}
