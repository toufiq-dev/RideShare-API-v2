import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from 'src/core/database/prisma.service';
import { CreateBookingDto, UpdateBookingDto } from './dto/booking.dto';
import { BookingStatus, UserRole } from '@prisma/client';

@Injectable()
export class BookingService {
  constructor(private prisma: PrismaService) {}

  async create(createBookingDto: CreateBookingDto, user: any) {
    const customer = await this.prisma.customer.findUnique({
      where: { userId: user.id },
    });

    if (!customer) {
      throw new UnauthorizedException('User is not a customer');
    }

    return this.prisma.booking.create({
      data: {
        customerId: customer.id,
        pickupLocation: `POINT(${createBookingDto.pickupLocation.longitude} ${createBookingDto.pickupLocation.latitude})`,
        dropLocation: `POINT(${createBookingDto.dropLocation.longitude} ${createBookingDto.dropLocation.latitude})`,
        status: BookingStatus.PENDING,
        bookingCode: Math.random().toString(36).substring(2, 8).toUpperCase(),
        riderName: createBookingDto.riderName,
        riderPhone: createBookingDto.riderPhone,
        scheduledFor: createBookingDto.scheduledFor,
      },
      include: {
        customer: true,
      },
    });
  }

  async acceptBooking(bookingId: string, user: any) {
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

  // Add other service methods as needed
}