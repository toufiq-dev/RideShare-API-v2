import { Decimal } from '@prisma/client/runtime/library';
import { OtherPassengerInfo } from 'src/modules/ride/dto/ride.interface';

export interface Location {
  lat: number;
  lng: number;
  name?: string;
  address?: string;
}

interface Coupon {
  id: string;
  name: string;
  discount: Decimal;
  validUntil: Date | null;
}

export interface CustomerRideResponse {
  bookingId: string;
  location: [Location, Location];
  originalPrice: number;
  discountedPrice: number;
  coupon: Coupon | null;
  otherPassengerInfo: OtherPassengerInfo | null;
}
