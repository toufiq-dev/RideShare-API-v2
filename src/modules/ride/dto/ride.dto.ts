import {
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { BookingStatus } from '@prisma/client';
import { LocationDto } from 'src/common/dto/common.dto';

export class UpdateLocationDto extends LocationDto {}

export class CreateBookingDto {
  @IsNotEmpty()
  @IsObject()
  @ValidateNested()
  @Type(() => LocationDto)
  pickupLocation: LocationDto;

  @IsNotEmpty()
  @IsObject()
  @ValidateNested()
  @Type(() => LocationDto)
  dropLocation: LocationDto;

  @IsNotEmpty()
  @IsObject()
  @ValidateNested()
  @Type(() => LocationDto)
  currentLocation: LocationDto;

  @IsNotEmpty()
  @IsString()
  bookingId: string;

  @IsNotEmpty()
  @IsString()
  customerId?: string;

  @IsNotEmpty()
  @IsString()
  vehicleTypeId: string;

  @IsNotEmpty()
  @IsString()
  bookingCode?: Date;
}
