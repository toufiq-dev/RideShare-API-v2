import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Matches, IsOptional } from 'class-validator';

export class ReverseGeocodingDto {
  @ApiProperty({
    description: 'Latitude and longitude coordinates (format: lat,lng)',
    example: '40.7128,-74.0060',
  })
  @IsNotEmpty()
  @IsString()
  latlng: string;

  @ApiProperty({
    description: 'Language code (e.g., en, es, fr)',
    example: 'en',
  })
  @IsNotEmpty()
  @IsString()
  language: string = 'en';
}
