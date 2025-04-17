import { Injectable } from '@nestjs/common';
import { Server } from 'socket.io';
import { SocketService } from 'src/core/socket/socket.service';
import { CancelledBy } from '@prisma/client';
import { RideEvents } from 'src/core/socket/socket-events';

@Injectable()
export class RideNotificationService {
  constructor(private readonly socketService: SocketService) {}

  private get server(): Server {
    return this.socketService.server;
  }

  notifyRideCancelled(
    bookingId: string,
    recipientUserId: string,
    cancelledBy: CancelledBy,
  ) {
    this.server.to(recipientUserId).emit(RideEvents.RIDE_CANCELLED, {
      bookingId,
      message: `The ride has been cancelled by the ${
        cancelledBy === CancelledBy.CUSTOMER ? 'customer' : 'pilot'
      }.`,
    });
  }

  notifyDriverNotFound(bookingId: string, userId: string) {
    this.server.to(userId).emit(RideEvents.DRIVER_NOT_FOUND, {
      bookingId,
      message: 'Unfortunately ride request has been cancelled.',
    });
  }

  notifyRideRequestTimeout(bookingId: string, pilotUserId: string) {
    this.server.to(pilotUserId).emit(RideEvents.RIDE_REQUEST_TIMEOUT, {
      bookingId,
      reason: 'Time expired. You did not respond to the ride request.',
    });
  }

  notifyRideRequest(payload: {
    userId: string;
    bookingId: string;
    vehicleTypeId: string;
    pickupLocation: any;
    dropLocation: any;
    estimatedFare: number;
    nearestPilotDistance: number;
    distanceKm: number;
    durationMin: number;
  }) {
    const {
      userId,
      bookingId,
      vehicleTypeId,
      pickupLocation,
      dropLocation,
      estimatedFare,
      nearestPilotDistance,
      distanceKm,
      durationMin,
    } = payload;

    const notificationPayload = {
      bookingId,
      vehicleTypeId,
      pickupLocation,
      dropLocation,
      estimatedFare,
      nearestPilotDistance,
      distanceKm,
      durationMin,
    };

    this.server.to(userId).emit(RideEvents.RIDE_REQUEST, notificationPayload);
  }

  notifyDriverLiveLocation(
    bookingId: string,
    customerUserId: string,
    lat: number,
    lng: number,
  ) {
    const payload = { bookingId, lat, lng };
    return this.server
      .to(customerUserId)
      .emit(RideEvents.DRIVER_LIVE_LOCATION, payload);
  }

  notifyError(userId: string, message: string, error?: string) {
    this.server.to(userId).emit(RideEvents.ERROR, { message, error });
  }
}
