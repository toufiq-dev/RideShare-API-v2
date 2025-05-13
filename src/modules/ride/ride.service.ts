import { randomInt } from 'node:crypto';
import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
  BadRequestException,
  ForbiddenException,
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
import { Server } from 'socket.io';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import {
  NotifyDriverPayload,
  RideRequestPayload,
  CustomerRidePayload,
  PilotRideResponse,
  CustomerCreateRideResponse,
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
import { RideNotificationService } from './ride-notification.service';
import { RideEvents } from 'src/core/socket/socket-events';
import { FareService } from '../fare/fare.service';
import { LocationDto } from 'src/common/dto/common.dto';
import { RoleEnum } from '../auth/dto/auth.dto';
import moment from 'moment-timezone';
import { RedisKeys } from 'src/core/cache/redis-keys';

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
      const job = await this.rideQueue.add('broadcast-to-pilots', payload, {
        jobId: `ride-${payload.bookingId}`,
      });

      console.log(`Rideservie enqueueRideRequest with jobId, ${job.id}`);

      return job;
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  async handleUpdateLocation(client: Socket, lat: number, lng: number) {
    try {
      // Store location in Redis geospatial set
      const result = await this.redis.geoAdd(
        RedisKeys.PILOT_LOCATION,
        lng,
        lat,
        client.data.user.userId,
      );

      console.log(`Updating pilotLocation lat: ${lat}, lng: ${lng} `, result);
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

    console.log(`getActiveRideForPilot from cache\n`, cachedRide);

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

      console.log('getActiveRideForPilot from fallback');
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
        discountedFare: booking.discountedFare,
        vehicleTypeId,
        distanceKm,
        durationMin,
        pickupLocation,
        dropLocation,
      });

      const data: CustomerCreateRideResponse = {
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

      console.log('CreatedRideRequest', data.bookingId);

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

  async rideRequestAgain(
    rideRequestAgainDto: RideRequestAgainDto,
    userId: string,
  ) {
    const { bookingId } = rideRequestAgainDto;

    try {
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
          customer: { select: { coupon: { select: { id: true } } } },
        },
      });
      if (!booking) {
        throw new NotFoundException('Booking not found.');
      }

      const vehicle = await this.prisma.vehicle.findUnique({
        where: { id: booking.vehicleId },
        select: {
          vehicleType: {
            select: {
              id: true,
            },
          },
        },
      });

      await this.enqueueRideRequest({
        userId,
        bookingId,
        estimatedFare: booking.estimatedFare,
        discountedFare: booking.discountedFare,
        vehicleTypeId: vehicle.vehicleType.id,
        distanceKm: Number(booking.estimatedDistance),
        durationMin: Number(booking.estimatedDuration),
        pickupLocation: JSON.parse(JSON.stringify(booking.pickupLocation)),
        dropLocation: JSON.parse(JSON.stringify(booking.dropLocation)),
      });

      const coupon: any = await this.prisma.coupon.findUnique({
        where: {
          id: booking.customer.coupon.id,
        },
      });

      if (coupon.discount) {
        coupon.discount = Number(coupon.discount);
      }

      const pickupLocation = {
        lat: booking.pickupLocation.lat,
        lng: booking.pickupLocation.lng,
        name: booking.pickupLocation.name,
        address: booking.pickupLocation.address,
      };
      const dropLocation = {
        lat: booking.dropLocation.lat,
        lng: booking.dropLocation.lng,
        name: booking.dropLocation.name,
        address: booking.dropLocation.address,
      };

      const data = {
        bookingId: booking.id,
        pickupLocation,
        dropLocation,
        originalPrice: Math.ceil(Number(booking.estimatedFare)),
        discountedPrice: Math.ceil(Number(booking.discountedFare)),
        coupon: coupon || null,
        otherPassengerInfo:
          booking.rideType === RideType.OTHERS ? { name: booking.name } : null,
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

  async handleRideRequest(server: Server, payload: RideRequestPayload) {
    const {
      userId,
      bookingId,
      discountedFare,
      vehicleTypeId,
      distanceKm,
      durationMin,
      pickupLocation,
      dropLocation,
    } = payload;

    try {
      let radius = 500; // Initial radius in meters
      const maxRadius = 2000; // Max radius
      const driverTimeout = 15 * 1000; // 15 seconds per driver

      const searchAndNotifyNextDriver = async (): Promise<boolean> => {
        console.log(`searchAndNotifyNextDriver with radius ${radius}`);
        // Fetch all nearby pilots in the current radius
        const nearbyPilots: any = await this.redis.geoRadius(
          RedisKeys.PILOT_LOCATION,
          pickupLocation.lng,
          pickupLocation.lat,
          radius,
          'm',
          { withDist: true, sort: 'ASC' },
        );

        if (!nearbyPilots.length) {
          return false; // No drivers in this radius
        }

        console.log(`nearbyPilots length`, nearbyPilots.length);

        // Iterate through all pilots in the radius
        for (const [pilotUserId, distance] of nearbyPilots) {
          // Check if this pilot was already notified
          const notifiedKey = `${RedisKeys.NOTIFIED}${bookingId}:${pilotUserId}`;
          const alreadyNotified = await this.redis.get(notifiedKey);
          if (alreadyNotified) {
            continue; // Skip already notified driver
          }

          // Fetch pilot details
          const pilot = await this.prisma.pilot.findUnique({
            where: { userId: pilotUserId, onlineStatus: PilotStatus.AVAILABLE },
            select: {
              userId: true,
              vehicle: {
                select: {
                  id: true,
                  vehicleTypeId: true,
                },
              },
              wallet: {
                select: {
                  balance: true,
                },
              },
            },
          });

          if (
            pilot &&
            pilot.vehicle?.vehicleTypeId === vehicleTypeId &&
            pilot.wallet.balance > discountedFare
          ) {
            console.log(`Eligible pilot found ${pilotUserId}`);

            await this.redis.set(
              `${RedisKeys.BOOKING_VEHICLE}${bookingId}:${pilotUserId}`,
              pilot.vehicle.id,
              25,
            ); // 20 seconds TTL (15 seconds + buffer)

            const notifyDriverPayload: NotifyDriverPayload = {
              pilotId: pilotUserId,
              pilotUserId: pilot.userId,
              bookingId,
              vehicleTypeId,
              pickupLocation,
              dropLocation,
              estimatedFare: Math.ceil(Number(discountedFare)),
              nearestPilotDistance: parseFloat(
                (Number(distance) / 1000).toFixed(2),
              ),
              distanceKm: Math.ceil(distanceKm),
              durationMin: Math.ceil(durationMin),
              server,
            };

            await this.rideNotificationService.notifyRideRequest(
              notifyDriverPayload,
            );

            console.log(`Notified driver ${pilotUserId}`);

            // Track driver acceptance
            const acceptanceKey = `${RedisKeys.RIDE_ACCEPTED}${bookingId}`;
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

        console.log('No eligible drivers found in this radius: ', radius);

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
          radius += 500; // Expand radius
        }
      }

      if (!driverAccepted) {
        console.log('No driver accepted');
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
        console.log('booking cancelled');
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
                id: true,
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

      const vehicleId = await this.redis.get(
        `${RedisKeys.BOOKING_VEHICLE}${bookingId}:${pilot.userId}`,
      );
      const vehicle = vehicleId
        ? await this.prisma.vehicle.findUnique({
            where: { id: vehicleId },
            include: { vehicleType: true },
          })
        : null;

      await this.redis.del(`${RedisKeys.NOTIFIED}${bookingId}:${pilot.userId}`);
      await this.redis.del(`${RedisKeys.RIDE_ACCEPTED}${bookingId}`);

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
        tripStart: null,
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
        data: {
          status: BookingStatus.ARRIVED,
          arrivedAt: moment.utc().toDate(),
        },
      });

      // Emit reachedPickupPoint event to customer
      await this.rideNotificationService.notifyReachedPickupPoint(
        booking.customer.userId,
        bookingId,
      );

      await this.redis.setBookingStatus(bookingId, BookingStatus.ARRIVED);

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
                    vehicleType: { select: { name: true } },
                  },
                },
              },
            },
          },
        });

        // Cut farecoins from pilot wallet
        const wallet = await tx.pilotWallet.update({
          where: { pilotId: pilot.id },
          data: {
            balance: {
              decrement: Math.ceil(Number(updated.discountedFare)),
            },
            date: moment.utc().toDate(),
          },
          select: { id: true, balance: true },
        });

        await tx.transaction.create({
          data: {
            pilotId: pilot.id,
            amount: Math.ceil(Number(updated.discountedFare)),
            walletId: wallet.id,
            type: TransactionType.TRIP_DEDUCTION,
            balanceBefore: Math.ceil(Number(wallet.balance)),
            status: TransactionStatus.SUCCESSFUL,
          },
        });

        return { updated };
      });

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

        const updated = await tx.booking.update({
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
                name: true,
                userId: true,
                phone: true,
                averageRating: true,
                coupon: true,
              },
            },
            pilot: {
              select: {
                drivingLicense: true,
                selfieUrl: true,
                phone: true,
                averageRating: true,
                vehicle: {
                  select: {
                    regNo: true,
                    model: true,
                    colour: true,
                    vehicleType: {
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

        await tx.pilotWallet.update({
          where: { pilotId: pilot.id },
          data: {
            todaysEarning: todaysEarningValue,
            lastTripEarning: tripAmount,
            date: nowDhaka.toDate(),
          },
        });
        return { updated };
      });

      await this.redis.setBookingStatus(bookingId, BookingStatus.COMPLETED);

      const payload: CustomerRidePayload = {
        bookingCode: result.updated.bookingCode,
        bookingId: result.updated.id,
        bookingStatus: result.updated.status,
        estimatedDuration: result.updated.estimatedDuration,
        tripStart: result.updated.tripStart,
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

        select: {
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

        await this.prisma.cancellationReason.create({
          data: {
            bookingId: bookingId,
            reason: reason,
            cancelledBy,
          },
        });

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
        RedisKeys.PILOT_LOCATION,
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
        tripStart: updatedBooking.tripStart,
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
      console.error(error);
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

      console.log('totalEarning', totalEarning);

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
      console.error(error);
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
        throw new NotFoundException('Pilot not found.');
      }

      const skip = (page - 1) * pageSize;

      const [bookings, total]: any = await Promise.all([
        this.prisma.booking.findMany({
          where: {
            customerId: customer.id,
            status,
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

        return {
          ...rest,
          bookingId: id,
          bookingStatus: status,
          fairDetails,
          otherPassengerInfo: rideType === RideType.OTHERS ? { name } : null,
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
