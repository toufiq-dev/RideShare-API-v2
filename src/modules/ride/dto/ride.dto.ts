import {
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
  IsEnum,
} from 'class-validator';
import { Type } from 'class-transformer';
import { LocationDto } from 'src/common/dto/common.dto';
import { ApiProperty } from '@nestjs/swagger';
import { RideType } from '@prisma/client';

export class UpdateLocationDto {
  @IsNumber({}, { message: 'Latitude must be a number' })
  @IsNotEmpty({ message: 'Latitude is required' })
  lat: number;

  @IsNumber({}, { message: 'Longitude must be a number' })
  @IsNotEmpty({ message: 'Longitude is required' })
  lng: number;
}

export class RideLocationDto {
  @ApiProperty({
    description: 'Pickup Location in latitude and longitude',
  })
  @IsNotEmpty()
  @ValidateNested()
  @Type(() => LocationDto)
  pickupLocation: LocationDto;

  @ApiProperty({
    description: 'Drop Location in latitude and longitude',
  })
  @IsNotEmpty()
  @ValidateNested()
  @Type(() => LocationDto)
  dropLocation: LocationDto;
}

class OtherInfo {
  @ApiProperty({ description: 'Name' })
  @IsString()
  @IsNotEmpty()
  name: string;
}

export class CreateRideRequestDto extends RideLocationDto {
  @ApiProperty({ description: 'Vehicle Type id' })
  @IsNotEmpty({ message: 'Vehicle type is required' })
  @IsString()
  vehicleTypeId: string;

  @ApiProperty({
    description: 'current Location in latitude and longitude',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => LocationDto)
  currentLocation: LocationDto;

  @ApiProperty({
    enum: RideType,
  })
  @IsNotEmpty()
  @IsEnum(RideType)
  rideFor: RideType;

  @ApiProperty({
    description: 'Other passengers details',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => OtherInfo)
  otherPassengerInfo: OtherInfo;
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
