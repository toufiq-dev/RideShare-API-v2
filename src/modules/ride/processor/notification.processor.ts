import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Injectable } from '@nestjs/common';
import { RideNotificationService } from '../ride-notification.service';
import { RideEvents } from 'src/core/socket/socket-events';

@Processor('ride-notification')
@Injectable()
export class RideNotificationProcessor extends WorkerHost {
  constructor(
    private readonly rideNotificationService: RideNotificationService,
  ) {
    super();
  }

  async process(job: Job): Promise<any> {
    const { type, payload, userId } = job.data;

    try {
      switch (type) {
        case RideEvents.RIDE_REQUEST:
          await this.rideNotificationService.notifyRideRequest(payload);
          break;
        case RideEvents.RIDE_STATUS_UPDATE:
          await this.rideNotificationService.notifyRideStatusUpdate(
            userId,
            payload,
          );
          break;
        case RideEvents.RIDE_CANCELLED:
          await this.rideNotificationService.notifyRideCancelled(
            payload.bookingId,
            payload.recipientUserId,
            payload.cancelledBy,
          );
          break;
        case RideEvents.DRIVER_NOT_FOUND:
          await this.rideNotificationService.notifyDriverNotFound(
            payload.bookingId,
            payload.bookingStatus,
            payload.userId,
          );
          break;
        case RideEvents.RIDE_REQUEST_TIMEOUT:
          await this.rideNotificationService.notifyRideRequestTimeout(
            payload.bookingId,
            payload.pilotUserId,
          );
          break;
        case RideEvents.REACHED_PICKUP_POINT:
          await this.rideNotificationService.notifyReachedPickupPoint(
            payload.customerUserId,
            payload.bookingId,
          );
          break;
        case RideEvents.RIDE_EDIT_LOCATION:
          await this.rideNotificationService.notifyDriverForEditLocation(
            payload.pilotUserId,
            payload,
          );
          break;
        case RideEvents.ERROR:
          await this.rideNotificationService.notifyError(
            payload.userId,
            payload.message,
            payload.error,
          );
          break;
        default:
          throw new Error(`Unknown notification type: ${type}`);
      }

      return { success: true };
    } catch (error) {
      console.error(`Failed to process notification: ${error.message}`);
      throw error;
    }
  }
}
