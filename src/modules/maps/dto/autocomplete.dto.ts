import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsOptional } from 'class-validator';

export class AutocompleteDto {
  @ApiProperty({
    description: 'Search query (will be URL encoded)',
    example: 'Dhaka',
  })
  @IsNotEmpty()
  @IsString()
  input: string;

  @ApiPropertyOptional({
    description: 'Country restriction (ISO 3166-1 Alpha-2 code)',
    example: 'bd',
    default: 'bd',
  })
  @IsOptional()
  @IsString()
  components?: string = 'country:bd';

  @ApiPropertyOptional({
    description: 'Language code',
    example: 'en',
    default: 'en',
  })
  @IsOptional()
  @IsString()
  language?: string = 'en';
}
