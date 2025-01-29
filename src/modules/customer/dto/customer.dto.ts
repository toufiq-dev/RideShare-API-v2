import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import Api from 'twilio/lib/rest/Api';

enum SavedPlaveTypeEnum {
  WORK = 'WORK',
  HOME = 'HOME',
  RESTAURANT = 'RESTAURANT',
  GYM = 'GYM',
  COLLEGE = 'COLLEGE',
  OTHERS = 'OTHERS',
}

class LocationDto {
  @ApiProperty({ description: 'Latitude' })
  @IsNumber()
  @IsNotEmpty()
  latitude: number;

  @ApiProperty({ description: 'Longitude' })
  @IsNumber()
  @IsNotEmpty()
  longitude: number;
}

export class CreateSavedPlaceDto {
  @ApiProperty({ description: 'Name of the address type' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({ description: 'Address' })
  @IsNotEmpty({ message: 'Address is required' })
  @IsString()
  address: string;

  @ApiProperty({
    description: 'Location in latitude and longitude',
    required: false,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => LocationDto)
  location?: LocationDto;

  @IsOptional()
  @ApiProperty({ enum: SavedPlaveTypeEnum, required: false })
  @IsEnum(SavedPlaveTypeEnum)
  type?: SavedPlaveTypeEnum;
}

export class UpdateSavedPlaceDto {
  @ApiProperty({ description: 'Name of the address type' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({ description: 'Address' })
  @IsNotEmpty({ message: 'Address is required' })
  @IsString()
  address: string;

  @ApiProperty({
    description: 'Location in latitude and longitude',
    required: false,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => LocationDto)
  location?: LocationDto;
}
