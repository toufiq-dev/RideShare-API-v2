import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from 'src/core/database/prisma.service';
import { CreateBookingDto, UpdateBookingDto } from './dto/ride.dto';
import { BookingStatus, UserRole } from '@prisma/client';

@Injectable()
export class RideService {
  constructor(private prisma: PrismaService) {}

  async handleRequestRide(createBookingDto: CreateBookingDto, user: any) {
    const customer = await this.prisma.customer.findUnique({
      where: { userId: user.id },
    });

    if (!customer) {
      throw new UnauthorizedException('User is not a customer');
    }

    const pickupLocation = `point({latitude: ${createBookingDto.pickupLocation.latitude}, longitude: ${createBookingDto.pickupLocation.longitude}})`;

    const dropLocation = `point({latitude: ${createBookingDto.dropLocation.latitude}, longitude: ${createBookingDto.dropLocation.longitude}})`;

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
