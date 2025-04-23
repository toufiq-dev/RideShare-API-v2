import {
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { LocationDto } from 'src/common/dto/common.dto';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateLocationDto {
  @IsNumber({}, { message: 'Latitude must be a number' })
  @IsNotEmpty({ message: 'Latitude is required' })
  lat: number;

  @IsNumber({}, { message: 'Longitude must be a number' })
  @IsNotEmpty({ message: 'Longitude is required' })
  lng: number;
}

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
  bookingCode?: string;
}

export class CancelRideRequestDto {
  @IsNotEmpty({ message: 'Booking id is required' })
  @IsString()
  bookingId: string;

  @IsNotEmpty({ message: 'Reason for cancellation is required' })
  @IsString()
  reason: string;
}

export class BookingIdDto {
  @IsNotEmpty({ message: 'Booking id is required' })
  @IsString()
  bookingId: string;
}

export class StartRideDto extends BookingIdDto {
  @IsNotEmpty({ message: 'Booking id is required' })
  @IsString()
  bookingCode: string;
}

export class EditRideRequestDto {
  @ApiProperty({
    description: 'Pickup Location in latitude and longitude',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => LocationDto)
  pickupLocation?: LocationDto;

  @ApiProperty({
    description: 'Drop Location in latitude and longitude',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => LocationDto)
  dropLocation?: LocationDto;
}
