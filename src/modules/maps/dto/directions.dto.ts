import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  IsEnum,
  IsOptional,
  IsArray,
} from 'class-validator';

export enum TravelMode {
  DRIVING = 'driving',
  WALKING = 'walking',
  BICYCLING = 'bicycling',
  TRANSIT = 'transit',
}

export class DirectionsDto {
  @ApiProperty({
    description: 'Starting location (address or lat,lng)',
    example: 'Dhaka,BD',
  })
  @IsNotEmpty()
  @IsString()
  origin: string;

  @ApiProperty({
    description: 'Ending location (address or lat,lng)',
    example: 'Chittagong,BD',
  })
  @IsNotEmpty()
  @IsString()
  destination: string;

  @ApiProperty({
    description: 'Transportation mode',
    enum: TravelMode,
    default: TravelMode.DRIVING,
  })
  @IsNotEmpty()
  @IsEnum(TravelMode)
  mode: TravelMode = TravelMode.DRIVING;

  @ApiPropertyOptional({
    description: 'Intermediate stops (comma-separated or array)',
    example: 'Chicago,IL',
  })
  @IsOptional()
  @IsString()
  waypoints?: string;
}
