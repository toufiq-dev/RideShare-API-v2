export interface RideRequestPayload {
  userId: string;
  bookingId: string;
  estimatedFare: any;
  vehicleTypeId: string;
  distanceKm: number;
  durationMin: number;
  pickupLocation: any;
  dropLocation: any;
}

export interface NotifyDriverPayload {
  pilotId: string;
  userId: string;
  bookingId: string;
  vehicleTypeId: string;
  pickupLocation: any;
  dropLocation: any;
  estimatedFare: any;
  nearestPilotDistance: number;
  distanceKm: number;
  durationMin: number;
  server: any;
}
