import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/core/database/prisma.service';
import { BookingStatus, CancelledBy } from '@prisma/client';
import { Socket } from 'socket.io';
import { RedisService } from 'src/core/cache/redis.service';
import { PilotStatus } from '@prisma/client';
import { Server } from 'socket.io';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { NotifyDriverPayload, RideRequestPayload } from './dto/ride.interface';

@Injectable()
export class RideService {
  constructor(
    private prisma: PrismaService,
    private readonly redis: RedisService,
    @InjectQueue('ride-request') private readonly rideQueue: Queue,
  ) {}

  async enqueueRideRequest(payload: RideRequestPayload) {
    try {
      return await this.rideQueue.add('broadcast-to-pilots', payload, {
        jobId: `ride-${payload.bookingId}`,
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
      await this.redis.geoAdd(`pilotLocations`, lng, lat, pilot.id);

      return pilot.id;
    } catch (error) {
      console.error(error);
      client.emit('error', { message: 'Failed to update location' });
    }
  }

  async getActiveRideForPilot(pilotId: string) {
    const cachedRide = await this.redis.getActiveRide(pilotId);
    if (cachedRide) {
      return cachedRide;
    }

    // Fallback to Prisma if not in Redis
    const booking = await this.prisma.booking.findFirst({
      where: {
        pilotId,
        status: BookingStatus.ACCEPTED,
      },
      select: {
        id: true,
        customer: { select: { userId: true } },
      },
    });

    if (booking) {
      const rideData = {
        bookingId: booking.id,
        customerUserId: booking.customer.userId,
      };
      // Cache in Redis with TTL (1 hour)
      await this.redis.setActiveRide(
        pilotId,
        booking.id,
        booking.customer.userId,
        3600,
      );
      return rideData;
    }

    return null;
  }

  async handleRideRequest(server: Server, payload: RideRequestPayload) {
    const {
      userId,
      bookingId,
      vehicleTypeId,
      distanceKm,
      durationMin,
      pickupLocation,
      dropLocation,
    } = payload;

    try {
      const booking = await this.prisma.booking.findFirst({
        where: { id: bookingId, status: BookingStatus.PENDING },
      });
      if (!booking)
        throw new NotFoundException('Booking not found or not pending');

      let radius = 500; // Initial radius in meters
      const maxRadius = 1500; // Max radius
      const driverTimeout = 12 * 1000; // 12 seconds per driver

      const searchAndNotifyNextDriver = async (): Promise<boolean> => {
        // Fetch all nearby pilots in the current radius
        const nearbyPilots: any = await this.redis.geoRadius(
          `pilotLocations`,
          pickupLocation.lng,
          pickupLocation.lat,
          radius,
          'm',
          { withDist: true, sort: 'ASC' },
        );

        if (!nearbyPilots.length) {
          return false; // No drivers in this radius
        }

        // Iterate through all pilots in the radius
        for (const [pilotId, distance] of nearbyPilots) {
          // Check if this pilot was already notified
          const notifiedKey = `notified-${bookingId}:${pilotId}`;
          const alreadyNotified = await this.redis.get(notifiedKey);
          if (alreadyNotified) {
            continue; // Skip already notified driver
          }

          // Fetch pilot details
          const pilot = await this.prisma.pilot.findUnique({
            where: { id: pilotId, onlineStatus: PilotStatus.AVAILABLE },
            include: { vehicle: true },
          });

          if (pilot && pilot.vehicle?.vehicleTypeId === vehicleTypeId) {
            await this.redis.set(
              `booking-vehicle:${bookingId}:${pilotId}`,
              pilot.vehicle.id,
              20,
            ); // 20 seconds TTL

            const notifyDriverPayload: NotifyDriverPayload = {
              pilotId,
              userId: pilot.userId,
              bookingId,
              vehicleTypeId,
              pickupLocation,
              dropLocation,
              estimatedFare: booking.discountedFare,
              nearestPilotDistance: parseFloat(distance) / 1000,
              distanceKm,
              durationMin,
              server,
            };

            await this.notifyDriver(notifyDriverPayload);

            // Track driver acceptance
            const acceptanceKey = `ride-accept:${bookingId}`;
            await this.redis.set(
              acceptanceKey,
              'pending',
              driverTimeout / 1000,
            );

            const startTime = Date.now();
            while (Date.now() - startTime < driverTimeout) {
              const bookingStatus = await this.prisma.booking.findUnique({
                where: { id: bookingId },
              });

              if (bookingStatus?.status !== BookingStatus.PENDING) {
                return true; // Booking was accepted or cancelled
              }

              await new Promise((resolve) => setTimeout(resolve, 500));
            }

            await this.redis.del(acceptanceKey);

            server.to(pilot.userId).emit('rideRequestTimeout', {
              bookingId,
              reason: 'Time expired. You did not respond to the ride request.',
            });

            // Booking is still pending, continue to the next driver
            continue;
          }
        }

        return false; // No eligible drivers found in this radius
      };

      let driverAccepted = false;

      while (!driverAccepted && radius <= maxRadius) {
        driverAccepted = await searchAndNotifyNextDriver();

        if (!driverAccepted) {
          const updatedBooking = await this.prisma.booking.findUnique({
            where: { id: bookingId },
          });
          if (updatedBooking?.status !== BookingStatus.PENDING) {
            break; // Exit if booking is no longer pending
          }
          radius += 200; // Expand radius
        }
      }

      if (!driverAccepted) {
        await this.prisma.booking.update({
          where: { id: bookingId },
          data: { status: BookingStatus.CANCELLED },
        });

        await this.prisma.cancellationReason.create({
          data: {
            bookingId,
            reason: 'Driver not found',
            cancelledBy: CancelledBy.SYSTEM,
          },
        });

        server.to(userId).emit('driverNotFound', {
          bookingId,
          message: 'Unfortunately ride request has been cancelled.',
        });
      }

      return { success: true, message: 'Ride request processed' };
    } catch (error) {
      console.error(error);
      server.to(userId).emit('error', {
        message: 'Failed to process ride request',
        error: error.message,
      });
      throw error;
    }
  }

  async getBookingStatus(bookingId: string) {
    return this.prisma.booking.findUnique({
      where: { id: bookingId },
      select: { status: true },
    });
  }

  async getCachedBookingStatus(bookingId: string) {
    return this.redis.getBookingStatus(bookingId);
  }

  async cacheBookingStatus(bookingId: string, status: string) {
    return this.redis.setBookingStatus(bookingId, status);
  }

  private async notifyDriver(payload: NotifyDriverPayload) {
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
      server,
    } = payload;

    const notifiedKey = `notified-${bookingId}:${pilotId}`;
    await this.redis.set(notifiedKey, 'true', 300); // Mark as notified

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
    server.to(userId).emit('rideRequest', notificationPayload);

    console.log(`Ride request emitted to pilot ${pilotId} (userId: ${userId})`);
  }
}
