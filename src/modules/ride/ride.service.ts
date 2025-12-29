import { randomInt } from 'node:crypto';
import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from 'src/core/database/database.service';
import {
  Booking,
  BookingStatus,
  CancelledBy,
  PilotType,
  ProgramType,
  RankingPeriod,
  RideType,
  TransactionStatus,
  TransactionType,
  VehicleTypeNameBD,
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
import { DriverSearchService } from './services/driver-search.service';
import { ProgramService } from '../program/program.service';
import { MetricsService } from 'src/core/metrics/metrics.service';

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
    private readonly driverSearchService: DriverSearchService,
    private readonly programService: ProgramService,
    private readonly metrics: MetricsService,
    private readonly logger: LoggerService,
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
          estimatedDistance: true,
          tripStart: true,
          tripEnd: true,
          customerId: true,
          estimatedFare: true,
          discountedFare: true,
          pickupLocation: true,
          dropLocation: true,
          createdAt: true,
          cancellationReason: {
            select: {
              cancelledBy: true,
            },
          },
          vehicleTypeBD: {
            select: {
              id: true,
              name: true,
            },
          },
          pilotRating: {
            select: {
              rating: true,
              feedback: true,
            },
          },
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
              pilotType: true,
              vehicle: {
                select: {
                  regNo: true,
                  model: true,
                  colour: true,
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
        ? (await this.redis.geoPos(
            RedisKeys.PILOT_LOCATION,
            booking.pilot.userId,
          )) || [null, null]
        : [null, null];

      if (booking?.customer?.coupon?.discount) {
        booking.customer.coupon.discount = Number(
          booking.customer.coupon.discount,
        );
      }

      const tripDuration = this.calculateTripDuration(
        booking.tripStart,
        booking.tripEnd,
        booking.estimatedDuration,
      );

      const data: CustomerRidePayload = {
        bookingId: booking.id,
        bookingCode: booking.bookingCode,
        bookingStatus: booking.status,
        estimatedDuration: Number(booking.estimatedDuration),
        estimatedDistance: Number(booking.estimatedDistance),
        tripDuration: tripDuration,
        tripStart: booking.tripStart,
        vehicleType: booking.vehicleTypeBD?.name,
        vehicleTypeId: booking.vehicleTypeBD?.id,
        createdAt: booking.createdAt,
        cancelledBy: booking.cancellationReason
          ? booking.cancellationReason.cancelledBy
          : null,
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
              vehicleType: booking.vehicleTypeBD?.name,
              pilotType: booking.pilot.pilotType,
            }
          : null,
        rating: {
          forPilot: {
            rating: booking?.pilotRating?.rating || 0,
            feedback: booking?.pilotRating?.feedback || '',
          },
          forCustomer: null,
        },
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
    const startTime = Date.now();

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
      if (customer.activeBooking) {
        throw new BadRequestException('You already have an active booking');
      }

      const vehicleType = await this.prisma.vehicleTypeBD.findUnique({
        where: { id: vehicleTypeId },
        select: {
          id: true,
          name: true,
          baseFare: true,
          perMinRate: true,
          minFare: true,
          perKmRate: true,
          vehicle: {
            select: {
              id: true,
            },
          },
        },
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

      const fareCalculation = await this.fareService.calculateTariffBasedFare({
        pickupLocation,
        dropLocation,
        vehicleTypeName: vehicleType.name as VehicleTypeNameBD,
        customerCoupon: customer.coupon,
        intercity: false,
      });

      originalPrice = fareCalculation.originalPrice;
      distanceKm = fareCalculation.distanceKm;
      durationMin = fareCalculation.durationMin;
      const price = fareCalculation.finalPrice;

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
            vehicleTypeIdBD: vehicleType.id,
            baseFare: Number(fareCalculation.fareBreakdown.baseFare),
            distanceFare: Number(fareCalculation.fareBreakdown.distanceFare),
            durationFare: Number(fareCalculation.fareBreakdown.durationFare),
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

      this.logger.log(
        `[RIDE_REQUEST_INITIATED] Customer ${customer.phone} initiated ride request with vehicle type ${vehicleType.name}`,
        this.context,
      );

      this.handleRideRequest(payload);

      customer.coupon.discount = Number(customer.coupon.discount);

      const tripDuration = booking.tripEnd
        ? this.calculateTripDuration(
            booking.tripStart,
            booking.tripEnd,
            booking.estimatedDuration,
          )
        : booking.estimatedDuration;

      const data: CustomerRidePayload = {
        bookingCode: booking.bookingCode,
        bookingId: booking.id,
        bookingStatus: booking.status,
        estimatedDuration: Number(booking.estimatedDuration),
        estimatedDistance: Number(booking.estimatedDistance),
        tripDuration: tripDuration,
        tripStart: booking.tripStart,
        vehicleType: vehicleType.name,
        vehicleTypeId: vehicleType.id,
        createdAt: booking.createdAt,
        cancelledBy: null,
        pilot: null,
        rating: {
          forPilot: null,
          forCustomer: null,
        },
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

      this.metrics.rideBookings.inc({
        vehicle_type: vehicleType.name,
        city: 'dhaka', // Extract from location
        version: process.env.API_VERSION || 'v1',
      });

      // Log business event
      this.logger.logBusinessEvent('RIDE_BOOKING_CREATED', {
        bookingId: booking.id,
        customerId: customer.id,
        vehicleType: vehicleType.name,
        estimatedFare: booking.estimatedFare,
      });

      return {
        success: true,
        message: 'Ride request created successfully.',
        data,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.logError(error, 'RideService', {
        operation: 'createRideRequest',
      });
      throw error;
    } finally {
      const duration = Date.now() - startTime;
      this.logger.logPerformance('createRideRequest', duration, { userId });
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
        include: { coupon: true, activeBooking: true },
      });
      if (!customer) {
        throw new NotFoundException('Customer not found');
      }
      if (customer.activeBooking) {
        throw new BadRequestException('You already have an active booking');
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
          vehicleTypeIdBD: true,
          createdAt: true,
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

      if (customer.id !== booking.customerId) {
        throw new BadRequestException(
          'You are not authorized to request again for this booking.',
        );
      }

      const activeBooking =
        customer.activeBookingId &&
        (customer.activeBooking.status === BookingStatus.ACCEPTED ||
          customer.activeBooking.status === BookingStatus.ARRIVED ||
          customer.activeBooking.status === BookingStatus.ONGOING);
      if (activeBooking)
        throw new BadRequestException(
          'You already have an active ride request',
        );

      const fareCalculation = await this.fareService.calculateTariffBasedFare({
        pickupLocation: booking.pickupLocation,
        dropLocation: booking.dropLocation,
        vehicleTypeName: booking.vehicleTypeBD.name as VehicleTypeNameBD,
        customerCoupon: booking.customer.coupon || null,
        intercity: false,
      });

      const originalPrice = fareCalculation.originalPrice;
      const distanceKm = fareCalculation.distanceKm;
      const durationMin = fareCalculation.durationMin;
      const price = fareCalculation.finalPrice;

      const result = await this.prisma.$transaction(async (tx) => {
        // Create the new booking
        const newBooking = await tx.booking.create({
          data: {
            bookingCode: randomInt(1000, 10000).toString(),
            customerId: booking.customer.id,
            name:
              booking.rideType === RideType.SELF
                ? booking.customer.name
                : booking.name,
            status: BookingStatus.PENDING,
            rideType: booking.rideType,
            vehicleTypeIdBD: booking.vehicleTypeBD.id,
            estimatedFare: Math.ceil(originalPrice),
            discountedFare: Math.ceil(price),
            pickupLocation: JSON.parse(JSON.stringify(booking.pickupLocation)),
            dropLocation: JSON.parse(JSON.stringify(booking.dropLocation)),
            estimatedDistance: Math.ceil(distanceKm).toString(),
            estimatedDuration: Math.ceil(durationMin),
            baseFare: Number(fareCalculation.fareBreakdown.baseFare),
            distanceFare: Number(fareCalculation.fareBreakdown.distanceFare),
            durationFare: Number(fareCalculation.fareBreakdown.durationFare),
          },
        });

        // Update customer's activeBookingId
        await tx.customer.update({
          where: { id: booking.customer.id },
          data: { activeBookingId: newBooking.id },
        });

        return newBooking;
      });

      const newBooking = result;

      const payload: RideRequestPayload = {
        userId: booking.customer.userId,
        bookingId: newBooking.id,
        estimatedFare: newBooking.estimatedFare,
        discountedFare: newBooking.discountedFare,
        vehicleTypeId: booking.vehicleTypeBD.id,
        distanceKm: Number(newBooking.estimatedDistance),
        durationMin: Number(newBooking.estimatedDuration),
        pickupLocation: booking.pickupLocation,
        dropLocation: booking.dropLocation,
      };

      this.handleRideRequest(payload);

      booking.customer.coupon.discount =
        Number(booking.customer.coupon?.discount) || 0;

      const tripDuration = newBooking.tripEnd
        ? this.calculateTripDuration(
            newBooking.tripStart,
            newBooking.tripEnd,
            newBooking.estimatedDuration,
          )
        : newBooking.estimatedDuration;

      const data: CustomerRidePayload = {
        bookingCode: newBooking.bookingCode,
        bookingId: newBooking.id,
        bookingStatus: newBooking.status, // PENDING
        estimatedDuration: Number(newBooking.estimatedDuration),
        estimatedDistance: Number(newBooking.estimatedDistance),
        tripDuration: tripDuration,
        tripStart: newBooking.tripStart, // null for new bookings
        vehicleType: booking.vehicleTypeBD.name,
        vehicleTypeId: booking.vehicleTypeBD.id,
        createdAt: newBooking.createdAt,
        cancelledBy: null,
        pilot: null,
        rating: {
          forPilot: null,
          forCustomer: null,
        },
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
          coupon: booking.customer.coupon || null,
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
          onlineStatus: true,
          activeBookingId: true,
          averageRating: true,
          pilotType: true,
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
      if (pilot.onlineStatus !== PilotStatus.AVAILABLE) {
        throw new BadRequestException('Pilot is not available.');
      }

      if (pilot.activeBookingId) {
        throw new BadRequestException('Pilot already has an active booking.');
      }

      const cachedStatus = await this.redis.get(
        `${RedisKeys.BOOKING_STATUS}${bookingId}`,
      );
      if (cachedStatus && cachedStatus !== BookingStatus.PENDING) {
        throw new BadRequestException('Booking is no longer available.');
      }

      // const lockKey = `lock:accept:${bookingId}`;
      // const lockAcquired = await this.redis.set(lockKey, 'locked', 'EX', 10, 'NX');

      // if (!lockAcquired) {
      //   throw new BadRequestException('Another pilot is accepting this ride.');
      // }

      const result = await this.prisma.$transaction(async (tx) => {
        const booking = await tx.booking.findFirst({
          where: {
            id: bookingId,
            status: BookingStatus.PENDING,
          },
          select: {
            id: true,
            customerId: true,
            status: true,
          },
        });

        if (!booking) {
          throw new BadRequestException(
            'Booking not found or no longer pending.',
          );
        }

        const updated = await tx.booking.update({
          where: { id: booking.id },
          data: {
            pilotId: pilot.id,
            status: BookingStatus.ACCEPTED,
            acceptedAt: moment.utc().toDate(),
            vehicleId: pilot.vehicle.id,
            pilotType: pilot.pilotType,
          },
          select: {
            id: true,
            tripStart: true,
            tripEnd: true,
            status: true,
            rideType: true,
            name: true,
            bookingCode: true,
            estimatedFare: true,
            estimatedDuration: true,
            estimatedDistance: true,
            discountedFare: true,
            pickupLocation: true,
            dropLocation: true,
            createdAt: true,
            pilotType: true,
            pilotRating: {
              select: {
                rating: true,
              },
            },
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
            vehicle: {
              select: {
                vehicleTypeBD: {
                  select: {
                    name: true,
                    id: true,
                  },
                },
              },
            },
          },
        });

        await tx.customer.update({
          where: { id: booking.customerId },
          data: { activeBookingId: booking.id },
        });

        await tx.pilot.update({
          where: { userId },
          data: {
            activeBookingId: bookingId,
            onlineStatus: PilotStatus.ON_TRIP,
          },
        });

        return { updated };
      });

      await this.redis.setBookingStatus(bookingId, BookingStatus.ACCEPTED);
      await this.redis.publish(
        `booking:${bookingId}:status`,
        JSON.stringify(BookingStatus.ACCEPTED),
      );

      await this.driverSearchService.stopSearchSession(bookingId);

      const pilotLocation = await this.redis.geoPos(
        RedisKeys.PILOT_LOCATION,
        pilot.userId,
      );

      let pickupInMinutes: number | null = null;
      let pilotLat: number | null = null;
      let pilotLng: number | null = null;

      if (pilotLocation && pilotLocation.length >= 2) {
        const [lat, lng] = pilotLocation;
        pilotLat = lat;
        pilotLng = lng;
        const { durationMin } =
          await this.fareService.calculateDistanceAndDuration(
            { lat, lng },
            result.updated.pickupLocation as any,
          );
        pickupInMinutes = Math.ceil(durationMin);
      }

      await this.redis.del(`${RedisKeys.NOTIFIED}${bookingId}:${pilot.userId}`);
      await this.redis.del(`${RedisKeys.RIDE_ACCEPTED}${bookingId}`);

      await this.redis.del(
        `${RedisKeys.DRIVER_ACTIVE_NOTIFICATION}${pilot.userId}`,
      );

      // Cache active ride in Redis
      await this.redis.setActiveRide(
        pilot.userId,
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

      const tripDuration = result.updated.tripEnd
        ? this.calculateTripDuration(
            result.updated.tripStart,
            result.updated.tripEnd,
            result.updated.estimatedDuration,
          )
        : result.updated.estimatedDuration;

      const rideAcceptedPayload: CustomerRidePayload = {
        bookingCode: result.updated.bookingCode,
        bookingId: result.updated.id,
        bookingStatus: result.updated.status,
        estimatedDuration: Number(result.updated.estimatedDuration),
        estimatedDistance: Number(result.updated.estimatedDistance),
        tripDuration: tripDuration,
        tripStart: null,
        vehicleType: result.updated.vehicle.vehicleTypeBD.name,
        vehicleTypeId: result.updated.vehicle.vehicleTypeBD.id,
        createdAt: result.updated.createdAt,
        cancelledBy: null,
        pilot: {
          pilotId: pilot.id,
          pilotName: pilot.drivingLicense.nameOnLicense,
          profilePicture: pilot.selfieUrl,
          pilotPhone: pilot.phone,
          rating: pilot.averageRating,
          pilotLocation:
            pilotLat && pilotLng
              ? {
                  lat: pilotLat,
                  lng: pilotLng,
                }
              : null,
          vehicleNumber: pilot.vehicle.regNo,
          model: pilot.vehicle.model,
          colour: pilot.vehicle.colour,
          vehicleType: pilot.vehicle.vehicleTypeBD.name,
          pilotType: pilot.pilotType,
        },
        rating: {
          forPilot: null,
          forCustomer: null,
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
        pilotType: result.updated.pilotType,
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
            estimatedDistance: true,
            tripEnd: true,
            pickupLocation: true,
            dropLocation: true,
            estimatedFare: true,
            discountedFare: true,
            tripStart: true,
            createdAt: true,
            pilotType: true,
            pilotRating: {
              select: {
                rating: true,
              },
            },
            vehicle: {
              select: {
                vehicleTypeBD: {
                  select: {
                    name: true,
                    id: true,
                  },
                },
              },
            },
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
                pilotType: true,
                drivingLicense: { select: { nameOnLicense: true } },
                vehicle: {
                  select: {
                    regNo: true,
                    model: true,
                    colour: true,
                    vehicleTypeBD: { select: { name: true, id: true } },
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

      const tripDuration = result.updated.tripEnd
        ? this.calculateTripDuration(
            result.updated.tripStart,
            result.updated.tripEnd,
            result.updated.estimatedDuration,
          )
        : result.updated.estimatedDuration;

      const payload: CustomerRidePayload = {
        bookingCode: result.updated.bookingCode,
        bookingId: result.updated.id,
        bookingStatus: result.updated.status,
        estimatedDuration: Number(result.updated.estimatedDuration),
        estimatedDistance: Number(result.updated.estimatedDistance),
        tripDuration: tripDuration,
        tripStart: result.updated.tripStart,
        vehicleType: result.updated.vehicle.vehicleTypeBD.name,
        vehicleTypeId: result.updated.vehicle.vehicleTypeBD.id,
        createdAt: result.updated.createdAt,
        cancelledBy: null,
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
          pilotType: result.updated.pilot.pilotType,
        },
        rating: {
          forPilot: null,
          forCustomer: null,
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
        pilotType: result.updated.pilotType,
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
      const pilot = await this.prisma.pilot.findUnique({
        where: { userId },
        select: {
          id: true,
          userId: true,
          totalTrips: true,
          onlineStatus: true,
          totalLifetimeRides: true,
          totalLifetimeEarnings: true,
          pilotType: true,
          primaryVehicleTypeId: true,
          currentRank: true,
          vehicle: {
            select: {
              vehicleTypeBD: {
                select: {
                  id: true,
                },
              },
            },
          },
        },
      });
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

        await tx.pilot.update({
          where: { id: pilot.id },
          data: {
            activeBookingId: null,
            totalTrips: tripCount,
            onlineStatus: PilotStatus.AVAILABLE,
            totalLifetimeRides: {
              increment: 1,
            },
            totalLifetimeEarnings: {
              increment: Number(booking.discountedFare),
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
            tripEnd: true,
            estimatedDistance: true,
            pickupLocation: true,
            dropLocation: true,
            createdAt: true,
            pilotType: true,
            pilotRating: {
              select: { rating: true },
            },
            vehicleTypeBD: {
              select: {
                name: true,
                id: true,
              },
            },
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
        if (!wallet) {
          throw new NotFoundException('Pilot wallet not found.');
        }

        let currentRank: { rank: number } | undefined = undefined;
        const rawVehicleTypeId =
          pilot.vehicle?.vehicleTypeBD?.id || pilot.primaryVehicleTypeId;

        const normalizedVehicleTypeId = rawVehicleTypeId
          ? await this.programService.normalizeVehicleTypeForLeaderboard(
              rawVehicleTypeId,
            )
          : rawVehicleTypeId;

        if (pilot.currentRank !== null && pilot.currentRank !== undefined) {
          currentRank = { rank: pilot.currentRank };
        } else {
          currentRank = await tx.pilotRanking.findFirst({
            where: {
              pilotId: pilot.id,
              rankingPeriod: RankingPeriod.OVERALL,
              vehicleTypeId: normalizedVehicleTypeId,
            },
          });
        }

        const superPilotProgram = await tx.pilotProgram.findFirst({
          where: {
            programType: ProgramType.SUPER_PILOT,
            isActive: true,
          },
          select: {
            criteria: true,
          },
        });

        // Get maxSuperPilots with safe fallback
        const maxSuperPilots = superPilotProgram?.criteria
          ? Number((superPilotProgram.criteria as any).maxSuperPilots)
          : null;

        const shouldNotDeductFairCoin =
          pilot.pilotType === PilotType.SUPER_PILOT ||
          (currentRank?.rank &&
            maxSuperPilots !== null &&
            !isNaN(maxSuperPilots) &&
            currentRank.rank <= maxSuperPilots);

        await tx.pilotWallet.update({
          where: { pilotId: pilot.id },
          data: {
            balance: {
              decrement: shouldNotDeductFairCoin ? 0 : tripAmount,
            },
            todaysEarning: todaysEarningValue,
            lastTripEarning: tripAmount,
            date: nowDhaka.toDate(),
          },
        });

        await tx.transaction.create({
          data: {
            pilotId: pilot.id,
            amount: shouldNotDeductFairCoin ? 0 : tripAmount,
            walletId: wallet.id,
            type: shouldNotDeductFairCoin
              ? TransactionType.NO_TRIP_DEDUCTION
              : TransactionType.TRIP_DEDUCTION,
            status: TransactionStatus.SUCCESSFUL,
            balanceBefore: Math.ceil(Number(wallet.balance)),
            balanceAfter: Math.ceil(
              Number(wallet.balance) -
                (shouldNotDeductFairCoin ? 0 : tripAmount),
            ),
          },
        });

        await this.programService.updateRankingsInTransaction(
          normalizedVehicleTypeId,
          tx,
        );
        await this.programService.checkSuperPilotPromotionInTransaction(
          pilot.id,
          tx,
        );

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

      const tripDuration = result.updated.tripEnd
        ? this.calculateTripDuration(
            result.updated.tripStart,
            result.updated.tripEnd,
            result.updated.estimatedDuration,
          )
        : result.updated.estimatedDuration;

      const payload: CustomerRidePayload = {
        bookingCode: result.updated.bookingCode,
        bookingId: result.updated.id,
        bookingStatus: result.updated.status,
        estimatedDuration: Number(result.updated.estimatedDuration),
        estimatedDistance: Number(result.updated.estimatedDistance),
        tripDuration: tripDuration,
        tripStart: result.updated.tripStart,
        vehicleType: result.updated.vehicleTypeBD.name,
        vehicleTypeId: result.updated.vehicleTypeBD.id,
        createdAt: result.updated.createdAt,
        cancelledBy: null,
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
          vehicleType: result.updated.vehicleTypeBD.name,
          pilotType: result.updated.pilotType,
        },
        rating: {
          forPilot: null,
          forCustomer: null,
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
        pilotType: result.updated.pilotType,
        otherPassengerInfo:
          result.updated.rideType === RideType.OTHERS
            ? { name: result.updated.name }
            : null,
      };

      // Record business metric
      this.metrics.rideCompletions.inc({
        vehicle_type: result.updated.vehicleTypeBD.name,
        city: 'dhaka', // Extract from location
        version: process.env.API_VERSION || 'v1',
      });

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

      let updatedBooking: Booking | null = null;
      await this.prisma.$transaction(async (tx) => {
        updatedBooking = await tx.booking.update({
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

        return { updatedBooking };
      });

      if (cancelledBy === CancelledBy.CUSTOMER) {
        // Stop search session and notify all notified pilots
        await this.driverSearchService.stopSearchSession(bookingId);

        // Get all notified pilots from Redis keys
        const notifiedKeysPattern = `${RedisKeys.NOTIFIED}${bookingId}:*`;
        const notifiedKeys = await this.redis.keys(notifiedKeysPattern);

        // Extract pilot user IDs from the keys (format: notified-{bookingId}:{pilotUserId})
        const notifiedPilotUserIds = notifiedKeys.map((key) => {
          const parts = key.split(':');
          return parts[parts.length - 1]; // Get the last part which is the pilotUserId
        });

        // Send RIDE_REQUEST_TIMEOUT event to all notified pilots
        for (const pilotUserId of notifiedPilotUserIds) {
          await this.rideNotificationService.notifyRideRequestTimeout(
            bookingId,
            pilotUserId,
          );
        }
      }

      const activePattern = `${RedisKeys.DRIVER_ACTIVE_NOTIFICATION}*`;
      const activeKeys = await this.redis.keys(activePattern);

      for (const activeKey of activeKeys) {
        const activeBookingId = await this.redis.get(activeKey);
        if (activeBookingId === bookingId) {
          await this.redis.del(activeKey);
          this.logger.log(
            `Cleared active notification ${activeKey} for cancelled booking ${bookingId}`,
            this.context,
          );
        }
      }

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
          updatedBooking.status as BookingStatus,
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
          include: {
            vehicleTypeBD: {
              select: {
                id: true,
                name: true,
              },
            },
            customer: {
              include: {
                coupon: true,
              },
            },
          },
        }),
      ]);

      if (!customer) {
        throw new NotFoundException('Customer not found');
      }
      if (!booking) {
        throw new NotFoundException('Booking not found');
      }

      // Determine the NEW locations to use for fare calculation
      const newPickupLocation = pickupLocation || booking.pickupLocation;
      const newDropLocation = dropLocation || booking.dropLocation;

      // Calculate fare using NEW locations
      const fareCalculation = await this.fareService.calculateTariffBasedFare({
        pickupLocation: newPickupLocation,
        dropLocation: newDropLocation,
        vehicleTypeName: booking.vehicleTypeBD.name as VehicleTypeNameBD,
        customerCoupon: booking.customer.coupon || null,
        intercity: false,
      });

      const originalPrice = fareCalculation.originalPrice;
      const distanceKm = fareCalculation.distanceKm;
      const durationMin = fareCalculation.durationMin;
      const price = fareCalculation.finalPrice;

      // Get pilot information for notifications
      const pilot = await this.prisma.pilot.findUnique({
        where: { id: booking.pilotId },
        select: {
          id: true,
          userId: true,
          selfieUrl: true,
          phone: true,
          averageRating: true,
          pilotType: true,
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
                },
              },
            },
          },
        },
      });

      let pickupInMinutes: number = 0;

      // Calculate pickup time if pilot location is available
      if (pilot) {
        const pilotLocation = await this.redis.geoPos(
          RedisKeys.PILOT_LOCATION,
          pilot.userId,
        );

        if (pilotLocation && pilotLocation.length >= 2) {
          const [lat, lng] = pilotLocation;
          const { durationMin: pilotToPickupDuration } =
            await this.fareService.calculateDistanceAndDuration(
              { lat, lng },
              newPickupLocation,
            );
          pickupInMinutes = Math.ceil(pilotToPickupDuration);
        } else {
          pickupInMinutes = randomInt(1, 4);
        }
      }

      // FIXED: Update booking with NEW fare calculation
      const updatedBooking = await this.prisma.booking.update({
        where: { id: booking.id },
        data: {
          pickupLocation: newPickupLocation,
          dropLocation: newDropLocation,
          estimatedDistance: Math.ceil(distanceKm).toString(),
          estimatedDuration: Math.ceil(durationMin),
          estimatedFare: Math.ceil(originalPrice),
          discountedFare: Math.ceil(price),
          baseFare: Number(fareCalculation.fareBreakdown.baseFare),
          distanceFare: Number(fareCalculation.fareBreakdown.distanceFare),
          durationFare: Number(fareCalculation.fareBreakdown.durationFare),
        },
        include: {
          pilotRating: {
            select: {
              rating: true,
            },
          },
          vehicle: {
            include: {
              vehicleTypeBD: {
                select: {
                  name: true,
                  id: true,
                },
              },
            },
          },
        },
      });

      // Notify pilot if pilot exists
      if (pilot) {
        const payload: PilotRideResponse = {
          bookingStatus: updatedBooking.status as BookingStatus,
          bookingId: updatedBooking.id,
          fare: Math.ceil(price),
          customerName:
            updatedBooking.rideType === RideType.SELF
              ? customer.name
              : updatedBooking.name,
          customerPhone: customer.phone,
          averageRating: customer.averageRating,
          pickupLocation: newPickupLocation,
          dropLocation: newDropLocation,
          rideStatus: updatedBooking.status,
          pilotType: updatedBooking.pilotType,
          otherPassengerInfo:
            updatedBooking.rideType === RideType.OTHERS
              ? { name: updatedBooking.name }
              : null,
        };

        await this.rideNotificationService.notifyDriverForEditLocation(
          pilot.userId,
          payload,
        );
      }

      // Prepare customer response
      const coupon = customer?.coupon;
      if (coupon) {
        coupon.discount = Number(coupon.discount);
      }

      const pilotLocation = pilot
        ? await this.redis.geoPos(RedisKeys.PILOT_LOCATION, pilot.userId)
        : null;

      const tripDuration = updatedBooking.tripEnd
        ? this.calculateTripDuration(
            updatedBooking.tripStart,
            updatedBooking.tripEnd,
            updatedBooking.estimatedDuration,
          )
        : updatedBooking.estimatedDuration;

      const data: CustomerRidePayload = {
        bookingCode: updatedBooking.bookingCode,
        bookingId: updatedBooking.id,
        bookingStatus: updatedBooking.status,
        estimatedDuration: Number(updatedBooking.estimatedDuration),
        estimatedDistance: Number(updatedBooking.estimatedDistance),
        tripDuration: tripDuration,
        tripStart: updatedBooking.tripStart,
        vehicleTypeId: updatedBooking.vehicle.vehicleTypeBD.id,
        vehicleType: updatedBooking.vehicle?.vehicleTypeBD?.name,
        createdAt: updatedBooking.createdAt,
        cancelledBy: null,
        pilot: pilot
          ? {
              pilotId: pilot.id,
              pilotName: pilot.drivingLicense.nameOnLicense,
              profilePicture: pilot.selfieUrl,
              pilotPhone: pilot.phone,
              rating: pilot.averageRating,
              pilotLocation: pilotLocation
                ? {
                    lat: pilotLocation[0],
                    lng: pilotLocation[1],
                  }
                : null,
              vehicleNumber: pilot.vehicle.regNo,
              model: pilot.vehicle.model,
              colour: pilot.vehicle.colour,
              vehicleType: pilot.vehicle.vehicleTypeBD.name,
              pilotType: pilot.pilotType,
            }
          : null,
        rating: {
          forPilot: null,
          forCustomer: null,
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
          originalFare: Math.ceil(originalPrice),
          discountedFare: Math.ceil(price),
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

  async ratingRide(ratingRideDto: RatingRideDto, userId: string) {
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
      if (!booking.pilotId || !booking.customerId) {
        throw new BadRequestException('Pilot or customer not found.');
      }

      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { role: true },
      });

      if (!user) {
        throw new NotFoundException('User not found.');
      }

      const role = user.role;

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

        const existingRating = await this.prisma.pilotRating.findUnique({
          where: { bookingId: booking.id, pilotId: pilot.id },
        });
        if (existingRating) {
          throw new BadRequestException('You have already rated this pilot.');
        }

        // Create pilot rating
        const ratingRecord = await this.prisma.customerRating.create({
          data: {
            customerId: booking.customerId,
            bookingId,
            rating,
            feedback,
          },
        });

        const ratings = await this.prisma.customerRating.findMany({
          where: { customerId: booking.customerId },
          select: { rating: true },
        });

        const averageRating =
          ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length;

        await this.prisma.customer.update({
          where: { id: booking.customerId },
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

        const existingRating = await this.prisma.customerRating.findUnique({
          where: { bookingId: booking.id, customerId: customer.id },
        });
        if (existingRating) {
          throw new BadRequestException(
            'You have already rated this customer.',
          );
        }

        // Create pilot rating
        const ratingRecord = await this.prisma.pilotRating.create({
          data: {
            pilotId: booking.pilotId,
            bookingId,
            rating,
            feedback,
          },
        });

        const ratings = await this.prisma.pilotRating.findMany({
          where: { pilotId: booking.pilotId },
          select: { rating: true },
        });

        const averageRating =
          ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length;

        await this.prisma.pilot.update({
          where: { id: booking.pilotId },
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

      // Calculate total earnings from ALL completed trips in the date range
      const completedTrips = await this.prisma.booking.findMany({
        where: {
          ...whereClause,
          status: BookingStatus.COMPLETED,
        },
        select: {
          discountedFare: true,
        },
      });

      const totalEarning = completedTrips.reduce((sum, trip) => {
        return sum + Math.ceil(Number(trip.discountedFare));
      }, 0);

      const [bookings, total]: any = await Promise.all([
        this.prisma.booking.findMany({
          where: whereClause,
          select: {
            id: true,
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

      // Map bookings and calculate trip duration for display only
      let tripDurationInMinutes: number;
      bookings.map((booking) => {
        booking.estimatedDistance = Math.ceil(
          Number(booking.estimatedDistance),
        );
        booking.discountedFare = Math.ceil(Number(booking.discountedFare));

        const start = moment.utc(booking.tripStart);
        const end = moment.utc(booking.tripEnd);
        tripDurationInMinutes = end.diff(start, 'minutes');
        booking.tripDurationInMinutes = tripDurationInMinutes;
      });

      const totalPages = Math.ceil(total / pageSize);
      const hasNextPage = page < totalPages;
      const hasPrevPage = page > 1;

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

  async getRideHistoryByBookingId(bookingId: string, userId: string) {
    try {
      const pilot = await this.prisma.pilot.findUnique({
        where: { userId },
        select: { id: true },
      });
      if (!pilot) {
        throw new NotFoundException('Pilot not found.');
      }

      const booking = await this.prisma.booking.findUnique({
        where: { id: bookingId },
        select: {
          id: true,
          name: true,
          status: true,
          rideType: true,
          discountedFare: true,
          pickupLocation: true,
          dropLocation: true,
          tripStart: true,
          tripEnd: true,
          estimatedDistance: true,
          estimatedDuration: true,
          baseFare: true,
          distanceFare: true,
          durationFare: true,
          pilotType: true,
          createdAt: true,
          cancellationReason: {
            select: {
              cancelledBy: true,
            },
          },
          customerRating: {
            select: {
              rating: true,
              feedback: true,
            },
          },
          customer: {
            select: {
              name: true,
            },
          },
        },
      });

      if (!booking) {
        throw new NotFoundException('Booking not found.');
      }

      const tripDuration = this.calculateTripDuration(
        booking.tripStart,
        booking.tripEnd,
        booking.estimatedDuration,
      );

      let durationFare = Math.ceil(Number(booking.durationFare));
      if (
        Number(booking.discountedFare) !==
        Number(booking.baseFare) +
          Number(booking.distanceFare) +
          Number(booking.durationFare)
      ) {
        durationFare =
          Math.ceil(Number(booking.discountedFare)) -
          (Math.ceil(Number(booking.baseFare)) +
            Math.ceil(Number(booking.distanceFare)));
      }

      const totalFare =
        Math.ceil(Number(booking.baseFare)) +
        Math.ceil(Number(booking.distanceFare)) +
        durationFare;

      const data = {
        id: booking.id,
        bookingStatus: booking.status,
        pilotType: booking.pilotType,
        tripAmount: Math.ceil(Number(booking.discountedFare)),
        pickupLocation: booking.pickupLocation,
        dropLocation: booking.dropLocation,
        tripStart: booking.tripStart,
        tripDistance: booking.estimatedDistance,
        tripDuration: Number(tripDuration),
        cancelledBy: booking.cancellationReason
          ? booking.cancellationReason.cancelledBy
          : null,
        rating: {
          customer: {
            rating: booking.customerRating?.rating || 0,
            feedback: booking.customerRating?.feedback || '',
          },
        },
        fairDetails: {
          baseFare: Math.ceil(Number(booking.baseFare)),
          distanceFare: Math.ceil(Number(booking.distanceFare)),
          durationFare: durationFare,
          totalFare,
        },
        name:
          booking.rideType === RideType.OTHERS
            ? booking.name
            : booking.customer.name,
      };

      return {
        message: 'Ride history fetched successfully',
        data,
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
            tripEnd: true,
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
            ...(status !== BookingStatus.PENDING && {
              vehicleId: { not: null },
            }),
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

  private calculateTripDuration(
    tripStart: Date | null,
    tripEnd: Date | null,
    estimatedDuration?: number,
  ): number {
    // If both tripStart and tripEnd exist, calculate actual duration
    if (tripStart && tripEnd) {
      const start = moment.utc(tripStart);
      const end = moment.utc(tripEnd);
      return Math.max(0, end.diff(start, 'minutes'));
    }

    // Otherwise, fall back to estimated duration
    return estimatedDuration || 0;
  }
}
