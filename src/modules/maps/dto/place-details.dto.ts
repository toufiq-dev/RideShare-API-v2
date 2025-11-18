import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsOptional } from 'class-validator';

export class PlaceDetailsDto {
  @ApiProperty({
    description: 'Google Places ID',
    example: 'ChIJN1t_tDeuEmsRUsoyG83frY4',
  })
  @IsNotEmpty()
  @IsString()
  place_id: string;

  @ApiProperty({
    description: 'Language code',
    example: 'en',
  })
  @IsNotEmpty()
  @IsString()
  language: string;
}
