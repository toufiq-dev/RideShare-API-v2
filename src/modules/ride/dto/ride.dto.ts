import {
  IsNotEmpty,
  IsNumber,
  IsObject,
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

  riderName?: string;
  riderPhone?: string;
  scheduledFor?: Date;
}

export class UpdateBookingDto {
  @IsNotEmpty()
  id: string;

  status?: BookingStatus;
  pilotId?: string;
}
