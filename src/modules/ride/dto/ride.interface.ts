export interface RideRequestPayload {
  bookingId: string;
  customerId: string;
  estimatedFare: any;
  vehicleTypeId: string;
  distanceKm: number;
  durationMin: number;
  pickupLocation: { name: string; address: string; lat: number; lng: number };
  dropLocation: { name: string; address: string; lat: number; lng: number };
}

export interface NotifyDriverPayload {
  pilotId: string;
  bookingId: string;
  pickupLocation: { name: string; address: string; lat: number; lng: number };
  dropLocation: { name: string; address: string; lat: number; lng: number };
  estimatedFare: any;
  nearestPilotDistance: number;
  distanceKm: number;
  durationMin: number;
  server: any;
}
