import { Injectable } from '@nestjs/common';
import { Server } from 'socket.io';
import { SocketService } from 'src/core/socket/socket.service';
import { BookingStatus, CancelledBy } from '@prisma/client';
import { RideEvents } from 'src/core/socket/socket-events';
import { NotifyDriverPayload, CustomerRidePayload } from './dto/ride.interface';
import { RedisService } from 'src/core/cache/redis.service';

@Injectable()
export class RideNotificationService {
  constructor(
    private readonly socketService: SocketService,
    private readonly redis: RedisService,
  ) {}

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

  notifyDriverNotFound(
    bookingId: string,
    bookingStatus: BookingStatus,
    userId: string,
  ) {
    this.server.to(userId).emit(RideEvents.DRIVER_NOT_FOUND, {
      bookingId,
      bookingStatus,
      message: 'Unfortunately ride request has been cancelled.',
    });
  }

  notifyRideRequestTimeout(bookingId: string, pilotUserId: string) {
    this.server.to(pilotUserId).emit(RideEvents.RIDE_REQUEST_TIMEOUT, {
      bookingId,
      reason: 'Time expired. You did not respond to the ride request.',
    });
  }

  async notifyRideRequest(payload: NotifyDriverPayload) {
    const {
      pilotId,
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

    const notifiedKey = `notified-${bookingId}:${pilotId}`;
    await this.redis.set(notifiedKey, 'true', 300);

    const notificationPayload = {
      bookingId,
      vehicleTypeId,
      pickupLocation,
      dropLocation,
      estimatedFare: Number(estimatedFare),
      nearestPilotDistance,
      distanceKm,
      durationMin,
    };

    // Emit the ride request to the driver
    const pilotSocket = this.server
      .to(userId)
      .emit(RideEvents.RIDE_REQUEST, notificationPayload);

    console.log(
      `Ride request emitted to pilot ${pilotId} (userId: ${userId}), and socket: ${pilotSocket}`,
    );
  }

  async notifyRideStatusUpdate(
    customerUserId: string,
    payload: CustomerRidePayload,
  ) {
    this.server.to(customerUserId).emit(RideEvents.RIDE_STATUS_UPDATE, payload);
  }

  async notifyReachedPickupPoint(customerUserId: string, bookingId: string) {
    this.server
      .to(customerUserId)
      .emit(RideEvents.REACHED_PICKUP_POINT, { bookingId });
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
