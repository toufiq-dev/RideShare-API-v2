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
import { RedisKeys } from 'src/core/cache/redis-keys';

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
    const notifiedKey = `${RedisKeys.NOTIFIED}${bookingId}:${pilotUserId}`;
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
      url: `/trip/${bookingId}`,
    };

    // Send push notification to the driver
    await this.sendPushNotification(
      pilotUserId,
      'New Ride Request',
      'You have a new ride request',
      fcmPayload,
    );

    // Socket for ride request
    this.server
      .to(pilotUserId)
      .emit(RideEvents.RIDE_REQUEST, notificationPayload);
  }

  async notifyRideCancelled(
    bookingId: string,
    recipientUserId: string,
    cancelledBy: CancelledBy,
  ) {
    // Send push notification for ride cancelled
    await this.sendPushNotification(
      recipientUserId,
      'Ride Cancelled',
      `The ride has been cancelled by the ${
        cancelledBy === CancelledBy.CUSTOMER ? 'customer' : 'pilot'
      }`,
      { bookingId },
    );

    // Socket for ride cancelled
    this.server.to(recipientUserId).emit(RideEvents.RIDE_CANCELLED, {
      bookingId,
      message: `The ride has been cancelled by the ${
        cancelledBy === CancelledBy.CUSTOMER ? 'customer' : 'pilot'
      }.`,
    });
  }

  async notifyDriverNotFound(
    bookingId: string,
    bookingStatus: BookingStatus,
    userId: string,
  ) {
    try {
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Send push notification for driver not found
      await this.sendPushNotification(
        userId,
        'Ride Cancelled',
        'Unfortunately ride request has been cancelled.',
        { bookingId, bookingStatus },
      );

      // Socket for driver not found
      this.server.to(userId).emit(RideEvents.DRIVER_NOT_FOUND, {
        bookingId,
        bookingStatus,
        message: 'Unfortunately ride request has been cancelled.',
      });
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  async notifyRideRequestTimeout(bookingId: string, pilotUserId: string) {
    this.server.to(pilotUserId).emit(RideEvents.RIDE_REQUEST_TIMEOUT, {
      bookingId,
      reason: 'Time expired. You did not respond to the ride request.',
    });
  }

  async notifyRideStatusUpdate(
    customerUserId: string,
    payload: CustomerRidePayload,
  ) {
    // Send push notification for ride status update
    await this.sendPushNotification(
      customerUserId,
      `Ride ${payload.bookingStatus.toLowerCase()}`,
      `Your ride status has been ${payload.bookingStatus.toLowerCase()}`,
      {
        bookingId: payload.bookingId,
        bookingStatus: payload.bookingStatus,
        url: `/trip/${payload.bookingId}`,
      },
    );

    // Socket for ride status update
    this.server.to(customerUserId).emit(RideEvents.RIDE_STATUS_UPDATE, payload);
  }

  async notifyReachedPickupPoint(customerUserId: string, bookingId: string) {
    // Send push notification for reached pickup point
    await this.sendPushNotification(
      customerUserId,
      'Reached Pickup Point',
      'You have reached the pickup point',
      { bookingId },
    );

    // Socket for reached pickup point
    this.server
      .to(customerUserId)
      .emit(RideEvents.REACHED_PICKUP_POINT, { bookingId });
  }

  notifyDriverLiveLocation(
    bookingId: string,
    customerUserId: string,
    lat: number,
    lng: number,
    angle: number,
  ) {
    const payload = { bookingId, lat, lng, angle };

    this.server
      .to(customerUserId)
      .emit(RideEvents.DRIVER_LIVE_LOCATION, payload);
  }

  async notifyDriverForEditLocation(
    pilotUserId: string,
    payload: PilotRideResponse,
  ) {
    // Send push notification for ride edit location
    this.sendPushNotification(
      pilotUserId,
      'Ride Edit Location',
      'You have a new edit location request',
      {
        bookingId: payload.bookingId,
        fare: payload.fare.toString(),
        url: `/trip/${payload.bookingId}`,
      },
    );

    // Socket for ride edit location
    this.server.to(pilotUserId).emit(RideEvents.RIDE_EDIT_LOCATION, payload);
  }

  async notifyLowBalance(pilotUserId: string) {
    await this.sendPushNotification(
      pilotUserId,
      'Low Balance',
      `Your balance is low. You are eligible for a bonus recharge.`,
      { pilotUserId },
    );
  }

  notifyError(userId: string, message: string, error?: string) {
    this.server.to(userId).emit(RideEvents.ERROR, { message, error });
  }
}
