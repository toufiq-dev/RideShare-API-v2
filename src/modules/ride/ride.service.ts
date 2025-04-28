import { randomInt } from 'node:crypto';
import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from 'src/core/database/prisma.service';
import { BookingStatus, CancelledBy, RideType } from '@prisma/client';
import { Socket } from 'socket.io';
import { RedisService } from 'src/core/cache/redis.service';
import { PilotStatus } from '@prisma/client';
import { Server } from 'socket.io';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import {
  NotifyDriverPayload,
  RideRequestPayload,
  CustomerRidePayload,
  PilotRideResponse,
  CustomerRideResponse,
} from './dto/ride.interface';
import {
  CancelRideRequestDto,
  BookingIdDto,
  StartRideDto,
  EditRideRequestDto,
  CreateRideRequestDto,
  RatingRideDto,
} from './dto/ride.dto';
import { RideNotificationService } from './ride-notification.service';
import { RideEvents } from 'src/core/socket/socket-events';
import { FareService } from '../fare/fare.service';
import { LocationDto } from 'src/common/dto/common.dto';
import { RoleEnum } from '../auth/dto/auth.dto';

@Injectable()
export class RideService {
  constructor(
    private prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly rideNotificationService: RideNotificationService,
    private readonly fareService: FareService,
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
      // Store location in Redis geospatial set
      await this.redis.geoAdd(
        `pilotLocations`,
        lng,
        lat,
        client.data.user.userId,
      );
    } catch (error) {
      console.error(error);
      client.emit(RideEvents.ERROR, { message: 'Failed to update location' });
    }
  }

  async getActiveRideForPilot(client: Socket) {
    const cachedRide = await this.redis.getActiveRide(client.data.user.userId);
    if (cachedRide) {
      return cachedRide;
    }

    // Fallback to Prisma if not in Redis
    const pilot = await this.prisma.pilot.findUnique({
      where: { userId: client.data.user.userId },
      select: { id: true },
    });

    const booking = await this.prisma.booking.findFirst({
      where: {
        pilotId: pilot.id,
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
        client.data.user.userId,
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
        for (const [pilotUserId, distance] of nearbyPilots) {
          // Check if this pilot was already notified
          const notifiedKey = `notified-${bookingId}:${pilotUserId}`;
          const alreadyNotified = await this.redis.get(notifiedKey);
          if (alreadyNotified) {
            continue; // Skip already notified driver
          }

          // Fetch pilot details
          const pilot = await this.prisma.pilot.findUnique({
            where: { userId: pilotUserId, onlineStatus: PilotStatus.AVAILABLE },
            include: { vehicle: true },
          });

          if (pilot && pilot.vehicle?.vehicleTypeId === vehicleTypeId) {
            await this.redis.set(
              `booking-vehicle:${bookingId}:${pilotUserId}`,
              pilot.vehicle.id,
              20,
            ); // 20 seconds TTL

            const notifyDriverPayload: NotifyDriverPayload = {
              pilotId: pilotUserId,
              pilotUserId: pilot.userId,
              bookingId,
              vehicleTypeId,
              pickupLocation,
              dropLocation,
              estimatedFare: Math.ceil(Number(booking.discountedFare)),
              nearestPilotDistance: Math.ceil(parseFloat(distance) / 1000),
              distanceKm: Math.ceil(distanceKm),
              durationMin: Math.ceil(durationMin),
              server,
            };

            await this.rideNotificationService.notifyRideRequest(
              notifyDriverPayload,
            );

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

            await this.rideNotificationService.notifyRideRequestTimeout(
              bookingId,
              pilot.userId,
            );

            // Booking is still pending, continue to the next driver
            continue;
          }
        }

        return false; // No eligible drivers found in this radius
      };

      let driverAccepted = false;
      while (!driverAccepted && radius <= maxRadius) {
        driverAccepted = await searchAndNotifyNextDriver();

        console.log('driverAccepted: ', driverAccepted);

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
        const booking = await this.prisma.booking.update({
          where: { id: bookingId },
          data: { status: BookingStatus.NOT_FOUND },
        });

        await this.prisma.cancellationReason.create({
          data: {
            bookingId,
            reason: 'Driver not found',
            cancelledBy: CancelledBy.SYSTEM,
          },
        });

        await this.redis.setBookingStatus(bookingId, BookingStatus.CANCELLED);

        await this.rideNotificationService.notifyDriverNotFound(
          bookingId,
          booking.status,
          userId,
        );
      }

      return { success: true, message: 'Ride request processed' };
    } catch (error) {
      console.error(error);
      server.to(userId).emit(RideEvents.ERROR, {
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

  async createRideRequest(
    createRideRequestDto: CreateRideRequestDto,
    userId: string,
  ) {
    const {
      vehicleTypeId,
      pickupLocation,
      dropLocation,
      currentLocation,
      rideFor,
      otherPassengerInfo,
    } = createRideRequestDto;

    try {
      // Fetch customer and vehicle type in one query
      const [customer, vehicleType] = await Promise.all([
        this.prisma.customer.findUnique({
          where: { userId },
          include: { coupon: true },
        }),
        this.prisma.vehicleType.findUnique({ where: { id: vehicleTypeId } }),
      ]);
      if (!customer) {
        throw new NotFoundException('Customer not found');
      }
      if (!vehicleType) {
        throw new NotFoundException('Vehicle type not found');
      }

      // Check active booking
      const activeBooking = await this.prisma.booking.findFirst({
        where: { customerId: customer.id, status: BookingStatus.PENDING },
      });
      if (activeBooking)
        throw new BadRequestException(
          'You already have an active ride request',
        );

      const origin = { lat: pickupLocation.lat, lng: pickupLocation.lng };
      const destination = { lat: dropLocation.lat, lng: dropLocation.lng };

      const { distanceKm, durationMin } =
        await this.fareService.calculateDistanceAndDuration(
          origin,
          destination,
        );

      const originalPrice = this.fareService.estimateFare(
        distanceKm,
        durationMin,
        Number(vehicleType.baseFare),
        Number(vehicleType.perKmRate),
        Number(vehicleType.perMinRate),
      );

      const coupon = customer.coupon;
      if (coupon && isNaN(Number(coupon.discount))) {
        throw new BadRequestException('Invalid coupon discount');
      }

      const price =
        coupon && originalPrice > Number(coupon.discount)
          ? originalPrice - Number(coupon.discount)
          : originalPrice;

      const booking = await this.prisma.booking.create({
        data: {
          bookingCode: randomInt(1000, 10000).toString(),
          customerId: customer.id,
          name:
            rideFor === RideType.SELF
              ? customer.name
              : otherPassengerInfo?.name,
          status: BookingStatus.PENDING,
          rideType: rideFor,
          estimatedFare: Math.ceil(originalPrice),
          discountedFare: Math.ceil(price),
          pickupLocation: JSON.parse(JSON.stringify(pickupLocation)),
          dropLocation: JSON.parse(JSON.stringify(dropLocation)),
          estimatedDistance: Math.ceil(distanceKm).toString(),
          estimatedDuration: Math.ceil(durationMin),
        },
      });

      await this.enqueueRideRequest({
        userId: customer.userId,
        bookingId: booking.id,
        estimatedFare: booking.estimatedFare,
        vehicleTypeId,
        distanceKm,
        durationMin,
        pickupLocation,
        dropLocation,
      });

      const data: CustomerRideResponse = {
        bookingId: booking.id,
        location: [pickupLocation, dropLocation],
        originalPrice: Math.ceil(Number(originalPrice)),
        discountedPrice: Math.ceil(Number(price)),
        coupon: coupon || null,
        otherPassengerInfo:
          booking.rideType === RideType.OTHERS
            ? { name: otherPassengerInfo.name }
            : null,
      };

      return {
        success: true,
        message:
          'Your ride request is being processed. Searching for a driver...',
        data,
      };
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  async acceptRide(acceptRideDto: BookingIdDto, userId: string) {
    const { bookingId } = acceptRideDto;

    try {
      const pilot = await this.prisma.pilot.findUnique({
        where: { userId },
        include: { drivingLicense: true, vehicle: true },
      });
      if (!pilot) throw new NotFoundException('Pilot not found.');

      const result = await this.prisma.$transaction(async (tx) => {
        await tx.pilot.update({
          where: { userId },
          data: {
            activeBookingId: bookingId,
          },
        });

        const booking = await tx.booking.findFirst({
          where: { id: bookingId, status: BookingStatus.PENDING },
        });
        if (!booking) throw new BadRequestException('Booking not found.');

        const updated = await tx.booking.update({
          where: { id: booking.id },
          data: {
            pilotId: pilot.id,
            status: BookingStatus.ACCEPTED,
            acceptedAt: new Date(),
          },
          include: {
            customer: {
              include: {
                coupon: true,
              },
            },
            pilot: true,
          },
        });

        await tx.customer.update({
          where: { id: booking.customerId },
          data: { activeBookingId: booking.id },
        });

        return { updated };
      });

      const pilotLocation = await this.redis.geoPos(
        'pilotLocations',
        pilot.userId,
      );

      let pickupInMinutes: number | null = null;

      if (pilotLocation) {
        const [lat, lng] = pilotLocation;
        const { durationMin } =
          await this.fareService.calculateDistanceAndDuration(
            { lat, lng },
            result.updated.pickupLocation as any,
          );
        pickupInMinutes = Math.ceil(durationMin);
      }

      const vehicleId = await this.redis.get(
        `booking-vehicle:${bookingId}:${pilot.userId}`,
      );
      const vehicle = vehicleId
        ? await this.prisma.vehicle.findUnique({
            where: { id: vehicleId },
            include: { vehicleType: true },
          })
        : null;

      await this.redis.del(`booking-vehicle:${bookingId}:${pilot.userId}`);
      // await this.redis.del(`notified-${bookingId}:${pilot.id}`);
      await this.redis.del(`ride-accept:${bookingId}`);

      // Cache active ride in Redis
      await this.redis.setActiveRide(
        pilot.id,
        result.updated.id,
        result.updated.customer.userId,
      );

      let couponForPayload = null;
      if (result?.updated?.customer?.coupon) {
        couponForPayload = {
          ...result.updated.customer.coupon,
          discount: result.updated.customer.coupon.discount
            ? Number(result.updated.customer.coupon.discount)
            : 0.0,
        };
      }

      const rideAcceptedPayload: CustomerRidePayload = {
        bookingCode: result.updated.bookingCode,
        bookingId: result.updated.id,
        bookingStatus: result.updated.status,
        estimatedDuration: result.updated.estimatedDuration,
        pilot: {
          pilotName: pilot.drivingLicense.nameOnLicense,
          profilePicture: pilot.selfieUrl,
          pilotPhone: pilot.phone,
          rating: pilot.averageRating,
          pilotLocation: {
            lat: pilotLocation[0],
            lng: pilotLocation[1],
          },
          vehicleNumber: vehicle.regNo,
          model: vehicle.model,
          colour: vehicle.colour,
          vehicleType: vehicle.vehicleType.name,
        },
        pickupInMinutes,
        pickupLocation: result.updated.pickupLocation,
        dropLocation: result.updated.dropLocation,
        fairDetails: {
          origialFare: Math.ceil(Number(result.updated.estimatedFare)),
          discountedFare: Math.ceil(Number(result.updated.discountedFare)),
          coupon: couponForPayload,
        },
        otherPassengerInfo:
          result.updated.rideType === RideType.OTHERS
            ? { name: result.updated.name }
            : null,
      };

      // rideAccepted event triggered for customer
      // this.rideGateway.server
      //   .to(result.updated.customer.userId)
      //   .emit(RideEvents.RIDE_STATUS_UPDATE, rideAcceptedPayload);
      await this.rideNotificationService.notifyRideStatusUpdate(
        result.updated.customer.userId,
        rideAcceptedPayload,
      );

      const data: PilotRideResponse = {
        bookingId: result.updated.id,
        fare: Math.ceil(Number(result.updated.discountedFare)),
        customerName: result.updated.customer.name,
        customerPhone: result.updated.customer.phone,
        averageRating: result.updated.customer.averageRating,
        pickupLocation: result.updated.pickupLocation,
        dropLocation: result.updated.dropLocation,
        rideStatus: result.updated.status,
        otherPassengerInfo:
          result.updated.rideType === RideType.OTHERS
            ? { name: result.updated.name }
            : null,
      };

      return {
        message: 'Ride accepted successfully.',
        data,
      };
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  async reachedPickupPoint(
    reachedPickupPointDto: BookingIdDto,
    userId: string,
  ) {
    const { bookingId } = reachedPickupPointDto;

    try {
      const pilot = await this.prisma.pilot.findUnique({ where: { userId } });
      if (!pilot) {
        throw new NotFoundException('Pilot not found.');
      }

      const booking = await this.prisma.booking.findUnique({
        where: {
          id: bookingId,
          pilotId: pilot.id,
          status: BookingStatus.ACCEPTED,
        },
        include: { customer: true },
      });
      if (!booking) {
        throw new NotFoundException('Booking not found.');
      }

      await this.prisma.booking.update({
        where: { id: bookingId },
        data: { status: BookingStatus.ARRIVED, arrivedAt: new Date() },
      });

      // Emit reachedPickupPoint event to customer
      await this.rideNotificationService.notifyReachedPickupPoint(
        booking.customer.userId,
        bookingId,
      );

      return {
        message: 'Reached pickup point successfully.',
      };
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  async startRide(startRideDto: StartRideDto, userId: string) {
    const { bookingId, bookingCode } = startRideDto;

    try {
      const pilot = await this.prisma.pilot.findUnique({ where: { userId } });
      if (!pilot) {
        throw new NotFoundException('Pilot not found.');
      }

      const booking = await this.prisma.booking.findUnique({
        where: { id: bookingId, pilotId: pilot.id },
        select: { id: true, bookingCode: true, customerId: true },
      });

      if (!booking || booking.bookingCode !== bookingCode) {
        throw new BadRequestException('Invalid Booking.');
      }

      const result = await this.prisma.$transaction(async (tx) => {
        await tx.pilot.update({
          where: { id: pilot.id },
          data: { onlineStatus: PilotStatus.ON_TRIP },
        });

        await tx.customer.update({
          where: { id: booking.customerId },
          data: { activeBookingId: booking.id },
        });

        const updated = await tx.booking.update({
          where: { id: booking.id },
          data: { status: BookingStatus.ONGOING, tripStart: new Date() },
          include: {
            customer: { include: { coupon: true } },
            pilot: {
              include: {
                drivingLicense: true,
                vehicle: { include: { vehicleType: true } },
              },
            },
          },
        });

        // Cut farecoins from pilot wallet
        await this.prisma.pilotWallet.update({
          where: { pilotId: pilot.id },
          data: { balance: { decrement: updated.discountedFare } },
        });

        return { updated };
      });

      const pilotLocation = await this.redis.geoPos(
        'pilotLocations',
        result.updated.pilot.userId,
      );

      const payload: CustomerRidePayload = {
        bookingCode: result.updated.bookingCode,
        bookingId: result.updated.id,
        bookingStatus: result.updated.status,
        estimatedDuration: result.updated.estimatedDuration,
        pilot: {
          pilotName: result.updated.pilot.drivingLicense.nameOnLicense,
          profilePicture: result.updated.pilot.selfieUrl,
          pilotPhone: result.updated.pilot.phone,
          rating: result.updated.pilot.averageRating,
          pilotLocation: {
            lat: pilotLocation[0],
            lng: pilotLocation[1],
          },
          vehicleNumber: result.updated.pilot.vehicle.regNo,
          model: result.updated.pilot.vehicle.model,
          colour: result.updated.pilot.vehicle.colour,
          vehicleType: result.updated.pilot.vehicle.vehicleType.name,
        },
        pickupInMinutes: null,
        pickupLocation: result.updated.pickupLocation,
        dropLocation: result.updated.dropLocation,
        fairDetails: {
          origialFare: Math.ceil(Number(result.updated.estimatedFare)),
          discountedFare: Math.ceil(Number(result.updated.discountedFare)),
          coupon: result.updated.customer.coupon,
        },
        otherPassengerInfo:
          result.updated.rideType === RideType.OTHERS
            ? { name: result.updated.name }
            : null,
      };

      // rideStarted event triggered for customer
      // this.rideGateway.server
      //   .to(result.updated.customer.userId)
      //   .emit(RideEvents.RIDE_STATUS_UPDATE, payload);
      await this.rideNotificationService.notifyRideStatusUpdate(
        result.updated.customer.userId,
        payload,
      );

      const data: PilotRideResponse = {
        bookingId: booking.id,
        fare: Number(result.updated.discountedFare),
        customerName: result.updated.customer.name,
        customerPhone: result.updated.customer.phone,
        averageRating: result.updated.customer.averageRating,
        pickupLocation: result.updated.pickupLocation,
        dropLocation: result.updated.dropLocation,
        rideStatus: result.updated.status,
        otherPassengerInfo:
          result.updated.rideType === RideType.OTHERS
            ? { name: result.updated.name }
            : null,
      };

      return {
        message: 'Ride started successfully.',
        data,
      };
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  async endRide(endRideDto: BookingIdDto, userId: string) {
    const { bookingId } = endRideDto;

    try {
      const pilot = await this.prisma.pilot.findUnique({ where: { userId } });
      if (!pilot) {
        throw new NotFoundException('Pilot not found.');
      }

      const booking = await this.prisma.booking.findUnique({
        where: { id: bookingId, pilotId: pilot.id },
        select: { id: true, bookingCode: true, customerId: true },
      });
      if (!booking) {
        throw new BadRequestException('Invalid Booking.');
      }

      const result = await this.prisma.$transaction(async (tx) => {
        await tx.pilot.update({
          where: { id: pilot.id },
          data: { activeBookingId: null },
        });

        await tx.customer.update({
          where: { id: booking.customerId },
          data: { activeBookingId: null },
        });

        const updated = await tx.booking.update({
          where: { id: bookingId },
          data: { status: BookingStatus.COMPLETED, tripEnd: new Date() },
          include: {
            customer: { include: { coupon: true } },
            pilot: {
              include: {
                drivingLicense: true,
                vehicle: { include: { vehicleType: true } },
              },
            },
          },
        });

        return { updated };
      });

      const payload: CustomerRidePayload = {
        bookingCode: result.updated.bookingCode,
        bookingId: result.updated.id,
        bookingStatus: result.updated.status,
        estimatedDuration: result.updated.estimatedDuration,
        pilot: {
          pilotName: result.updated.pilot.drivingLicense.nameOnLicense,
          profilePicture: result.updated.pilot.selfieUrl,
          pilotPhone: result.updated.pilot.phone,
          rating: result.updated.pilot.averageRating,
          pilotLocation: null,
          vehicleNumber: result.updated.pilot.vehicle.regNo,
          model: result.updated.pilot.vehicle.model,
          colour: result.updated.pilot.vehicle.colour,
          vehicleType: result.updated.pilot.vehicle.vehicleType.name,
        },
        pickupInMinutes: null,
        pickupLocation: result.updated.pickupLocation,
        dropLocation: result.updated.dropLocation,
        fairDetails: {
          origialFare: Number(result.updated.estimatedFare),
          discountedFare: Number(result.updated.discountedFare),
          coupon: result.updated.customer.coupon,
        },
        otherPassengerInfo:
          result.updated.rideType === RideType.OTHERS
            ? { name: result.updated.name }
            : null,
      };

      // rideEnded event triggered for customer
      await this.rideNotificationService.notifyRideStatusUpdate(
        result.updated.customer.userId,
        payload,
      );

      const data: PilotRideResponse = {
        bookingId: booking.id,
        fare: Number(result.updated.discountedFare),
        customerName: result.updated.customer.name,
        customerPhone: result.updated.customer.phone,
        averageRating: result.updated.customer.averageRating,
        pickupLocation: result.updated.pickupLocation,
        dropLocation: result.updated.dropLocation,
        rideStatus: result.updated.status,
        otherPassengerInfo:
          result.updated.rideType === RideType.OTHERS
            ? { name: result.updated.name }
            : null,
      };

      return {
        message: 'Ride ended successfully.',
        data,
      };
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  async cancelRideRequest(
    cancelRideRequestDto: CancelRideRequestDto,
    userId: string,
  ) {
    const { bookingId, reason } = cancelRideRequestDto;
    try {
      const booking = await this.prisma.booking.findUnique({
        where: {
          id: bookingId,
        },
        include: { customer: true, pilot: true },
      });
      if (!booking) {
        throw new NotFoundException('Booking not found.');
      }

      if (
        booking.customer.userId !== userId &&
        booking.pilot.userId !== userId
      ) {
        throw new UnauthorizedException(
          'You are not authorized to cancel this booking.',
        );
      }

      const cancelledBy =
        booking.customer.userId === userId
          ? CancelledBy.CUSTOMER
          : CancelledBy.PILOT;

      await this.prisma.$transaction(async (tx) => {
        await tx.booking.update({
          where: {
            id: bookingId,
          },
          data: {
            status: BookingStatus.CANCELLED,
          },
        });

        await this.redis.setBookingStatus(bookingId, BookingStatus.CANCELLED);
        // Later, when you implement the start ride feature, add:
        // await this.redis.setBookingStatus(bookingId, BookingStatus.STARTED);

        await this.prisma.cancellationReason.create({
          data: {
            bookingId: bookingId,
            reason: reason,
            cancelledBy,
          },
        });

        await tx.pilot.update({
          where: { id: booking.pilotId },
          data: { activeBookingId: null },
        });

        await tx.customer.update({
          where: { id: booking.customerId },
          data: { activeBookingId: null },
        });
      });

      // Cache booking status in Redis
      await this.redis.setBookingStatus(bookingId, BookingStatus.CANCELLED);

      // Clear Redis cache for the pilot's active ride and notify the other party
      if (booking.pilotId) {
        await this.redis.removeActiveRide(booking.pilotId);

        const recipientUserId =
          cancelledBy === CancelledBy.CUSTOMER
            ? booking.pilot.userId
            : booking.customer.userId;
        await this.rideNotificationService.notifyRideCancelled(
          bookingId,
          recipientUserId,
          cancelledBy,
        );
      }

      return {
        success: true,
        message: 'Ride request cancelled successfully.',
      };
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  async editRideRequest(
    id: string,
    editRideRequestDto: EditRideRequestDto,
    userId: string,
  ) {
    const { pickupLocation, dropLocation } = editRideRequestDto;

    try {
      const [customer, booking]: any = await Promise.all([
        await this.prisma.customer.findUnique({
          where: { userId },
          include: { coupon: true },
        }),
        await this.prisma.booking.findUnique({
          where: { id },
        }),
      ]);

      if (!customer) {
        throw new NotFoundException('Customer not found');
      }
      if (!booking) {
        throw new NotFoundException('Booking not found');
      }

      const pilot = await this.prisma.pilot.findUnique({
        where: { id: booking.pilotId },
        select: {
          userId: true,
          selfieUrl: true,
          phone: true,
          averageRating: true,
          currentLocation: true,
          drivingLicense: {
            select: {
              nameOnLicense: true,
            },
          },
          vehicle: {
            select: {
              regNo: true,
              model: true,
              colour: true,
              vehicleType: {
                select: {
                  name: true,
                  baseFare: true,
                  perKmRate: true,
                  perMinRate: true,
                },
              },
            },
          },
        },
      });

      let distanceKm: number;
      let durationMin: number;
      if (pickupLocation) {
        ({ distanceKm, durationMin } = await this.newDistanceAndDuration(
          true,
          pickupLocation,
          booking,
        ));
      } else if (dropLocation) {
        ({ distanceKm, durationMin } = await this.newDistanceAndDuration(
          false,
          dropLocation,
          booking,
        ));
      } else {
        throw new BadRequestException('No location provided for update');
      }

      const originalPrice = this.fareService.estimateFare(
        distanceKm,
        durationMin,
        Number(pilot?.vehicle?.vehicleType.baseFare),
        Number(pilot?.vehicle?.vehicleType.perKmRate),
        Number(pilot?.vehicle?.vehicleType.perMinRate),
      );

      const coupon = customer?.coupon;
      if (coupon && isNaN(Number(coupon.discount))) {
        throw new BadRequestException('Invalid coupon discount');
      }

      const price =
        coupon && originalPrice > Number(coupon.discount)
          ? originalPrice - Number(coupon.discount)
          : originalPrice;

      const updatedBooking = await this.prisma.booking.update({
        where: { id: booking.id },
        data: {
          pickupLocation: pickupLocation
            ? pickupLocation
            : booking.pickupLocation,
          dropLocation: dropLocation ? dropLocation : booking.dropLocation,
          estimatedDistance: Math.ceil(distanceKm).toString(),
          estimatedDuration: Math.ceil(durationMin),
          estimatedFare: originalPrice,
          discountedFare: price,
        },
      });

      const payload: PilotRideResponse = {
        bookingId: updatedBooking.id,
        fare: Number(updatedBooking.discountedFare),
        customerName:
          updatedBooking.rideType === RideType.SELF
            ? customer.name
            : updatedBooking.name,
        customerPhone: customer.phone,
        averageRating: customer.averageRating,
        pickupLocation: pickupLocation
          ? pickupLocation
          : updatedBooking.pickupLocation,
        dropLocation: dropLocation ? dropLocation : updatedBooking.dropLocation,
        rideStatus: updatedBooking.status,
        otherPassengerInfo:
          updatedBooking.rideType === RideType.OTHERS
            ? { name: updatedBooking.name }
            : null,
      };

      await this.rideNotificationService.notifyDriverForEditLocation(
        pilot.userId,
        payload,
      );

      const pilotLocation = await this.redis.geoPos(
        'pilotLocations',
        pilot.userId,
      );

      if (coupon) {
        coupon.discount = Number(coupon.discount);
      }

      const data: CustomerRidePayload = {
        bookingCode: updatedBooking.bookingCode,
        bookingId: updatedBooking.id,
        bookingStatus: updatedBooking.status,
        estimatedDuration: updatedBooking.estimatedDuration,
        pilot: {
          pilotName: pilot.drivingLicense.nameOnLicense,
          profilePicture: pilot.selfieUrl,
          pilotPhone: pilot.phone,
          rating: pilot.averageRating,
          pilotLocation: {
            lat: pilotLocation[0],
            lng: pilotLocation[1],
          },
          vehicleNumber: pilot.vehicle.regNo,
          model: pilot.vehicle.model,
          colour: pilot.vehicle.colour,
          vehicleType: pilot.vehicle.vehicleType.name,
        },
        pickupInMinutes: null,
        pickupLocation: updatedBooking.pickupLocation,
        dropLocation: updatedBooking.dropLocation,
        fairDetails: {
          origialFare: Number(updatedBooking.estimatedFare),
          discountedFare: Number(updatedBooking.discountedFare),
          coupon,
        },
        otherPassengerInfo:
          updatedBooking.rideType === RideType.OTHERS
            ? { name: updatedBooking.name }
            : null,
      };

      return {
        message: 'Pickup or Drop Location has been changed',
        data,
      };
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  async ratingRide(
    ratingRideDto: RatingRideDto,
    userId: string,
    role: RoleEnum,
  ) {
    const { bookingId, rating, feedback } = ratingRideDto;

    try {
      const booking = await this.prisma.booking.findUnique({
        where: { id: bookingId },
      });

      if (!booking) {
        throw new NotFoundException('Booking not found.');
      }

      if (booking.status !== BookingStatus.COMPLETED) {
        throw new BadRequestException('Booking is not completed yet.');
      }

      // 2. Verify user permissions based on role
      if (role === RoleEnum.PILOT) {
        const pilot = await this.prisma.pilot.findUnique({
          where: { userId },
        });

        if (!pilot) {
          throw new NotFoundException('Pilot not found.');
        }

        if (pilot.id !== booking.pilotId) {
          throw new ForbiddenException(
            'You can only rate rides you have completed.',
          );
        }

        // Create pilot rating
        const ratingRecord = await this.prisma.pilotRating.create({
          data: {
            pilotId: pilot.id,
            bookingId,
            rating,
            feedback,
          },
        });

        return {
          message: 'Rating has been submitted',
          data: ratingRecord,
        };
      } else if (role === RoleEnum.CUSTOMER) {
        const customer = await this.prisma.customer.findUnique({
          where: { userId },
        });

        if (!customer) {
          throw new NotFoundException('Customer not found.');
        }

        if (customer.id !== booking.customerId) {
          throw new ForbiddenException(
            'You can only rate rides you have booked.',
          );
        }

        // Create customer rating
        const ratingRecord = await this.prisma.customerRating.create({
          data: {
            customerId: customer.id,
            bookingId,
            rating,
            feedback,
          },
        });

        return {
          message: 'Rating has been submitted',
          data: ratingRecord,
        };
      }

      throw new BadRequestException('Invalid role specified.');
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  private async newDistanceAndDuration(
    isPickup: boolean,
    location: LocationDto,
    booking: any,
  ): Promise<{ distanceKm: number; durationMin: number }> {
    const origin = isPickup
      ? { lat: location.lat, lng: location.lng }
      : { lat: booking.pickupLocation.lat, lng: booking.pickupLocation.lng };
    const destination = isPickup
      ? { lat: booking.dropLocation.lat, lng: booking.dropLocation.lng }
      : { lat: location.lat, lng: location.lng };

    const { distanceKm, durationMin } =
      await this.fareService.calculateDistanceAndDuration(origin, destination);

    return { distanceKm, durationMin };
  }
}
