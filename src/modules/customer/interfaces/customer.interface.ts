import { Decimal } from '@prisma/client/runtime/library';

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
}
