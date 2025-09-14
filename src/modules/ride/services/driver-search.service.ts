import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/core/database/prisma.service';
import { RedisService } from 'src/core/cache/redis.service';
import { RideNotificationService } from './ride-notification.service';
import { RedisKeys } from 'src/core/cache/redis-keys';
import { BookingStatus, CancelledBy, PilotStatus } from '@prisma/client';
import { NotifyDriverPayload, RideRequestPayload } from '../dto/ride.interface';

interface SearchIteration {
  iterationNumber: number;
  maxRadius: number;
  driverTimeout: number;
  startTime: Date;
  endTime?: Date;
  driversNotified: string[];
  status: 'PENDING' | 'COMPLETED' | 'CANCELLED';
}

interface DriverSearchSession {
  bookingId: string;
  totalIterations: number;
  currentIteration: number;
  iterations: SearchIteration[];
  status: 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
  createdAt: Date;
  completedAt?: Date;
}

interface SearchConfiguration {
  totalIterations: number;
  maxRadius: number;
  radiusIncrement: number;
  driverTimeout: number;
  iterationDelay: number;
  totalSearchTimeout: number;
  maxNotificationsPerDriver: number;
}

@Injectable()
export class DriverSearchService {
  private readonly logger = new Logger(DriverSearchService.name);
  private readonly context = 'DriverSearchService';

  private readonly DEFAULT_SEARCH_CONFIG: SearchConfiguration = {
    totalIterations: 3,
    maxRadius: 2000,
    radiusIncrement: 500,
    driverTimeout: 15000,
    iterationDelay: 2000,
    totalSearchTimeout: 180000,
    maxNotificationsPerDriver: 3,
  };

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly rideNotificationService: RideNotificationService,
  ) {}

  /**
   * Main entry point for driver search with multi-iteration support
   */
  async searchDrivers(payload: RideRequestPayload): Promise<boolean> {
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

    const config = await this.getSearchConfiguration();

    try {
      // Create search session
      const searchSession = await this.createSearchSession(bookingId, config);

      // Set up Redis subscription for real-time booking status updates
      const bookingStatusChannel = `booking:${bookingId}:status`;
      let isBookingResolved = false;
      let messageHandler: ((channel: string, message: string) => void) | null =
        null;

      // Set up message handler for booking status updates
      messageHandler = (channel: string, message: string) => {
        if (channel === bookingStatusChannel) {
          const status = JSON.parse(message);
          if (status !== BookingStatus.PENDING) {
            isBookingResolved = true;
          }
        }
      };

      this.redis.onMessage(messageHandler);
      await this.redis.subscribe(bookingStatusChannel);

      // Set total search timeout
      const searchTimeoutId = setTimeout(async () => {
        if (!isBookingResolved) {
          await this.handleSearchTimeout(bookingId, searchSession, userId);
        }
      }, config.totalSearchTimeout);

      // Execute multi-iteration search
      const searchResult = await this.executeMultiIterationSearch(
        bookingId,
        searchSession,
        pickupLocation,
        dropLocation,
        vehicleTypeId,
        discountedFare,
        distanceKm,
        durationMin,
        isBookingResolved,
        messageHandler,
        bookingStatusChannel,
        config,
        userId,
      );

      // Cleanup
      clearTimeout(searchTimeoutId);
      if (messageHandler) {
        this.redis.offMessage(messageHandler);
        await this.redis.unsubscribe(bookingStatusChannel);
      }

      return searchResult;
    } catch (error) {
      this.logger.error(
        `Error in searchDrivers: ${error.message}`,
        this.context,
      );
      await this.handleSearchError(bookingId, error, userId);
      throw error;
    }
  }

  /**
   * Create search session in Redis
   */
  private async createSearchSession(
    bookingId: string,
    config: SearchConfiguration,
  ): Promise<DriverSearchSession> {
    const searchSession: DriverSearchSession = {
      bookingId,
      totalIterations: config.totalIterations,
      currentIteration: 0,
      iterations: [],
      status: 'ACTIVE',
      createdAt: new Date(),
    };

    await this.redis.set(
      `${RedisKeys.SEARCH_SESSION}${bookingId}`,
      JSON.stringify(searchSession),
      300, // 5 minutes TTL
    );

    this.logger.log(
      `Created search session for booking ${bookingId}`,
      this.context,
    );
    return searchSession;
  }

  /**
   * Execute multi-iteration search
   */
  private async executeMultiIterationSearch(
    bookingId: string,
    searchSession: DriverSearchSession,
    pickupLocation: any,
    dropLocation: any,
    vehicleTypeId: string,
    discountedFare: number,
    distanceKm: number,
    durationMin: number,
    isBookingResolved: boolean,
    messageHandler: any,
    bookingStatusChannel: string,
    config: SearchConfiguration,
    userId: string,
  ): Promise<boolean> {
    for (
      let iteration = 1;
      iteration <= searchSession.totalIterations;
      iteration++
    ) {
      if (isBookingResolved) {
        this.logger.log(
          `Booking resolved before iteration ${iteration}`,
          this.context,
        );
        break;
      }

      this.logger.log(
        `Starting iteration ${iteration} for booking ${bookingId}`,
        this.context,
      );

      // Update search session
      searchSession.currentIteration = iteration;
      await this.updateSearchSession(bookingId, searchSession);

      // Create iteration record
      const iterationRecord: SearchIteration = {
        iterationNumber: iteration,
        maxRadius: config.maxRadius,
        driverTimeout: config.driverTimeout,
        startTime: new Date(),
        driversNotified: [],
        status: 'PENDING',
      };

      // Execute single iteration
      const iterationResult = await this.executeSingleIteration(
        bookingId,
        iterationRecord,
        pickupLocation,
        dropLocation,
        vehicleTypeId,
        discountedFare,
        distanceKm,
        durationMin,
        isBookingResolved,
        messageHandler,
        bookingStatusChannel,
        config,
      );

      // Update iteration record
      iterationRecord.endTime = new Date();
      iterationRecord.status = iterationResult ? 'COMPLETED' : 'CANCELLED';
      searchSession.iterations.push(iterationRecord);

      if (iterationResult) {
        this.logger.log(
          `Driver accepted in iteration ${iteration}`,
          this.context,
        );
        searchSession.status = 'COMPLETED';
        searchSession.completedAt = new Date();
        await this.updateSearchSession(bookingId, searchSession);
        return true;
      }

      // Wait between iterations (optional - can be removed for faster search)
      if (iteration < searchSession.totalIterations && !isBookingResolved) {
        await this.delay(config.iterationDelay);
      }
    }

    // All iterations completed without acceptance
    searchSession.status = 'CANCELLED';
    searchSession.completedAt = new Date();
    await this.updateSearchSession(bookingId, searchSession);

    await this.handleNoDriverFound(bookingId, userId);
    return false;
  }

  /**
   * Execute single iteration
   */
  private async executeSingleIteration(
    bookingId: string,
    iterationRecord: SearchIteration,
    pickupLocation: any,
    dropLocation: any,
    vehicleTypeId: string,
    discountedFare: number,
    distanceKm: number,
    durationMin: number,
    isBookingResolved: boolean,
    messageHandler: any,
    bookingStatusChannel: string,
    config: SearchConfiguration,
  ): Promise<boolean> {
    let radius = config.radiusIncrement;
    const maxRadius = iterationRecord.maxRadius;

    while (radius <= maxRadius && !isBookingResolved) {
      const driverAccepted = await this.searchAndNotifyDriversInRadius(
        bookingId,
        iterationRecord,
        pickupLocation,
        dropLocation,
        vehicleTypeId,
        discountedFare,
        distanceKm,
        durationMin,
        radius,
        isBookingResolved,
        messageHandler,
        bookingStatusChannel,
        config,
      );

      if (driverAccepted) {
        return true;
      }

      // Check if booking is still pending
      const updatedBooking = await this.prisma.booking.findUnique({
        where: { id: bookingId },
        select: { status: true },
      });

      if (updatedBooking?.status !== BookingStatus.PENDING) {
        break;
      }

      radius += config.radiusIncrement;
    }

    return false;
  }

  /**
   * Search and notify drivers in specific radius
   */
  private async searchAndNotifyDriversInRadius(
    bookingId: string,
    iterationRecord: SearchIteration,
    pickupLocation: any,
    dropLocation: any,
    vehicleTypeId: string,
    discountedFare: number,
    distanceKm: number,
    durationMin: number,
    radius: number,
    isBookingResolved: boolean,
    messageHandler: any,
    bookingStatusChannel: string,
    config: SearchConfiguration,
  ): Promise<boolean> {
    // Fetch all nearby pilots in the current radius
    const nearbyPilots = await this.redis.geoRadius(
      RedisKeys.PILOT_LOCATION,
      pickupLocation.lng,
      pickupLocation.lat,
      radius,
      'm',
      { withDist: true, sort: 'ASC' },
    );

    if (!nearbyPilots.length) {
      return false;
    }

    // Extract pilot user IDs
    const pilotUserIds = nearbyPilots.map(([pilotUserId]) => pilotUserId);

    // Check notification count for each pilot
    const notificationCountKeys = pilotUserIds.map(
      (pilotUserId) =>
        `${RedisKeys.DRIVER_NOTIFICATION_COUNT}${bookingId}:${pilotUserId}`,
    );

    const notificationCounts = await this.redis.mget(...notificationCountKeys);
    const notificationCountMap = new Map(
      pilotUserIds.map((pilotUserId, index) => [
        pilotUserId,
        parseInt(notificationCounts[index] || '0'),
      ]),
    );

    // Filter out pilots who have been notified too many times
    const eligiblePilotUserIds = pilotUserIds.filter(
      (pilotUserId) =>
        (notificationCountMap.get(pilotUserId) || 0) <
        config.maxNotificationsPerDriver,
    );

    if (!eligiblePilotUserIds.length) {
      return false;
    }

    // Batch fetch eligible pilots
    const eligiblePilots = await this.prisma.pilot.findMany({
      where: {
        userId: { in: eligiblePilotUserIds },
        onlineStatus: PilotStatus.AVAILABLE,
        activeBookingId: null,
      },
      select: {
        id: true,
        phone: true,
        userId: true,
        vehicle: {
          select: {
            id: true,
            vehicleTypeBD: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        wallet: {
          select: {
            balance: true,
          },
        },
      },
    });

    const pilotMap = new Map(
      eligiblePilots.map((pilot) => [pilot.userId, pilot]),
    );

    const fare = Number(discountedFare);

    // Process pilots in order of distance
    for (const [pilotUserId, distance] of nearbyPilots as any) {
      if (isBookingResolved) break;

      const pilot = pilotMap.get(pilotUserId);
      if (!pilot) continue;

      const walletBalance = Number(pilot.wallet?.balance || 0);
      const notificationCount = notificationCountMap.get(pilotUserId) || 0;

      // Check eligibility criteria
      if (
        pilot.vehicle?.vehicleTypeBD?.id === vehicleTypeId &&
        walletBalance > fare &&
        notificationCount < config.maxNotificationsPerDriver
      ) {
        this.logger.log(
          `Notifying pilot ${pilot.phone} (iteration ${iterationRecord.iterationNumber}, notification ${notificationCount + 1})`,
          this.context,
        );

        // Increment notification count
        await this.redis.incr(
          `${RedisKeys.DRIVER_NOTIFICATION_COUNT}${bookingId}:${pilotUserId}`,
        );

        // Set expiration for notification count (cleanup after 1 hour)
        await this.redis.expire(
          `${RedisKeys.DRIVER_NOTIFICATION_COUNT}${bookingId}:${pilotUserId}`,
          3600,
        );

        // Track in iteration record
        iterationRecord.driversNotified.push(pilotUserId);

        // Set acceptance tracking
        const acceptanceKey = `${RedisKeys.RIDE_ACCEPTED}${bookingId}`;
        await this.redis.set(acceptanceKey, 'pending', 15);

        const notifyDriverPayload: NotifyDriverPayload = {
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
        };

        // Notify driver
        await this.rideNotificationService.notifyRideRequest(
          notifyDriverPayload,
        );

        // Wait for driver response
        const driverAccepted = await this.waitForDriverResponse(
          bookingId,
          pilot.userId,
          isBookingResolved,
          messageHandler,
          bookingStatusChannel,
          config.driverTimeout,
        );

        if (driverAccepted) {
          await this.redis.del(acceptanceKey);
          return true;
        }

        // Driver didn't respond in time
        await this.redis.del(acceptanceKey);
        await this.rideNotificationService.notifyRideRequestTimeout(
          bookingId,
          pilot.userId,
        );
      }
    }

    return false;
  }

  /**
   * Wait for driver response with timeout
   */
  private async waitForDriverResponse(
    bookingId: string,
    pilotUserId: string,
    isBookingResolved: boolean,
    messageHandler: any,
    bookingStatusChannel: string,
    timeout: number,
  ): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      const timeoutId = setTimeout(() => {
        resolve(false); // Timeout
      }, timeout);

      const checkResolved = () => {
        if (isBookingResolved) {
          clearTimeout(timeoutId);
          resolve(true);
        } else {
          setTimeout(checkResolved, 100);
        }
      };

      checkResolved();
    });
  }

  /**
   * Update search session in Redis
   */
  private async updateSearchSession(
    bookingId: string,
    searchSession: DriverSearchSession,
  ): Promise<void> {
    await this.redis.set(
      `${RedisKeys.SEARCH_SESSION}${bookingId}`,
      JSON.stringify(searchSession),
      300,
    );
  }

  /**
   * Handle search timeout
   */
  private async handleSearchTimeout(
    bookingId: string,
    searchSession: DriverSearchSession,
    userId: string,
  ): Promise<void> {
    this.logger.log(`Search timeout for booking ${bookingId}`, this.context);

    searchSession.status = 'CANCELLED';
    searchSession.completedAt = new Date();
    await this.updateSearchSession(bookingId, searchSession);

    await this.handleNoDriverFound(bookingId, userId);
  }

  private async handleNoDriverFound(
    bookingId: string,
    userId: string,
  ): Promise<void> {
    this.logger.log(`No driver found for booking ${bookingId}`, this.context);

    try {
      await this.prisma.$transaction(async (tx) => {
        const booking = await tx.booking.findUnique({
          where: { id: bookingId },
          select: { customerId: true },
        });
        if (!booking) {
          throw new NotFoundException('Booking not found for this customer');
        }
        await tx.booking.update({
          where: { id: bookingId },
          data: { status: BookingStatus.NOT_FOUND },
        });

        if (booking) {
          await tx.customer.update({
            where: { id: booking.customerId },
            data: { activeBookingId: null },
          });

          const existingCancellation = await tx.cancellationReason.findUnique({
            where: { bookingId },
          });

          if (!existingCancellation) {
            await tx.cancellationReason.create({
              data: {
                bookingId,
                reason: 'Driver not found after multiple search attempts',
                cancelledBy: CancelledBy.SYSTEM,
              },
            });
          }
        }
      });

      // Update Redis cache
      await this.redis.set(
        RedisKeys.BOOKING_STATUS + bookingId,
        BookingStatus.NOT_FOUND,
      );

      // Publish status change to Redis channel
      await this.redis.publish(
        `booking:${bookingId}:status`,
        JSON.stringify(BookingStatus.NOT_FOUND),
      );

      // Notify customer via socket and push notification
      await this.rideNotificationService.notifyDriverNotFound(
        bookingId,
        BookingStatus.NOT_FOUND,
        userId,
      );

      // Cleanup Redis keys
      const pipeline = this.redis.pipeline();
      pipeline.del(`${RedisKeys.RIDE_ACCEPTED}${bookingId}`);
      pipeline.del(`${RedisKeys.SEARCH_SESSION}${bookingId}`);
      await pipeline.exec();

      this.logger.log(
        `Successfully notified customer ${userId} about no driver found for booking ${bookingId}`,
        this.context,
      );
    } catch (error) {
      this.logger.error(
        `Error in handleNoDriverFound: ${error.message}`,
        this.context,
      );
      throw error;
    }
  }

  private async handleSearchError(
    bookingId: string,
    error: any,
    userId: string, // ✅ Add this parameter
  ): Promise<void> {
    this.logger.error(
      `Search error for booking ${bookingId}: ${error.message}`,
      this.context,
    );

    try {
      // Update booking status to CANCELLED
      await this.prisma.booking.update({
        where: { id: bookingId },
        data: { status: BookingStatus.CANCELLED },
      });

      // Update Redis cache
      await this.redis.set(
        RedisKeys.BOOKING_STATUS + bookingId,
        BookingStatus.CANCELLED,
      );

      // Publish status change
      await this.redis.publish(
        `booking:${bookingId}:status`,
        JSON.stringify(BookingStatus.CANCELLED),
      );

      // ✅ FIXED: Notify customer about the error
      await this.rideNotificationService.notifyDriverNotFound(
        bookingId,
        BookingStatus.CANCELLED,
        userId,
      );

      // Cleanup Redis
      const pipeline = this.redis.pipeline();
      pipeline.del(`${RedisKeys.SEARCH_SESSION}${bookingId}`);
      pipeline.del(`${RedisKeys.RIDE_ACCEPTED}${bookingId}`);
      await pipeline.exec();
    } catch (cleanupError) {
      this.logger.error(
        `Error during cleanup: ${cleanupError.message}`,
        this.context,
      );
      throw cleanupError;
    }
  }

  /**
   * Get search configuration (can be made dynamic)
   */
  private async getSearchConfiguration(): Promise<SearchConfiguration> {
    // Could be fetched from database or environment variables
    return {
      ...this.DEFAULT_SEARCH_CONFIG,
      totalIterations: parseInt(process.env.SEARCH_ITERATIONS || '3'),
      maxRadius: parseInt(process.env.MAX_SEARCH_RADIUS || '2000'),
      driverTimeout: parseInt(process.env.DRIVER_TIMEOUT || '15000'),
    };
  }

  /**
   * Utility function for delays
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Get search session details for monitoring
   */
  async getSearchSessionDetails(
    bookingId: string,
  ): Promise<DriverSearchSession | null> {
    const sessionData = await this.redis.get(
      `${RedisKeys.SEARCH_SESSION}${bookingId}`,
    );
    return sessionData ? JSON.parse(sessionData) : null;
  }

  /**
   * Get search analytics
   */
  async getSearchAnalytics(bookingId: string): Promise<any> {
    const session = await this.getSearchSessionDetails(bookingId);
    if (!session) return null;

    const analytics = {
      totalIterations: session.totalIterations,
      completedIterations: session.iterations.length,
      totalDriversNotified: session.iterations.reduce(
        (total, iteration) => total + iteration.driversNotified.length,
        0,
      ),
      averageDriversPerIteration:
        session.iterations.length > 0
          ? session.iterations.reduce(
              (total, iteration) => total + iteration.driversNotified.length,
              0,
            ) / session.iterations.length
          : 0,
      searchDuration: session.completedAt
        ? session.completedAt.getTime() - session.createdAt.getTime()
        : null,
      status: session.status,
    };

    return analytics;
  }
}
