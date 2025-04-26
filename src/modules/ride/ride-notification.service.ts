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
    const device = await this.prisma.deviceToken.findUnique({
      where: { userId },
    });

    if (device?.fcmToken) {
      try {
        await this.firebaseService.sendNotification(
          device.fcmToken,
          title,
          body,
          data,
        );
      } catch (error) {
        console.error(
          `Failed to send push notification to user ${userId}:`,
          error,
        );
      }
    } else {
      console.error(`No FCM token found for user ${userId}`);
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
      estimatedFare: Number(estimatedFare),
      nearestPilotDistance,
      distanceKm,
      durationMin,
    };

    // Emit the ride request to the driver
    const pilotSocket = this.server
      .to(pilotUserId)
      .emit(RideEvents.RIDE_REQUEST, notificationPayload);

    // Send push notification to the driver
    await this.sendPushNotification(
      pilotUserId,
      'New Ride Request',
      'You have a new ride request',
      notificationPayload,
    );

    console.log(
      `Ride request emitted to pilot ${pilotId} (userId: ${pilotUserId}), and socket: ${pilotSocket}`,
    );
  }

  async notifyRideCancelled(
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

    await this.sendPushNotification(
      recipientUserId,
      'Ride Cancelled',
      `The ride has been cancelled by the ${
        cancelledBy === CancelledBy.CUSTOMER ? 'customer' : 'pilot'
      }`,
      { bookingId },
    );
  }

  async notifyDriverNotFound(
    bookingId: string,
    bookingStatus: BookingStatus,
    userId: string,
  ) {
    this.server.to(userId).emit(RideEvents.DRIVER_NOT_FOUND, {
      bookingId,
      bookingStatus,
      message: 'Unfortunately ride request has been cancelled.',
    });

    await this.sendPushNotification(
      userId,
      'Ride Cancelled',
      'Unfortunately ride request has been cancelled.',
      { bookingId, bookingStatus },
    );
  }

  async notifyRideRequestTimeout(bookingId: string, pilotUserId: string) {
    this.server.to(pilotUserId).emit(RideEvents.RIDE_REQUEST_TIMEOUT, {
      bookingId,
      reason: 'Time expired. You did not respond to the ride request.',
    });

    await this.sendPushNotification(
      pilotUserId,
      'Ride Request Timeout',
      'Time expired. You did not respond to the ride request.',
      { bookingId },
    );
  }

  async notifyRideStatusUpdate(
    customerUserId: string,
    payload: CustomerRidePayload,
  ) {
    this.server.to(customerUserId).emit(RideEvents.RIDE_STATUS_UPDATE, payload);

    await this.sendPushNotification(
      customerUserId,
      'Ride Status Update',
      'Your ride status has been updated',
      payload,
    );
  }

  async notifyReachedPickupPoint(customerUserId: string, bookingId: string) {
    this.server
      .to(customerUserId)
      .emit(RideEvents.REACHED_PICKUP_POINT, { bookingId });

    await this.sendPushNotification(
      customerUserId,
      'Reached Pickup Point',
      'You have reached the pickup point',
      { bookingId },
    );
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
    this.server.to(pilotUserId).emit(RideEvents.RIDE_EDIT_LOCATION, payload);

    await this.sendPushNotification(
      pilotUserId,
      'Ride Edit Location',
      'You have a new edit location request',
      payload,
    );
  }

  notifyError(userId: string, message: string, error?: string) {
    this.server.to(userId).emit(RideEvents.ERROR, { message, error });
  }
}
