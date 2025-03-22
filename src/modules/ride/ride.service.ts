import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from 'src/core/database/prisma.service';
import {
  UpdateLocationDto,
  CreateBookingDto,
  UpdateBookingDto,
} from './dto/ride.dto';
import { BookingStatus } from '@prisma/client';
import { Socket } from 'socket.io';
import { RedisService } from 'src/core/cache/redis.service';

@Injectable()
export class RideService {
  constructor(
    private prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async handleUpdateLocation(client: Socket, location: UpdateLocationDto) {
    try {
      const user = client.data.user;
      const pilot = await this.prisma.pilot.findUnique({
        where: { userId: user.id },
      });

      if (!pilot) {
        throw new UnauthorizedException('User is not a pilot');
      }

      await this.redis.set(
        `pilotLocation:${pilot.id}`,
        JSON.stringify(location),
        60,
      );

      return { message: 'Location updated successfully' };
    } catch (error) {
      console.error(error);
      client.emit('error', { message: 'Failed to update location' });
    }
  }

  async handleRequestRide(
    client: Socket,
    createBookingDto: CreateBookingDto,
    user: any,
  ) {
    try {
      const customer = await this.prisma.customer.findUnique({
        where: { userId: user.id },
      });

      if (!customer) {
        throw new UnauthorizedException('User is not a customer');
      }

      const pickupLocation = `point({latitude: ${createBookingDto.pickupLocation.lat}, longitude: ${createBookingDto.pickupLocation.lng}})`;

      const dropLocation = `point({latitude: ${createBookingDto.dropLocation.lat}, longitude: ${createBookingDto.dropLocation.lng}})`;

      return this.prisma.booking.create({
        data: {
          customerId: customer.id,
          pickupLocation,
          dropLocation,
          status: BookingStatus.PENDING,
          bookingCode: Math.random().toString(36).substring(2, 8).toUpperCase(),
          scheduledFor: createBookingDto.scheduledFor,
        },
        include: {
          customer: true,
        },
      });
    } catch (error) {
      console.error(error);
      client.emit('error', { message: 'Failed to create ride request' });
    }
  }

  async handleAcceptRide(bookingId: string, user: any) {
    const pilot = await this.prisma.pilot.findUnique({
      where: { userId: user.id },
    });

    if (!pilot) {
      throw new UnauthorizedException('User is not a pilot');
    }

    return this.prisma.booking.update({
      where: { id: bookingId },
      data: {
        pilotId: pilot.id,
        status: BookingStatus.ACCEPTED,
      },
      include: {
        customer: true,
        pilot: true,
      },
    });
  }
}
