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

@Injectable()
export class RideService {
  constructor(
    private prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async handleUpdateLocation(client: Socket, location: UpdateLocationDto) {
    try {
      const pilot = await this.prisma.pilot.findUnique({
        where: { userId: client.data.user.userId },
      });
      if (!pilot) {
        throw new NotFoundException('Pilot not found.');
      }

      // Store location in Redis geospatial set
      await this.redis.geoAdd(
        'pilotLocations',
        location.lng,
        location.lat,
        pilot.id,
      );

      return { message: 'Location updated successfully' };
    } catch (error) {
      console.error(error);
      client.emit('error', { message: 'Failed to update location' });
    }
  }

  async handleRequestRide(
    client: Socket,
    server: Server,
    createBookingDto: CreateBookingDto,
  ) {
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
      const user = await this.prisma.customer.findUnique({
        where: { userId: client.data.user.userId },
      });
      if (!user) {
        throw new NotFoundException('User not found.');
      }

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

        await this.notifyDriver(bookingId, nearestPilot, server);

        // Wait 10 seconds or until the booking is accepted
        return new Promise((resolve) => {
          const checkAcceptance = setInterval(async () => {
            const updatedBooking = await this.prisma.booking.findUnique({
              where: { id: bookingId },
            });

            if (updatedBooking?.status !== BookingStatus.PENDING) {
              clearInterval(checkAcceptance);
              resolve(true); // Booking accepted or cancelled
            }
          }, 1000); // Check every 1 second

          setTimeout(() => {
            clearInterval(checkAcceptance);
            resolve(false); // Driver didn’t accept within 10 seconds
          }, driverTimeout);
        });
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

  async notifyDriver(bookingId: string, pilot: any, server: Server) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: { customer: true },
    });

    const notificationPayload = {
      bookingId,
      pickupLocation: booking.pickupLocation,
      dropLocation: booking.dropLocation,
      customerName: booking.customer.name,
      estimatedFare: booking.estimatedFare,
    };

    // Notify the single driver
    server.to(`user:${pilot.userId}`).emit('rideRequest', notificationPayload);
  }
}
