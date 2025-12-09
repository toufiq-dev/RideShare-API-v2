import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/core/database/database.service';
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

      const bookingStatus = {
        isResolved: false,
        status: BookingStatus.PENDING,
      };

      // Set up Redis subscription for real-time booking status updates
      const bookingStatusChannel = `booking:${bookingId}:status`;
      let messageHandler: ((channel: string, message: string) => void) | null =
        null;

      // Set up message handler for booking status updates
      messageHandler = (channel: string, message: string) => {
        if (channel === bookingStatusChannel) {
          const status = JSON.parse(message);
          bookingStatus.status = status;
          if (status !== BookingStatus.PENDING) {
            bookingStatus.isResolved = true;
            console.log('Booking status changed to', status);
          }
        }
      };

      this.redis.onMessage(messageHandler);
      await this.redis.subscribe(bookingStatusChannel);

      // Set total search timeout
      const searchTimeoutId = setTimeout(async () => {
        if (!bookingStatus.isResolved) {
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
        bookingStatus,
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

      if (searchResult) {
        this.logger.log(
          `[DRIVER_FOUND] Driver found and accepted for booking ${bookingId}`,
          this.context,
        );
      } else {
        this.logger.log(
          `[NO_DRIVER_FOUND] No driver found after ${config.totalIterations} iterations for booking ${bookingId}`,
          this.context,
        );
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
    bookingStatus: { isResolved: boolean; status: BookingStatus },
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
      if (bookingStatus.isResolved) {
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
        bookingStatus,
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
          `[DRIVER_ACCEPTED] Driver accepted in iteration ${iteration} for booking ${bookingId}`,
          this.context,
        );
        searchSession.status = 'COMPLETED';
        searchSession.completedAt = new Date();
        await this.updateSearchSession(bookingId, searchSession);
        return true;
      }

      // Wait between iterations (optional - can be removed for faster search)
      if (
        iteration < searchSession.totalIterations &&
        !bookingStatus.isResolved
      ) {
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
    bookingStatus: { isResolved: boolean; status: BookingStatus },
    messageHandler: any,
    bookingStatusChannel: string,
    config: SearchConfiguration,
  ): Promise<boolean> {
    let radius = config.radiusIncrement;
    const maxRadius = iterationRecord.maxRadius;

    // ✅ Track retry state for "all drivers busy" scenario
    const ALL_BUSY_RETRY_DELAY = 2000; // Wait 2 seconds between retries
    const MAX_ALL_BUSY_RETRIES = 5; // Retry up to 5 times (total ~10 seconds wait)
    let allBusyRetryCount = 0;
    let lastRadiusWithAllBusy = 0;

    while (radius <= maxRadius && !bookingStatus.isResolved) {
      const result = await this.searchAndNotifyDriversInRadius(
        bookingId,
        iterationRecord,
        pickupLocation,
        dropLocation,
        vehicleTypeId,
        discountedFare,
        distanceKm,
        durationMin,
        radius,
        bookingStatus,
        messageHandler,
        bookingStatusChannel,
        config,
      );

      if (result === true) {
        // Driver accepted
        return true;
      }

      if (bookingStatus.isResolved) {
        this.logger.log(
          `Booking ${bookingId} resolved during iteration, stopping radius search`,
          this.context,
        );
        break;
      }

      // ✅ Handle "all drivers busy" scenario
      if (result === 'ALL_BUSY') {
        // Check if we should retry the same radius
        if (
          allBusyRetryCount < MAX_ALL_BUSY_RETRIES &&
          lastRadiusWithAllBusy === radius
        ) {
          allBusyRetryCount++;
          this.logger.log(
            `[RETRY_ALL_BUSY] All drivers in ${radius}m radius have active notifications for booking ${bookingId}. Retry ${allBusyRetryCount}/${MAX_ALL_BUSY_RETRIES} after ${ALL_BUSY_RETRY_DELAY}ms delay.`,
            this.context,
          );
          await this.delay(ALL_BUSY_RETRY_DELAY);
          // Retry same radius without incrementing
          continue;
        } else if (lastRadiusWithAllBusy !== radius) {
          // New radius with all busy - reset counter and retry
          allBusyRetryCount = 1;
          lastRadiusWithAllBusy = radius;
          this.logger.log(
            `[RETRY_ALL_BUSY] All drivers in ${radius}m radius have active notifications for booking ${bookingId}. Retry ${allBusyRetryCount}/${MAX_ALL_BUSY_RETRIES} after ${ALL_BUSY_RETRY_DELAY}ms delay.`,
            this.context,
          );
          await this.delay(ALL_BUSY_RETRY_DELAY);
          continue;
        } else {
          // Exhausted retries for this radius, move to next
          this.logger.log(
            `[ALL_BUSY_EXHAUSTED] Exhausted ${MAX_ALL_BUSY_RETRIES} retries for ${radius}m radius. Moving to next radius.`,
            this.context,
          );
          allBusyRetryCount = 0;
          lastRadiusWithAllBusy = 0;
          radius += config.radiusIncrement;
          continue;
        }
      }

      // Normal flow: no drivers found or other error, move to next radius
      allBusyRetryCount = 0;
      lastRadiusWithAllBusy = 0;
      radius += config.radiusIncrement;
    }

    return false;
  }

  /**
   * Search and notify drivers in specific radius
   * Returns: true if driver accepted, false if no drivers/error, 'ALL_BUSY' if all drivers have active notifications
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
    bookingStatus: { isResolved: boolean; status: BookingStatus },
    messageHandler: any,
    bookingStatusChannel: string,
    config: SearchConfiguration,
  ): Promise<boolean | 'ALL_BUSY'> {
    if (bookingStatus.isResolved) {
      return false;
    }

    // Fetch all nearby pilots in the current radius
    const nearbyPilots = await this.redis.geoRadius(
      RedisKeys.PILOT_LOCATION,
      pickupLocation.lng,
      pickupLocation.lat,
      radius,
      'm',
      { withDist: true, sort: 'ASC' },
    );
    const pilots = await this.prisma.pilot.findMany({
      where: {
        userId: { in: nearbyPilots.map(([pilotUserId]) => pilotUserId) },
      },
    });
    this.logger.log(
      `[PILOTS_FOUND] Found ${pilots.length} pilots ${pilots.map((pilot) => pilot.phone)} in ${radius}m radius for booking ${bookingId}`,
      this.context,
    );
    if (!nearbyPilots.length) {
      return false; // Truly no drivers in radius
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
      return false; // All drivers already notified max times
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

    // ✅ Track if we found eligible drivers but all were busy
    let foundEligibleDrivers = false;
    let allDriversWereBusy = true;

    // Process pilots in order of distance (round-robin)
    for (const [pilotUserId, distance] of nearbyPilots as any) {
      if (bookingStatus.isResolved) break;

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
        foundEligibleDrivers = true; // Found at least one eligible driver

        if (bookingStatus.isResolved) break;

        // Check if driver has active notification (round-robin check)
        const hasActive = await this.hasActiveNotification(pilotUserId);
        if (hasActive) {
          this.logger.log(
            `[DRIVER_BUSY] Driver ${pilot.phone} has active notification, skipping for booking ${bookingId}. Will retry.`,
            this.context,
          );
          continue; // Round-robin: skip busy driver, try next one
        }

        // ✅ Found an available driver - proceed with notification
        allDriversWereBusy = false; // At least one driver was available

        // Increment notification count
        await this.redis.incrWithExpire(
          `${RedisKeys.DRIVER_NOTIFICATION_COUNT}${bookingId}:${pilotUserId}`,
          3600, // 1 hour TTL
        );

        // Track in iteration record
        iterationRecord.driversNotified.push(pilotUserId);

        // Set acceptance tracking
        const acceptanceKey = `${RedisKeys.RIDE_ACCEPTED}${bookingId}`;
        await this.redis.set(acceptanceKey, 'pending', 15);

        const notifyDriverPayload: NotifyDriverPayload = {
          bookingStatus: BookingStatus.PENDING,
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

        // Set active notification BEFORE sending (prevents concurrent notifications)
        await this.setActiveNotification(pilot.userId, bookingId);

        // Notify driver
        await this.rideNotificationService.notifyRideRequest(
          notifyDriverPayload,
        );

        const notifiedPilot = await this.prisma.pilot.findUnique({
          where: { userId: pilotUserId },
        });
        this.logger.log(
          `[DRIVER_NOTIFICATION_SENT] Notified pilot ${notifiedPilot.phone} for booking ${bookingId}, price: ${discountedFare}`,
          this.context,
        );

        const currentStatus = await this.redis.getBookingStatus(bookingId);
        if (currentStatus !== null && currentStatus !== BookingStatus.PENDING) {
          this.logger.log(
            `[NOTIFICATION_CANCELLED] Booking ${bookingId} was cancelled. Status: ${currentStatus}. Skipping notification to driver ${pilot.phone}`,
            this.context,
          );
          // Update isResolved flag immediately
          bookingStatus.isResolved = true;
          bookingStatus.status = currentStatus as BookingStatus;
          break;
        }

        // Wait for driver response
        const driverAccepted = await this.waitForDriverResponse(
          bookingId,
          pilot.userId,
          bookingStatus,
          messageHandler,
          bookingStatusChannel,
          config.driverTimeout,
        );

        if (driverAccepted) {
          // Clear active notification on accept
          await this.clearActiveNotification(pilot.userId, bookingId);
          await this.redis.del(acceptanceKey);
          return true;
        }

        // Driver didn't respond in time
        // Clear active notification on timeout (driver becomes available for other bookings)
        await this.clearActiveNotification(pilot.userId, bookingId);
        await this.redis.del(acceptanceKey);
        await this.rideNotificationService.notifyRideRequestTimeout(
          bookingId,
          pilot.userId,
        );
        this.logger.log(
          `[DRIVER_NOTIFICATION_TIMEOUT] Notified pilot ${notifiedPilot.phone} for booking ${bookingId}. Driver is now available for other bookings.`,
          this.context,
        );

        // Continue to next driver (round-robin continues within same iteration)
        // Don't return false yet - try next driver in this iteration
      }
    }

    // ✅ If we found eligible drivers but all were busy, return special indicator
    if (foundEligibleDrivers && allDriversWereBusy) {
      this.logger.log(
        `[ALL_DRIVERS_BUSY] All eligible drivers in ${radius}m radius have active notifications for booking ${bookingId}. Will retry after delay.`,
        this.context,
      );
      return 'ALL_BUSY';
    }

    return false;
  }

  /**
   * Wait for driver response with timeout
   */
  private async waitForDriverResponse(
    bookingId: string,
    pilotUserId: string,
    bookingStatus: { isResolved: boolean; status: BookingStatus },
    messageHandler: any,
    bookingStatusChannel: string,
    timeout: number,
  ): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      const timeoutId = setTimeout(() => {
        resolve(false); // Timeout
      }, timeout);

      const checkResolved = () => {
        if (bookingStatus.isResolved) {
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
    userId: string,
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

      // Notify customer about the error
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
   * Check if driver has an active notification
   */
  private async hasActiveNotification(pilotUserId: string): Promise<boolean> {
    const activeKey = `${RedisKeys.DRIVER_ACTIVE_NOTIFICATION}${pilotUserId}`;
    const activeBookingId = await this.redis.get(activeKey);
    return activeBookingId !== null;
  }

  /**
   * Set driver as having an active notification
   */
  private async setActiveNotification(
    pilotUserId: string,
    bookingId: string,
  ): Promise<void> {
    const activeKey = `${RedisKeys.DRIVER_ACTIVE_NOTIFICATION}${pilotUserId}`;
    // TTL = 15 seconds (matches driver timeout)
    await this.redis.set(activeKey, bookingId, 15);
    this.logger.log(
      `Set active notification for driver ${pilotUserId}, booking ${bookingId}`,
      this.context,
    );
  }

  /**
   * Clear active notification for a driver
   */
  private async clearActiveNotification(
    pilotUserId: string,
    bookingId: string,
  ): Promise<void> {
    const activeKey = `${RedisKeys.DRIVER_ACTIVE_NOTIFICATION}${pilotUserId}`;
    const activeBookingId = await this.redis.get(activeKey);

    // Only clear if it's the same booking (prevent race conditions)
    if (activeBookingId === bookingId) {
      await this.redis.del(activeKey);
      this.logger.log(
        `Cleared active notification for driver ${pilotUserId}, booking ${bookingId}`,
        this.context,
      );
    }
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

  async stopSearchSession(bookingId: string): Promise<void> {
    try {
      // Update search session status
      const sessionData = await this.redis.get(
        `${RedisKeys.SEARCH_SESSION}${bookingId}`,
      );
      if (sessionData) {
        const searchSession: DriverSearchSession = JSON.parse(sessionData);
        searchSession.status = 'CANCELLED';
        searchSession.completedAt = new Date();

        await this.redis.set(
          `${RedisKeys.SEARCH_SESSION}${bookingId}`,
          JSON.stringify(searchSession),
          300,
        );
      }

      // Cleanup search-related Redis keys
      const pipeline = this.redis.pipeline();
      pipeline.del(`${RedisKeys.RIDE_ACCEPTED}${bookingId}`);
      pipeline.del(`${RedisKeys.SEARCH_SESSION}${bookingId}`);

      // Clean up notification count keys for this booking
      const pattern = `${RedisKeys.DRIVER_NOTIFICATION_COUNT}${bookingId}:*`;
      const keys = await this.redis.keys(pattern);
      if (keys.length > 0) {
        pipeline.del(...keys);
      }

      await pipeline.exec();

      this.logger.log(
        `Stopped search session for booking ${bookingId}`,
        this.context,
      );
    } catch (error) {
      this.logger.error(
        `Error stopping search session for booking ${bookingId}: ${error.message}`,
        this.context,
      );
    }
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
