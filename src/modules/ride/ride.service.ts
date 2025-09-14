import { randomInt } from 'node:crypto';
import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
  BadRequestException,
  ForbiddenException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { PrismaService } from 'src/core/database/prisma.service';
import {
  BookingStatus,
  CancelledBy,
  RideType,
  TransactionStatus,
  TransactionType,
} from '@prisma/client';
import { Socket } from 'socket.io';
import { RedisService } from 'src/core/cache/redis.service';
import { PilotStatus } from '@prisma/client';
import {
  RideRequestPayload,
  CustomerRidePayload,
  PilotRideResponse,
} from './dto/ride.interface';
import {
  CancelRideRequestDto,
  BookingIdDto,
  StartRideDto,
  EditRideRequestDto,
  CreateRideRequestDto,
  RatingRideDto,
  RideRequestAgainDto,
} from './dto/ride.dto';
import { RideNotificationService } from './services/ride-notification.service';
import { RideEvents } from 'src/core/socket/socket-events';
import { FareService } from '../fare/fare.service';
import { UserRole } from '@prisma/client';
import moment from 'moment-timezone';
import { RedisKeys } from 'src/core/cache/redis-keys';
import { ConfigService } from '@nestjs/config';
import { LoggerService } from 'src/core/logging/logger.service';
import { RideGateway } from './ride.gateway';
import { DriverSearchService } from './services/driver-search.service';

@Injectable()
export class RideService {
  private readonly bonusRechargeThreshold: string;
  private readonly context = 'RideService';

  constructor(
    private prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly rideNotificationService: RideNotificationService,
    private readonly fareService: FareService,
    private readonly configService: ConfigService,
    private readonly logger: LoggerService,
    @Inject(forwardRef(() => RideGateway))
    private readonly rideGateway: RideGateway,
    private readonly driverSearchService: DriverSearchService,
  ) {
    this.bonusRechargeThreshold = this.configService.get<string>(
      'systemConfig.bonusRechargeThreshold',
    );
  }

  async handleUpdateLocation(client: Socket, lat: number, lng: number) {
    try {
      // Store location in Redis geospatial set
      await this.redis.geoAdd(
        RedisKeys.PILOT_LOCATION,
        lat,
        lng,
        client.data.user.userId,
      );
    } catch (error) {
      this.logger.error(error, this.context);
      client.emit(RideEvents.ERROR, {
        message: 'Failed to update location',
      });
    }
  }

  async getActiveRideForPilot(client: Socket) {
    const cachedRide = await this.redis.getActiveRide(client.data.user.userId);
    if (cachedRide) {
      return cachedRide;
    }

    this.logger.log(`getActiveRideForPilot from cache\n`, this.context);

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
      );

      return rideData;
    }

    return null;
  }

  async cacheBookingStatus(bookingId: string, status: string) {
    return this.redis.setBookingStatus(bookingId, status);
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

  async getRideDetails(bookingId: string) {
    try {
      const booking: any = await this.prisma.booking.findUnique({
        where: { id: bookingId },
        select: {
          id: true,
          bookingCode: true,
          rideType: true,
          name: true,
          status: true,
          estimatedDuration: true,
          tripStart: true,
          customerId: true,
          estimatedFare: true,
          discountedFare: true,
          pickupLocation: true,
          dropLocation: true,
          customer: {
            select: {
              userId: true,
              name: true,
              phone: true,
              averageRating: true,
              coupon: {
                select: {
                  id: true,
                  name: true,
                  discount: true,
                  validUntil: true,
                  createdAt: true,
                },
              },
            },
          },
          pilot: {
            select: {
              id: true,
              selfieUrl: true,
              phone: true,
              userId: true,
              vehicle: {
                select: {
                  regNo: true,
                  model: true,
                  colour: true,
                  vehicleTypeBD: {
                    select: {
                      name: true,
                    },
                  },
                },
              },
              averageRating: true,
              drivingLicense: {
                select: {
                  nameOnLicense: true,
                },
              },
            },
          },
        },
      });
      if (!booking) {
        throw new NotFoundException('Booking not found.');
      }

      const pilotLocation = booking.pilot
        ? await this.redis.geoPos(
            RedisKeys.PILOT_LOCATION,
            booking.pilot.userId,
          )
        : [null, null];

      if (booking?.customer?.coupon?.discount) {
        booking.customer.coupon.discount = Number(
          booking.customer.coupon.discount,
        );
      }

      const data: CustomerRidePayload = {
        bookingId: booking.id,
        bookingCode: booking.bookingCode,
        bookingStatus: booking.status,
        estimatedDuration: booking.estimatedDuration,
        tripStart: booking.tripStart,
        pilot: booking.pilot
          ? {
              pilotId: booking.pilot.id,
              pilotName: booking.pilot.drivingLicense.nameOnLicense,
              profilePicture: booking.pilot.selfieUrl,
              pilotPhone: booking.pilot.phone,
              rating: booking.pilot.averageRating,
              pilotLocation: {
                lat: pilotLocation[0],
                lng: pilotLocation[1],
              },
              vehicleNumber: booking.pilot.vehicle.regNo,
              model: booking.pilot.vehicle.model,
              colour: booking.pilot.vehicle.colour,
              vehicleType: booking.pilot.vehicle.vehicleTypeBD.name,
            }
          : null,
        passenger: {
          passengerId: booking.customer.userId,
          name: booking.customer.name,
          phone: booking.customer.phone,
          rating: booking.customer.averageRating,
        },
        pickupInMinutes: randomInt(1, 4),
        pickupLocation: booking.pickupLocation,
        dropLocation: booking.dropLocation,
        fairDetails: {
          originalFare: Math.ceil(Number(booking.estimatedFare)),
          discountedFare: Math.ceil(Number(booking.discountedFare)),
          coupon: booking.customer.coupon,
        },
        otherPassengerInfo:
          booking.rideType === RideType.OTHERS ? { name: booking.name } : null,
      };

      return {
        message: 'Ride details fetched successfully',
        data,
      };
    } catch (error) {
      this.logger.error(error, this.context);
      throw error;
    }
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

    let booking: any;
    let originalPrice: number;
    let customer: any;
    let distanceKm: number;
    let durationMin: number;

    try {
      customer = await this.prisma.customer.findUnique({
        where: { userId },
        include: { coupon: true, activeBooking: true },
      });
      if (!customer) {
        throw new NotFoundException('Customer not found');
      }

      const vehicleType = await this.prisma.vehicleTypeBD.findUnique({
        where: { id: vehicleTypeId },
      });
      if (!vehicleType) {
        throw new NotFoundException('Vehicle type not found');
      }

      // Add validation for vehicleType properties
      if (
        !vehicleType.baseFare ||
        !vehicleType.perMinRate ||
        !vehicleType.minFare ||
        !vehicleType.perKmRate
      ) {
        throw new BadRequestException(
          'Vehicle type configuration is incomplete',
        );
      }

      // Check active booking
      const activeBooking =
        customer.activeBookingId &&
        (customer.activeBooking.status === BookingStatus.ACCEPTED ||
          customer.activeBooking.status === BookingStatus.ARRIVED ||
          customer.activeBooking.status === BookingStatus.ONGOING);
      if (activeBooking)
        throw new BadRequestException(
          'You already have an active ride request',
        );

      const origin = { lat: pickupLocation.lat, lng: pickupLocation.lng };
      const destination = { lat: dropLocation.lat, lng: dropLocation.lng };

      const distanceDuration =
        await this.fareService.calculateDistanceAndDuration(
          origin,
          destination,
        );

      distanceKm = distanceDuration.distanceKm;
      durationMin = distanceDuration.durationMin;

      originalPrice = this.fareService.estimateFare(
        distanceKm,
        durationMin,
        Number(vehicleType.baseFare),
        Number(vehicleType.perMinRate),
        Number(vehicleType.minFare),
        vehicleType.name,
        Number(vehicleType.perKmRate),
      );

      let discount: number = Number(customer.coupon?.discount || 0);
      if (!discount) {
        discount = 0;
      }

      const discountedPrice =
        discount && originalPrice > discount
          ? originalPrice - discount
          : originalPrice;

      const price = Math.max(discountedPrice, Number(vehicleType.minFare));

      const result = await this.prisma.$transaction(async (tx) => {
        // Create the booking
        const newBooking = await tx.booking.create({
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

        // Update customer's activeBookingId
        await tx.customer.update({
          where: { id: customer.id },
          data: { activeBookingId: newBooking.id },
        });

        return newBooking;
      });

      booking = result;

      const payload: RideRequestPayload = {
        userId: customer.userId,
        bookingId: booking.id,
        estimatedFare: booking.estimatedFare,
        discountedFare: booking.discountedFare,
        vehicleTypeId,
        distanceKm,
        durationMin,
        pickupLocation,
        dropLocation,
      };

      this.handleRideRequest(payload);

      const data: CustomerRidePayload = {
        bookingCode: booking.bookingCode,
        bookingId: booking.id,
        bookingStatus: booking.status,
        estimatedDuration: booking.estimatedDuration,
        tripStart: booking.tripStart,
        pilot: null,
        passenger: {
          passengerId: customer.userId,
          name: customer.name,
          phone: customer.phone,
          rating: customer.averageRating,
        },
        pickupInMinutes: null,
        pickupLocation: booking.pickupLocation,
        dropLocation: booking.dropLocation,
        fairDetails: {
          originalFare: Math.ceil(Number(originalPrice)),
          discountedFare: Math.ceil(Number(price)),
          coupon: customer.coupon || null,
        },
        otherPassengerInfo:
          booking.rideType === RideType.OTHERS
            ? { name: otherPassengerInfo?.name }
            : null,
      };

      return {
        success: true,
        message: 'Ride request created successfully.',
        data,
      };
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  async rideRequestAgain(
    rideRequestAgainDto: RideRequestAgainDto,
    userId: string,
  ) {
    const { bookingId } = rideRequestAgainDto;

    try {
      const customer = await this.prisma.customer.findUnique({
        where: { userId },
        select: { id: true },
      });
      if (!customer) {
        throw new NotFoundException('Customer not found');
      }

      const booking: any = await this.prisma.booking.findUnique({
        where: { id: bookingId },
        select: {
          rideType: true,
          estimatedFare: true,
          discountedFare: true,
          estimatedDistance: true,
          estimatedDuration: true,
          pickupLocation: true,
          dropLocation: true,
          name: true,
          vehicleId: true,
          customer: {
            select: {
              id: true,
              userId: true,
              name: true,
              phone: true,
              averageRating: true,
              coupon: true,
            },
          },
        },
      });
      if (!booking) {
        throw new NotFoundException('Booking not found.');
      }
      if (!booking.vehicleId) {
        throw new BadRequestException(
          'Cannot book again from a ride that was never accepted by a pilot. Please create a new ride request.',
        );
      }

      const vehicle = await this.prisma.vehicle.findUnique({
        where: { id: booking.vehicleId },
        select: {
          vehicleTypeBD: {
            select: {
              id: true,
              name: true,
              baseFare: true,
              perKmRate: true,
              perMinRate: true,
              minFare: true,
            },
          },
        },
      });

      // Check active booking
      const activeBooking = await this.prisma.booking.findFirst({
        where: {
          customerId: booking.customer.id,
          status: {
            in: [
              BookingStatus.ACCEPTED,
              BookingStatus.ARRIVED,
              BookingStatus.ONGOING,
            ],
          },
        },
      });
      if (activeBooking)
        throw new BadRequestException(
          'You already have an active ride request',
        );

      const origin = {
        lat: booking.pickupLocation.lat,
        lng: booking.pickupLocation.lng,
      };
      const destination = {
        lat: booking.dropLocation.lat,
        lng: booking.dropLocation.lng,
      };

      const { distanceKm, durationMin } =
        await this.fareService.calculateDistanceAndDuration(
          origin,
          destination,
        );

      const originalPrice = this.fareService.estimateFare(
        distanceKm,
        durationMin,
        Number(vehicle.vehicleTypeBD.baseFare),
        Number(vehicle.vehicleTypeBD.perMinRate),
        Number(vehicle.vehicleTypeBD.minFare),
        vehicle.vehicleTypeBD.name,
        Number(vehicle.vehicleTypeBD.perKmRate),
      );

      const coupon = booking.customer.coupon;
      if (coupon && isNaN(Number(coupon.discount))) {
        throw new BadRequestException('Invalid coupon discount');
      }

      let discount: number = Number(coupon.discount);
      if (!discount) {
        discount = 0;
      }

      const discountedPrice =
        discount && originalPrice > discount
          ? originalPrice - discount
          : originalPrice;

      const price = Math.max(
        discountedPrice,
        Number(vehicle.vehicleTypeBD.minFare),
      );

      const newBooking = await this.prisma.booking.create({
        data: {
          bookingCode: randomInt(1000, 10000).toString(),
          customerId: booking.customer.id,
          name:
            booking.rideType === RideType.SELF
              ? booking.customer.name
              : booking.name,
          status: BookingStatus.PENDING,
          rideType: booking.rideType,
          estimatedFare: Math.ceil(originalPrice),
          discountedFare: Math.ceil(price),
          pickupLocation: JSON.parse(JSON.stringify(booking.pickupLocation)),
          dropLocation: JSON.parse(JSON.stringify(booking.dropLocation)),
          estimatedDistance: Math.ceil(distanceKm).toString(),
          estimatedDuration: Math.ceil(durationMin),
        },
      });

      const payload: RideRequestPayload = {
        userId: booking.customer.userId,
        bookingId: newBooking.id,
        estimatedFare: newBooking.estimatedFare,
        discountedFare: newBooking.discountedFare,
        vehicleTypeId: vehicle.vehicleTypeBD.id,
        distanceKm: Number(newBooking.estimatedDistance),
        durationMin: Number(newBooking.estimatedDuration),
        pickupLocation: booking.pickupLocation,
        dropLocation: booking.dropLocation,
      };

      this.handleRideRequest(payload);

      // Create CustomerRidePayload for consistent response structure
      const data: CustomerRidePayload = {
        bookingCode: newBooking.bookingCode,
        bookingId: newBooking.id,
        bookingStatus: newBooking.status, // PENDING
        estimatedDuration: newBooking.estimatedDuration,
        tripStart: newBooking.tripStart, // null for new bookings
        pilot: null, // No pilot assigned yet for PENDING bookings
        passenger: {
          passengerId: booking.customer.userId,
          name: booking.customer.name,
          phone: booking.customer.phone,
          rating: booking.customer.averageRating,
        },
        pickupInMinutes: null, // Will be calculated when pilot accepts
        pickupLocation: newBooking.pickupLocation,
        dropLocation: newBooking.dropLocation,
        fairDetails: {
          originalFare: Math.ceil(Number(newBooking.estimatedFare)),
          discountedFare: Math.ceil(Number(newBooking.discountedFare)),
          coupon: coupon || null,
        },
        otherPassengerInfo:
          newBooking.rideType === RideType.OTHERS
            ? { name: newBooking.name }
            : null,
      };

      return {
        success: true,
        message:
          'Your ride request is being processed. Searching for a driver...',
        data,
      };
    } catch (error) {
      this.logger.error(error, this.context);
      throw error;
    }
  }

  async handleRideRequest(payload: RideRequestPayload) {
    try {
      const search = await this.driverSearchService.searchDrivers(payload);
      return search;
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
        select: {
          id: true,
          userId: true,
          selfieUrl: true,
          phone: true,
          averageRating: true,
          drivingLicense: { select: { id: true, nameOnLicense: true } },
          vehicle: {
            select: {
              id: true,
              regNo: true,
              model: true,
              colour: true,
              vehicleTypeBD: { select: { name: true } },
            },
          },
        },
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
            acceptedAt: moment.utc().toDate(),
            vehicleId: pilot.vehicle.id,
          },
          select: {
            id: true,
            status: true,
            rideType: true,
            name: true,
            bookingCode: true,
            estimatedFare: true,
            estimatedDuration: true,
            discountedFare: true,
            pickupLocation: true,
            dropLocation: true,
            customer: {
              select: {
                userId: true,
                name: true,
                email: true,
                phone: true,
                averageRating: true,
                activeBookingId: true,
                coupon: true,
              },
            },
          },
        });

        await tx.customer.update({
          where: { id: booking.customerId },
          data: { activeBookingId: booking.id },
        });

        return { updated };
      });

      const pilotLocation = await this.redis.geoPos(
        RedisKeys.PILOT_LOCATION,
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

      // const vehicleId = await this.redis.get(
      //   `${RedisKeys.BOOKING_VEHICLE}${bookingId}:${pilot.userId}`,
      // );
      // const vehicle = vehicleId
      //   ? await this.prisma.vehicle.findUnique({
      //       where: { id: vehicleId },
      //       include: { vehicleTypeBD: true },
      //     })
      //   : null;

      await this.redis.del(`${RedisKeys.NOTIFIED}${bookingId}:${pilot.userId}`);
      await this.redis.del(`${RedisKeys.RIDE_ACCEPTED}${bookingId}`);

      // Cache active ride in Redis
      await this.redis.setActiveRide(
        pilot.userId,
        result.updated.id,
        result.updated.customer.userId,
      );

      await this.redis.publish(
        `booking:${bookingId}:status`,
        JSON.stringify(BookingStatus.ACCEPTED),
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
        tripStart: null,
        pilot: {
          pilotId: pilot.id,
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
          vehicleType: pilot.vehicle.vehicleTypeBD.name,
        },
        passenger: {
          passengerId: result.updated.customer.userId,
          name: result.updated.customer.name,
          phone: result.updated.customer.phone,
          rating: result.updated.customer.averageRating,
        },
        pickupInMinutes,
        pickupLocation: result.updated.pickupLocation,
        dropLocation: result.updated.dropLocation,
        fairDetails: {
          originalFare: Math.ceil(Number(result.updated.estimatedFare)),
          discountedFare: Math.ceil(Number(result.updated.discountedFare)),
          coupon: couponForPayload,
        },
        otherPassengerInfo:
          result.updated.rideType === RideType.OTHERS
            ? { name: result.updated.name }
            : null,
      };

      // rideAccepted event triggered for customer
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

      await this.redis.setBookingStatus(bookingId, BookingStatus.ACCEPTED);

      return {
        message: 'Ride accepted successfully.',
        data,
      };
    } catch (error) {
      console.log('errorInAcceptRide', error);
      this.logger.error(error, this.context);
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
        data: {
          status: BookingStatus.ARRIVED,
          arrivedAt: moment.utc().toDate(),
        },
      });

      await this.redis.publish(
        `booking:${bookingId}:status`,
        JSON.stringify(BookingStatus.ARRIVED),
      );

      // Emit reachedPickupPoint event to customer
      await this.rideNotificationService.notifyReachedPickupPoint(
        booking.customer.userId,
        bookingId,
        BookingStatus.ARRIVED,
      );

      await this.redis.setBookingStatus(bookingId, BookingStatus.ARRIVED);

      return {
        message: 'Reached pickup point successfully.',
      };
    } catch (error) {
      this.logger.error(error, this.context);
      throw error;
    }
  }

  async startRide(startRideDto: StartRideDto, userId: string) {
    const { bookingId, bookingCode } = startRideDto;

    try {
      const pilot = await this.prisma.pilot.findUnique({
        where: { userId },
        select: { id: true },
      });
      if (!pilot) {
        throw new NotFoundException('Pilot not found.');
      }

      const booking = await this.prisma.booking.findUnique({
        where: { id: bookingId, pilotId: pilot.id },
        select: { id: true, bookingCode: true, customerId: true },
      });

      if (!booking || booking.bookingCode !== bookingCode) {
        throw new BadRequestException('Invalid otp.');
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
          data: {
            status: BookingStatus.ONGOING,
            tripStart: moment.utc().toDate(),
          },
          select: {
            id: true,
            name: true,
            status: true,
            rideType: true,
            bookingCode: true,
            estimatedDuration: true,
            pickupLocation: true,
            dropLocation: true,
            estimatedFare: true,
            discountedFare: true,
            tripStart: true,
            customer: {
              select: {
                userId: true,
                name: true,
                phone: true,
                averageRating: true,
                coupon: true,
              },
            },
            pilot: {
              select: {
                id: true,
                userId: true,
                selfieUrl: true,
                phone: true,
                averageRating: true,
                drivingLicense: { select: { nameOnLicense: true } },
                vehicle: {
                  select: {
                    regNo: true,
                    model: true,
                    colour: true,
                    vehicleTypeBD: { select: { name: true } },
                  },
                },
              },
            },
          },
        });

        return { updated };
      });

      await this.redis.publish(
        `booking:${bookingId}:status`,
        JSON.stringify(BookingStatus.ONGOING),
      );

      await this.redis.setBookingStatus(bookingId, BookingStatus.ONGOING);

      const pilotLocation = await this.redis.geoPos(
        RedisKeys.PILOT_LOCATION,
        result.updated.pilot.userId,
      );

      const payload: CustomerRidePayload = {
        bookingCode: result.updated.bookingCode,
        bookingId: result.updated.id,
        bookingStatus: result.updated.status,
        estimatedDuration: result.updated.estimatedDuration,
        tripStart: result.updated.tripStart,
        pilot: {
          pilotId: result.updated.pilot.id,
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
          vehicleType: result.updated.pilot.vehicle.vehicleTypeBD.name,
        },
        passenger: {
          passengerId: result.updated.customer.userId,
          name: result.updated.customer.name,
          phone: result.updated.customer.phone,
          rating: result.updated.customer.averageRating,
        },
        pickupInMinutes: null,
        pickupLocation: result.updated.pickupLocation,
        dropLocation: result.updated.dropLocation,
        fairDetails: {
          originalFare: Math.ceil(Number(result.updated.estimatedFare)),
          discountedFare: Math.ceil(Number(result.updated.discountedFare)),
          coupon: result.updated.customer.coupon,
        },
        otherPassengerInfo:
          result.updated.rideType === RideType.OTHERS
            ? { name: result.updated.name }
            : null,
      };

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
      this.logger.error(error, this.context);
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
        select: {
          id: true,
          bookingCode: true,
          customerId: true,
          discountedFare: true,
        },
      });
      if (!booking) {
        throw new BadRequestException('Invalid Booking.');
      }

      const result = await this.prisma.$transaction(async (tx) => {
        const tripCount = pilot.totalTrips ? pilot.totalTrips + 1 : 1;

        const updatedPilot = await tx.pilot.update({
          where: { id: pilot.id },
          data: {
            activeBookingId: null,
            totalTrips: tripCount,
            onlineStatus: PilotStatus.AVAILABLE,
          },
          select: {
            wallet: {
              select: { id: true, todaysEarning: true, date: true },
            },
          },
        });

        await tx.customer.update({
          where: { id: booking.customerId },
          data: { activeBookingId: null },
        });

        const updated: any = await tx.booking.update({
          where: { id: bookingId },
          data: {
            status: BookingStatus.COMPLETED,
            tripEnd: moment.utc().toDate(),
            tripEndFare: booking.discountedFare,
          },
          select: {
            id: true,
            name: true,
            status: true,
            rideType: true,
            bookingCode: true,
            estimatedDuration: true,
            estimatedFare: true,
            discountedFare: true,
            tripEndFare: true,
            tripStart: true,
            pickupLocation: true,
            dropLocation: true,
            customer: {
              select: {
                userId: true,
                name: true,
                phone: true,
                averageRating: true,
                coupon: true,
              },
            },
            pilot: {
              select: {
                id: true,
                drivingLicense: true,
                selfieUrl: true,
                phone: true,
                averageRating: true,
                vehicle: {
                  select: {
                    regNo: true,
                    model: true,
                    colour: true,
                    vehicleTypeBD: {
                      select: {
                        name: true,
                      },
                    },
                  },
                },
                wallet: {
                  select: {
                    id: true,
                  },
                },
              },
            },
          },
        });

        const tripAmount = Math.ceil(Number(updated.tripEndFare));

        await tx.pilotTrips.create({
          data: {
            pilotId: pilot.id,
            date: moment.utc().toDate(),
            amount: tripAmount,
            bookingId,
          },
        });

        // Remove active ride
        await this.redis.removeActiveRide(pilot.userId);

        // Currently for Dhaka
        const nowDhaka = moment().tz('Asia/Dhaka'); // current time in Dhaka
        const startOfToday = nowDhaka.clone().startOf('day').toDate();
        const endOfToday = nowDhaka.clone().endOf('day').toDate();

        const todayEarnings = await tx.pilotTrips.aggregate({
          _sum: {
            amount: true,
          },
          where: {
            pilotId: pilot.id,
            date: {
              gte: startOfToday,
              lte: endOfToday,
            },
          },
        });

        const todaysEarningValue = todayEarnings._sum.amount || 0;

        const wallet = await tx.pilotWallet.findUnique({
          where: { pilotId: pilot.id },
          select: { id: true, balance: true },
        });

        await tx.pilotWallet.update({
          where: { pilotId: pilot.id },
          data: {
            balance: {
              decrement: tripAmount,
            },
            todaysEarning: todaysEarningValue,
            lastTripEarning: tripAmount,
            date: nowDhaka.toDate(),
          },
        });

        await tx.transaction.create({
          data: {
            pilotId: pilot.id,
            amount: tripAmount,
            walletId: wallet.id,
            type: TransactionType.TRIP_DEDUCTION,
            status: TransactionStatus.SUCCESSFUL,
            balanceBefore: Math.ceil(Number(wallet.balance)),
            balanceAfter: Math.ceil(Number(wallet.balance) - tripAmount),
          },
        });

        return { updated };
      });

      await this.redis.setBookingStatus(bookingId, BookingStatus.COMPLETED);

      await this.redis.publish(
        `booking:${bookingId}:status`,
        JSON.stringify(BookingStatus.COMPLETED),
      );

      /// *** Auto recharge logic ***
      // Check balance for auto recharge
      const updatedWallet = await this.prisma.pilotWallet.findUnique({
        where: { pilotId: pilot.id },
        select: { id: true, balance: true },
      });
      const newBalance = Number(updatedWallet.balance);

      // Get bonus threshold from config
      const bonusConfig = await this.prisma.systemConfig.findUnique({
        where: { key: this.bonusRechargeThreshold },
      });
      const threshold = Number(bonusConfig?.value['amount'] ?? 300);

      // Check if balance is below threshold
      if (newBalance < threshold) {
        await this.prisma.pilotWallet.update({
          where: { pilotId: pilot.id },
          data: {
            autoRechargeEnabled: true,
          },
        });

        await this.rideNotificationService.notifyLowBalance(pilot.userId);
      }
      /// *** End of auto recharge logic ***

      if (result.updated.customer.coupon) {
        result.updated.customer.coupon.discount = Number(
          result.updated.customer.coupon.discount,
        );
      }

      const payload: CustomerRidePayload = {
        bookingCode: result.updated.bookingCode,
        bookingId: result.updated.id,
        bookingStatus: result.updated.status,
        estimatedDuration: result.updated.estimatedDuration,
        tripStart: result.updated.tripStart,
        pilot: {
          pilotId: result.updated.pilot.id,
          pilotName: result.updated.pilot.drivingLicense.nameOnLicense,
          profilePicture: result.updated.pilot.selfieUrl,
          pilotPhone: result.updated.pilot.phone,
          rating: result.updated.pilot.averageRating,
          pilotLocation: null,
          vehicleNumber: result.updated.pilot.vehicle.regNo,
          model: result.updated.pilot.vehicle.model,
          colour: result.updated.pilot.vehicle.colour,
          vehicleType: result.updated.pilot.vehicle.vehicleTypeBD.name,
        },
        passenger: {
          passengerId: result.updated.customer.userId,
          name: result.updated.customer.name,
          phone: result.updated.customer.phone,
          rating: result.updated.customer.averageRating,
        },
        pickupInMinutes: null,
        pickupLocation: result.updated.pickupLocation,
        dropLocation: result.updated.dropLocation,
        fairDetails: {
          originalFare: Math.ceil(Number(result.updated.estimatedFare)),
          discountedFare: Math.ceil(Number(result.updated.discountedFare)),
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
      this.logger.error(error, this.context);
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
        select: {
          status: true,
          pilotId: true,
          customerId: true,
          customer: {
            select: {
              userId: true,
            },
          },
          pilot: {
            select: {
              userId: true,
            },
          },
        },
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

      if (
        booking.customer.userId === userId &&
        booking.status === BookingStatus.ONGOING
      ) {
        throw new BadRequestException(
          'Cannot cancel an ongoing ride. Please contact support.',
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

        const alreadyCancelled = await tx.cancellationReason.findUnique({
          where: {
            bookingId,
          },
        });

        if (!alreadyCancelled) {
          await tx.cancellationReason.create({
            data: {
              bookingId: bookingId,
              reason: reason,
              cancelledBy,
            },
          });
        }

        if (booking.pilotId) {
          await tx.pilot.update({
            where: { id: booking.pilotId },
            data: {
              activeBookingId: null,
              onlineStatus: PilotStatus.AVAILABLE,
            },
          });
        }

        if (booking.customerId) {
          await tx.customer.update({
            where: { id: booking.customerId },
            data: { activeBookingId: null },
          });
        }
      });

      // Cache booking status in Redis
      await this.redis.setBookingStatus(bookingId, BookingStatus.CANCELLED);

      await this.redis.publish(
        `booking:${bookingId}:status`,
        JSON.stringify(BookingStatus.CANCELLED),
      );

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
      this.logger.error(error, this.context);
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
          id: true,
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
              vehicleTypeBD: {
                select: {
                  name: true,
                  baseFare: true,
                  perKmRate: true,
                  perMinRate: true,
                  minFare: true,
                },
              },
            },
          },
        },
      });

      let distanceKm: number;
      let durationMin: number;
      let pickupInMinutes: number = 0;

      const pilotLocation = await this.redis.geoPos(
        RedisKeys.PILOT_LOCATION,
        pilot.userId,
      );

      let lat: number;
      let lng: number;
      if (pilotLocation) {
        [lat, lng] = pilotLocation;
      }

      console.log('***PilotLocationEdit***', pilotLocation, lat, lng);

      if (pickupLocation) {
        let newDistanceDuration: any;
        if (pilotLocation) {
          newDistanceDuration =
            await this.fareService.calculateDistanceAndDuration(
              { lat, lng },
              pickupLocation,
            );

          pickupInMinutes = Math.ceil(newDistanceDuration.durationMin);
        } else {
          pickupInMinutes = randomInt(1, 4);
        }

        distanceKm = newDistanceDuration.distanceKm;
        durationMin = newDistanceDuration.durationMin;
      } else if (dropLocation) {
        const newDistanceAndDuration =
          await this.fareService.calculateDistanceAndDuration(
            booking.pickupLocation,
            dropLocation,
          );

        distanceKm = newDistanceAndDuration.distanceKm;
        durationMin = newDistanceAndDuration.durationMin;
      } else if (pickupLocation && dropLocation) {
        const newDistanceDuration =
          await this.fareService.calculateDistanceAndDuration(
            pickupLocation,
            dropLocation,
          );

        pickupInMinutes = Math.ceil(newDistanceDuration.durationMin);

        distanceKm = newDistanceDuration.distanceKm;
        durationMin = newDistanceDuration.durationMin;
      }

      const originalPrice = this.fareService.estimateFare(
        distanceKm,
        durationMin,
        Number(pilot?.vehicle?.vehicleTypeBD.baseFare),
        Number(pilot?.vehicle?.vehicleTypeBD.perMinRate),
        Number(pilot?.vehicle?.vehicleTypeBD.minFare),
        pilot?.vehicle?.vehicleTypeBD.name,
        Number(pilot?.vehicle?.vehicleTypeBD.perKmRate),
      );

      const coupon = customer?.coupon;
      if (coupon && isNaN(Number(coupon.discount))) {
        throw new BadRequestException('Invalid coupon discount');
      }

      let discount = Number(coupon?.discount);
      if (!discount) {
        discount = 0;
      }

      const discountedPrice =
        discount && originalPrice > discount
          ? originalPrice - discount
          : originalPrice;

      const price = Math.max(
        discountedPrice,
        Number(pilot?.vehicle?.vehicleTypeBD.minFare),
      );

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

      if (coupon) {
        coupon.discount = Number(coupon.discount);
      }

      const data: CustomerRidePayload = {
        bookingCode: updatedBooking.bookingCode,
        bookingId: updatedBooking.id,
        bookingStatus: updatedBooking.status,
        estimatedDuration: updatedBooking.estimatedDuration,
        tripStart: updatedBooking.tripStart,
        pilot: {
          pilotId: pilot.id,
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
          vehicleType: pilot.vehicle.vehicleTypeBD.name,
        },
        passenger: {
          passengerId: customer.userId,
          name: customer.name,
          phone: customer.phone,
          rating: customer.averageRating,
        },
        pickupInMinutes: pickupInMinutes,
        pickupLocation: updatedBooking.pickupLocation,
        dropLocation: updatedBooking.dropLocation,
        fairDetails: {
          originalFare: Number(updatedBooking.estimatedFare),
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
      this.logger.error(error, this.context);
      throw error;
    }
  }

  async ratingRide(
    ratingRideDto: RatingRideDto,
    userId: string,
    role: UserRole,
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
      if (role === UserRole.PILOT) {
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

        const ratings = await this.prisma.pilotRating.findMany({
          where: { pilotId: pilot.id },
          select: { rating: true },
        });

        const averageRating =
          ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length;

        await this.prisma.pilot.update({
          where: { id: pilot.id },
          data: { averageRating: parseFloat(averageRating.toFixed(2)) },
        });

        return {
          message: 'Rating has been submitted',
          data: ratingRecord,
        };
      } else if (role === UserRole.CUSTOMER) {
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

        const ratings = await this.prisma.customerRating.findMany({
          where: { customerId: customer.id },
          select: { rating: true },
        });

        const averageRating =
          ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length;

        await this.prisma.customer.update({
          where: { id: customer.id },
          data: { averageRating: parseFloat(averageRating.toFixed(2)) },
        });

        return {
          message: 'Rating has been submitted',
          data: ratingRecord,
        };
      }

      throw new BadRequestException('Invalid role specified.');
    } catch (error) {
      this.logger.error(error, this.context);
      throw error;
    }
  }

  async getRideHistory(
    userId: string,
    startDate: string,
    endDate: string,
    page: number,
    pageSize: number,
  ) {
    try {
      const pilot = await this.prisma.pilot.findUnique({
        where: { userId },
        select: { id: true },
      });
      if (!pilot) {
        throw new NotFoundException('Pilot not found.');
      }

      const start = moment.utc(startDate);
      const end = moment.utc(endDate);

      if (!start.isValid() || !end.isValid()) {
        throw new BadRequestException('Invalid start or end date.');
      }
      if (start.isAfter(end)) {
        throw new BadRequestException('startDate must be before endDate');
      }

      const whereClause = {
        pilotId: pilot.id,
        OR: [
          {
            tripStart: {
              gte: start.toDate(),
              lte: end.toDate(),
            },
          },
          {
            createdAt: {
              gte: start.toDate(),
              lte: end.toDate(),
            },
          },
        ],
      };

      const skip = (page - 1) * pageSize;

      const [bookings, total]: any = await Promise.all([
        this.prisma.booking.findMany({
          where: whereClause,
          select: {
            pickupLocation: true,
            dropLocation: true,
            tripStart: true,
            tripEnd: true,
            estimatedDistance: true,
            discountedFare: true,
            status: true,
            createdAt: true,
            cancellationReason: {
              select: {
                cancelledBy: true,
              },
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
          skip,
          take: pageSize,
        }),
        this.prisma.booking.count({
          where: whereClause,
        }),
      ]);

      let totalEarning: number = 0;
      let tripDurationInMinutes: number;
      bookings.map((booking) => {
        booking.estimatedDistance = Math.ceil(
          Number(booking.estimatedDistance),
        );
        booking.discountedFare = Math.ceil(Number(booking.discountedFare));

        if (booking.status === BookingStatus.COMPLETED) {
          totalEarning += booking.discountedFare;
        }

        const start = moment.utc(booking.tripStart);
        const end = moment.utc(booking.tripEnd);
        tripDurationInMinutes = end.diff(start, 'minutes');
        booking.tripDurationInMinutes = tripDurationInMinutes;
      });

      const totalPages = Math.ceil(total / pageSize);
      const hasNextPage = page < totalPages;
      const hasPrevPage = page > 1;

      this.logger.log(`totalEarning ${totalEarning}`, this.context);

      return {
        message: 'Ride history fetched successfully',
        data: {
          totalEarning,
          bookings,
          pagination: {
            totalItems: total,
            currentPage: page,
            pageSize,
            hasNextPage,
            hasPrevPage,
          },
        },
      };
    } catch (error) {
      this.logger.error(error, this.context);
      throw error;
    }
  }

  async getMyTrips(
    userId: string,
    status: BookingStatus,
    page: number,
    pageSize: number,
  ) {
    try {
      const customer: any = await this.prisma.customer.findUnique({
        where: { userId },
        select: { id: true, coupon: true },
      });
      if (!customer) {
        throw new NotFoundException('Customer not found.');
      }

      const skip = (page - 1) * pageSize;

      const [bookings, total]: any = await Promise.all([
        this.prisma.booking.findMany({
          where: {
            customerId: customer.id,
            status,
            ...(status !== BookingStatus.PENDING && {
              vehicleId: { not: null },
            }),
          },
          select: {
            id: true,
            name: true,
            rideType: true,
            pickupLocation: true,
            dropLocation: true,
            tripStart: true,
            discountedFare: true,
            status: true,
            estimatedFare: true,
            createdAt: true,
            vehicle: {
              select: {
                vehicleTypeBD: { select: { name: true } },
              },
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
          skip,
          take: pageSize,
        }),
        this.prisma.booking.count({
          where: {
            customerId: customer.id,
            status,
          },
        }),
      ]);

      if (customer.coupon) {
        customer.coupon.discount = Number(customer.coupon.discount);
      }

      const totalPages = Math.ceil(total / pageSize);
      const hasNextPage = page < totalPages;
      const hasPrevPage = page > 1;

      const transformedBookings = bookings.map((booking) => {
        const {
          id,
          status,
          name,
          rideType,
          discountedFare,
          estimatedFare,
          ...rest
        } = booking;

        const fairDetails = {
          originalFare: Math.ceil(Number(estimatedFare)),
          discountedFare: Math.ceil(Number(discountedFare)),
          coupon: customer.coupon,
        };

        const pilot = {
          vehicleType: booking.vehicle?.vehicleTypeBD?.name,
        };

        return {
          ...rest,
          bookingId: id,
          bookingStatus: status,
          fairDetails,
          otherPassengerInfo: rideType === RideType.OTHERS ? { name } : null,
          pilot,
        };
      });

      const data = {
        bookings: transformedBookings,
        pagination: {
          totalItems: total,
          currentPage: page,
          pageSize,
          hasNextPage,
          hasPrevPage,
        },
      };

      return {
        message: 'My trips fetched successfully',
        data,
      };
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  // private async newDistanceAndDuration(
  //   origin: LocationDto,
  //   destination: LocationDto,
  // ): Promise<{ distanceKm: number; durationMin: number }> {
  //   const { distanceKm, durationMin } =
  //     await this.fareService.calculateDistanceAndDuration(origin, destination);

  //   return { distanceKm, durationMin };
  // }
}
