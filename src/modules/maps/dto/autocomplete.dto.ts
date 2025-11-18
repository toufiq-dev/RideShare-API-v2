import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class AutocompleteDto {
  @ApiProperty({
    description: 'Search query (will be URL encoded)',
    example: 'Dhaka',
  })
  @IsNotEmpty()
  @IsString()
  input: string;

  @ApiProperty({
    description: 'Country restriction (ISO 3166-1 Alpha-2 code)',
    example: 'bd',
    default: 'bd',
  })
  @IsNotEmpty()
  @IsString()
  components: string = 'country:bd';

  @ApiProperty({
    description: 'Language code',
    example: 'en',
    default: 'en',
  })
  @IsNotEmpty()
  @IsString()
  language: string = 'en';
}
