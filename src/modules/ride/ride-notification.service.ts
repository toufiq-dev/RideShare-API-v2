import { Injectable, Logger } from '@nestjs/common';
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
  private readonly logger = new Logger(RideNotificationService.name);

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
        this.logger.warn(`No FCM token found for user ${userId}`);
        return;
      }

      await this.firebaseService.sendNotification(
        device.fcmToken,
        title,
        body,
        data,
      );
      this.logger.log(`Push notification sent to user ${userId}`);
    } catch (error) {
      this.logger.error(
        `Failed to send push notification to user ${userId}:`,
        error,
      );
    }
  }

  private emitSocketEvent(userId: string, event: string, payload: any) {
    try {
      // Check if there are connected clients in this room
      const room = this.server.sockets.adapter.rooms.get(userId);
      const hasConnections = room && room.size > 0;

      if (!hasConnections) {
        this.logger.warn(`No active socket connections for user ${userId}`);
      }

      this.server.to(userId).emit(event, payload);
      this.logger.log(`Socket event ${event} emitted to user ${userId}`);
      return true;
    } catch (error) {
      this.logger.error(
        `Failed to emit socket event to user ${userId}:`,
        error,
      );
      return false;
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

    // Run both operations concurrently
    await Promise.all([
      this.sendPushNotification(
        pilotUserId,
        'New Ride Request',
        'You have a new ride request',
        fcmPayload,
      ),
      this.emitSocketEvent(
        pilotUserId,
        RideEvents.RIDE_REQUEST,
        notificationPayload,
      ),
    ]);

    this.logger.log(
      `Ride request notification sent to pilot ${pilotId} (userId: ${pilotUserId})`,
    );
  }

  async notifyRideCancelled(
    bookingId: string,
    recipientUserId: string,
    cancelledBy: CancelledBy,
  ) {
    const payload = {
      bookingId,
      message: `The ride has been cancelled by the ${
        cancelledBy === CancelledBy.CUSTOMER ? 'customer' : 'pilot'
      }.`,
    };

    await Promise.all([
      this.sendPushNotification(
        recipientUserId,
        'Ride Cancelled',
        `The ride has been cancelled by the ${
          cancelledBy === CancelledBy.CUSTOMER ? 'customer' : 'pilot'
        }`,
        { bookingId },
      ),
      this.emitSocketEvent(recipientUserId, RideEvents.RIDE_CANCELLED, payload),
    ]);
  }

  async notifyDriverNotFound(
    bookingId: string,
    bookingStatus: BookingStatus,
    userId: string,
  ) {
    const payload = {
      bookingId,
      bookingStatus,
      message: 'Unfortunately ride request has been cancelled.',
    };

    await Promise.all([
      this.sendPushNotification(
        userId,
        'Ride Cancelled',
        'Unfortunately ride request has been cancelled.',
        { bookingId, bookingStatus },
      ),
      this.emitSocketEvent(userId, RideEvents.DRIVER_NOT_FOUND, payload),
    ]);
  }

  async notifyRideRequestTimeout(bookingId: string, pilotUserId: string) {
    const payload = {
      bookingId,
      reason: 'Time expired. You did not respond to the ride request.',
    };

    await Promise.all([
      this.sendPushNotification(
        pilotUserId,
        'Ride Request Timeout',
        'Time expired. You did not respond to the ride request.',
        { bookingId },
      ),
      this.emitSocketEvent(
        pilotUserId,
        RideEvents.RIDE_REQUEST_TIMEOUT,
        payload,
      ),
    ]);
  }

  async notifyRideStatusUpdate(
    customerUserId: string,
    payload: CustomerRidePayload,
  ) {
    // Create a simplified payload for push notification
    const pushPayload = {
      bookingId: payload.bookingId,
      bookingStatus: payload.bookingStatus,
    };

    await Promise.all([
      this.sendPushNotification(
        customerUserId,
        'Ride Status Update',
        'Your ride status has been updated',
        pushPayload,
      ),
      this.emitSocketEvent(
        customerUserId,
        RideEvents.RIDE_STATUS_UPDATE,
        payload,
      ),
    ]);
  }

  async notifyReachedPickupPoint(customerUserId: string, bookingId: string) {
    const payload = { bookingId };

    await Promise.all([
      this.sendPushNotification(
        customerUserId,
        'Reached Pickup Point',
        'Your driver has reached the pickup point',
        payload,
      ),
      this.emitSocketEvent(
        customerUserId,
        RideEvents.REACHED_PICKUP_POINT,
        payload,
      ),
    ]);
  }

  async notifyDriverLiveLocation(
    bookingId: string,
    customerUserId: string,
    lat: number,
    lng: number,
  ) {
    const payload = { bookingId, lat, lng };
    // For live location updates, we only need socket events, not push notifications
    return this.emitSocketEvent(
      customerUserId,
      RideEvents.DRIVER_LIVE_LOCATION,
      payload,
    );
  }

  async notifyDriverForEditLocation(
    pilotUserId: string,
    payload: PilotRideResponse,
  ) {
    const pushPayload = {
      bookingId: payload.bookingId,
      fare: payload.fare.toString(),
    };

    await Promise.all([
      this.sendPushNotification(
        pilotUserId,
        'Ride Edit Location',
        'You have a new edit location request',
        pushPayload,
      ),
      this.emitSocketEvent(pilotUserId, RideEvents.RIDE_EDIT_LOCATION, payload),
    ]);
  }

  notifyError(userId: string, message: string, error?: string) {
    return this.emitSocketEvent(userId, RideEvents.ERROR, { message, error });
  }
}
