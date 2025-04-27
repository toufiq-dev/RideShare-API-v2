import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
  IsEmail,
} from 'class-validator';
import { LocationDto } from 'src/common/dto/common.dto';

import { RideLocationDto } from 'src/modules/ride/dto/ride.dto';

enum SavedPlaveTypeEnum {
  WORK = 'WORK',
  HOME = 'HOME',
  RESTAURANT = 'RESTAURANT',
  GYM = 'GYM',
  COLLEGE = 'COLLEGE',
  OTHERS = 'OTHERS',
}

export class CompleteCustomerOnboardingDto {
  @ApiProperty({ description: 'Name' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ description: 'Email' })
  @IsEmail()
  @IsOptional()
  email: string;
}

export class UpdateCustomerNameDto {
  @ApiProperty({ description: 'Name' })
  @IsString()
  @IsNotEmpty()
  name: string;
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

  @IsOptional()
  @ApiProperty({ enum: SavedPlaveTypeEnum, required: false })
  @IsEnum(SavedPlaveTypeEnum)
  type?: SavedPlaveTypeEnum;
}

export class VehicleCategoryDto extends RideLocationDto {}
