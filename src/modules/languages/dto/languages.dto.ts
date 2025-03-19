import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class UpdateLanguageDto {
  @ApiProperty({ description: 'Language Name' })
  @IsNotEmpty({ message: 'Language Name is required' })
  @IsString()
  language: string;
}
