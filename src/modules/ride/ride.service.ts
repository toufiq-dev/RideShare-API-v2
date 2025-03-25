import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from 'src/core/database/prisma.service';
import { UpdateLocationDto, CreateBookingDto } from './dto/ride.dto';
import { BookingStatus } from '@prisma/client';
import { Socket } from 'socket.io';
import { RedisService } from 'src/core/cache/redis.service';
import { PilotStatus } from '@prisma/client';
import { Server } from 'socket.io';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

@Injectable()
export class RideService {
  constructor(
    private prisma: PrismaService,
    private readonly redis: RedisService,
    @InjectQueue('ride-request') private readonly rideQueue: Queue,
  ) {}

  async enqueueRideRequest(payload: CreateBookingDto) {
    try {
      return await this.rideQueue.add('broadcast-to-pilots', payload, {
        jobId: `ride-request-${payload.bookingId}`,
        removeOnComplete: true,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
      });
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  async handleUpdateLocation(client: Socket, lat: number, lng: number) {
    try {
      const pilot = await this.prisma.pilot.findUnique({
        where: { userId: client.data.user.userId },
      });
      if (!pilot) {
        throw new NotFoundException('Pilot not found.');
      }

      // Store location in Redis geospatial set
      await this.redis.geoAdd('pilotLocations', lng, lat, pilot.id);

      return { message: 'Location updated successfully' };
    } catch (error) {
      console.error(error);
      client.emit('error', { message: 'Failed to update location' });
    }
  }

  async handleRequestRide(server: Server, createBookingDto: CreateBookingDto) {
    const {
      bookingId,
      customerId,
      bookingCode,
      vehicleTypeId,
      pickupLocation,
      dropLocation,
      currentLocation,
    } = createBookingDto;

    try {
      const booking = await this.prisma.booking.findFirst({
        where: { id: bookingId },
      });
      if (!booking || booking.status !== BookingStatus.PENDING) {
        throw new NotFoundException('Booking not found or not pending');
      }

      let radius = 500; // Initial radius in meters
      const maxRadius = 1500; // Max radius
      const driverTimeout = 10 * 1000; // 10 seconds per driver

      const searchAndNotifyNextDriver = async (): Promise<boolean> => {
        const nearestPilot = await this.findNearestDriver(
          pickupLocation,
          radius,
          vehicleTypeId,
        );

        if (!nearestPilot) {
          return false; // No driver found in this radius
        }

        console.log(nearestPilot);

        await this.notifyDriver(booking, customerId, server);

        // Use Redis expiration to track driver acceptance
        const acceptanceKey = `ride:accept:${bookingId}`;
        await this.redis.set(acceptanceKey, 'pending', driverTimeout / 1000);
        const startTime = Date.now();

        while (Date.now() - startTime < driverTimeout) {
          const bookingStatus = await this.prisma.booking.findUnique({
            where: { id: bookingId },
          });

          if (bookingStatus?.status !== BookingStatus.PENDING) return true;

          await new Promise((resolve) => setTimeout(resolve, 500)); // Poll less frequently
        }

        await this.redis.del(acceptanceKey);
        return false;
      };

      let driverAccepted = await searchAndNotifyNextDriver();

      while (!driverAccepted && radius < maxRadius) {
        radius += 200; // Expand radius by 200 meters
        driverAccepted = await searchAndNotifyNextDriver();

        // Early exit if booking status changes (e.g., cancelled manually)
        if (!driverAccepted) {
          const updatedBooking = await this.prisma.booking.findUnique({
            where: { id: bookingId },
          });
          if (updatedBooking?.status !== BookingStatus.PENDING) {
            break;
          }
        }
      }

      if (!driverAccepted) {
        await this.prisma.booking.update({
          where: { id: bookingId },
          data: { status: BookingStatus.CANCELLED },
        });
        server.to(`user:${customerId}`).emit('rideCancelled', {
          bookingId,
          reason: 'No drivers available within range',
        });
      }

      return { success: true, message: 'Ride request processed' };
    } catch (error) {
      console.error(error);
      server.to(`user:${customerId}`).emit('error', {
        message: 'Failed to process ride request',
        error: error.message,
      });
      throw error;
    }
  }

  async handleAcceptRide(client: Socket, bookingId: string) {
    try {
      const pilot = await this.prisma.pilot.findUnique({
        where: { userId: client.data.user.userId },
      });
      if (!pilot) {
        throw new NotFoundException('User not found.');
      }

      const booking = await this.prisma.booking.update({
        where: { id: bookingId, status: BookingStatus.PENDING },
        data: {
          pilotId: pilot.id,
          status: BookingStatus.ACCEPTED,
          acceptedAt: new Date(),
        },
        include: { customer: true, pilot: true },
      });

      return booking;
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  private async findNearestDriver(
    pickupLocation: { lat: number; lng: number },
    radius: number,
    vehicleTypeId: string,
  ) {
    // Fetch pilots within radius from Redis
    const nearbyPilots: any = await this.redis.geoRadius(
      `pilotLocations`,
      pickupLocation.lng,
      pickupLocation.lat,
      radius,
      'm',
      { withDist: true, sort: 'ASC' },
    );

    // nearbyPilots format: [[pilotId, distance], ...]
    if (!nearbyPilots.length) {
      return null; // No pilots in this radius
    }

    for (const [pilotId, distance] of nearbyPilots) {
      const pilot = await this.prisma.pilot.findUnique({
        where: { id: pilotId },
        include: { vehicles: true },
      });

      if (
        pilot &&
        pilot.onlineStatus === PilotStatus.AVAILABLE &&
        pilot.vehicles.some((v) => v.vehicleTypeId === vehicleTypeId)
      ) {
        return { ...pilot, distance: parseFloat(distance) };
      }
    }

    // No pilots in this radius
    return null;
  }

  async notifyDriver(booking: any, customerId: string, server: Server) {
    const notificationPayload = {
      bookingId: booking.bookingId,
      pickupLocation: booking.pickupLocation,
      dropLocation: booking.dropLocation,
      estimatedFare: booking.estimatedFare,
    };

    // Notify the single driver
    const test = server
      // .to(`user:${customerId}`)
      .emit('rideRequest', notificationPayload);

    console.log('emitted?', test);
  }
}
