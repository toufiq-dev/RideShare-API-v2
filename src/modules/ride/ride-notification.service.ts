import { Injectable } from '@nestjs/common';
import { Server } from 'socket.io';
import { SocketService } from 'src/core/socket/socket.service';
import { BookingStatus, CancelledBy } from '@prisma/client';
import { RideEvents } from 'src/core/socket/socket-events';
import {
  NotifyDriverPayload,
  CustomerRidePayload,
  PilotRideResponse,
} from './dto/ride.interface';
import { RedisService } from 'src/core/cache/redis.service';
import { FirebaseService } from 'src/core/firebase/firebase.service';
import { PrismaService } from 'src/core/database/prisma.service';

@Injectable()
export class RideNotificationService {
  constructor(
    private readonly socketService: SocketService,
    private readonly redis: RedisService,
    private readonly firebaseService: FirebaseService,
    private readonly prisma: PrismaService,
  ) {}

  private get server(): Server {
    return this.socketService.server;
  }

  private async sendPushNotification(
    userId: string,
    title: string,
    body: string,
    data: any,
  ) {
    try {
      const device = await this.prisma.deviceToken.findUnique({
        where: { userId },
      });

      if (!device?.fcmToken) {
        return;
      }

      await this.firebaseService.sendNotification(
        device.fcmToken,
        title,
        body,
        data,
      );
    } catch (error) {
      console.error(error);
    }
  }

  async notifyRideRequest(payload: NotifyDriverPayload) {
    const {
      pilotId,
      pilotUserId,
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
      estimatedFare,
      nearestPilotDistance,
      distanceKm,
      durationMin,
    };

    const fcmPayload = {
      bookingId,
      vehicleTypeId: vehicleTypeId,
      pickupLocation: JSON.stringify(pickupLocation),
      dropLocation: JSON.stringify(dropLocation),
      estimatedFare: estimatedFare.toString(),
      nearestPilotDistance: nearestPilotDistance.toString(),
      distanceKm: distanceKm.toString(),
      durationMin: durationMin.toString(),
    };

    await Promise.all([
      // Send push notification to the driver
      this.sendPushNotification(
        pilotUserId,
        'New Ride Request',
        'You have a new ride request',
        fcmPayload,
      ),
      // Emit the ride request to the driver
      this.server
        .to(pilotUserId)
        .emit(RideEvents.RIDE_REQUEST, notificationPayload),
    ]);

    console.log(
      `Ride request emitted to pilot ${pilotId} (userId: ${pilotUserId})}`,
    );
  }

  async notifyRideCancelled(
    bookingId: string,
    recipientUserId: string,
    cancelledBy: CancelledBy,
  ) {
    await Promise.all([
      this.sendPushNotification(
        recipientUserId,
        'Ride Cancelled',
        `The ride has been cancelled by the ${
          cancelledBy === CancelledBy.CUSTOMER ? 'customer' : 'pilot'
        }`,
        { bookingId },
      ),
      this.server.to(recipientUserId).emit(RideEvents.RIDE_CANCELLED, {
        bookingId,
        message: `The ride has been cancelled by the ${
          cancelledBy === CancelledBy.CUSTOMER ? 'customer' : 'pilot'
        }.`,
      }),
    ]);
  }

  async notifyDriverNotFound(
    bookingId: string,
    bookingStatus: BookingStatus,
    userId: string,
  ) {
    await Promise.all([
      this.sendPushNotification(
        userId,
        'Ride Cancelled',
        'Unfortunately ride request has been cancelled.',
        { bookingId, bookingStatus },
      ),
      this.server.to(userId).emit(RideEvents.DRIVER_NOT_FOUND, {
        bookingId,
        bookingStatus,
        message: 'Unfortunately ride request has been cancelled.',
      }),
    ]);
  }

  async notifyRideRequestTimeout(bookingId: string, pilotUserId: string) {
    await Promise.all([
      this.sendPushNotification(
        pilotUserId,
        'Ride Request Timeout',
        'Time expired. You did not respond to the ride request.',
        { bookingId },
      ),

      this.server.to(pilotUserId).emit(RideEvents.RIDE_REQUEST_TIMEOUT, {
        bookingId,
        reason: 'Time expired. You did not respond to the ride request.',
      }),
    ]);
  }

  async notifyRideStatusUpdate(
    customerUserId: string,
    payload: CustomerRidePayload,
  ) {
    await Promise.all([
      this.sendPushNotification(
        customerUserId,
        `Ride ${payload.bookingStatus.toLowerCase()}`,
        `Your ride status has been ${payload.bookingStatus.toLowerCase()}`,
        { bookingId: payload.bookingId, bookingStatus: payload.bookingStatus },
      ),
      console.log(`Ride accepted payload: \n${payload}`),
      this.server
        .to(customerUserId)
        .emit(RideEvents.RIDE_STATUS_UPDATE, payload),
    ]);
  }

  async notifyReachedPickupPoint(customerUserId: string, bookingId: string) {
    await Promise.all([
      this.sendPushNotification(
        customerUserId,
        'Reached Pickup Point',
        'You have reached the pickup point',
        { bookingId },
      ),
      this.server
        .to(customerUserId)
        .emit(RideEvents.REACHED_PICKUP_POINT, { bookingId }),
    ]);
  }

  async notifyDriverLiveLocation(
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

  async notifyDriverForEditLocation(
    pilotUserId: string,
    payload: PilotRideResponse,
  ) {
    await Promise.all([
      this.sendPushNotification(
        pilotUserId,
        'Ride Edit Location',
        'You have a new edit location request',
        { bookingId: payload.bookingId, fare: payload.fare.toString() },
      ),
      this.server.to(pilotUserId).emit(RideEvents.RIDE_EDIT_LOCATION, payload),
    ]);
  }

  notifyError(userId: string, message: string, error?: string) {
    this.server.to(userId).emit(RideEvents.ERROR, { message, error });
  }
}
