import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from 'src/core/cache/redis.service';
import { PrismaService } from 'src/core/database/database.service';
import { BookingStatus } from '@prisma/client';
import { NotifyDriverPayload } from '../dto/ride.interface';
import { v4 as uuidv4 } from 'uuid';
import { RedisKeys } from 'src/core/cache/redis-keys';

interface DriverNotification {
  notificationId: string;
  bookingId: string;
  payload: NotifyDriverPayload;
  queuedAt: number; // timestamp
  expiresAt: number; // timestamp
  status: 'PENDING' | 'SHOWING' | 'ACCEPTED' | 'TIMEOUT' | 'CANCELLED';
}

interface DriverNotificationState {
  currentNotificationId: string | null;
  queue: DriverNotification[];
  lastProcessedAt: number | null;
}

@Injectable()
export class DriverNotificationQueueService {
  private readonly logger = new Logger(DriverNotificationQueueService.name);
  private readonly NOTIFICATION_TIMEOUT = 15000; // 15 seconds
  private readonly QUEUE_TTL = 3600; // 1 hour
  private readonly LOCK_TTL = 5; // 5 seconds
  private readonly LOCK_RETRY_DELAY = 100; // 100ms
  private readonly MAX_RETRIES = 50; // 5 seconds total

  constructor(
    private readonly redis: RedisService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Get Redis key for driver's current notification
   */
  private getCurrentNotificationKey(pilotUserId: string): string {
    return `driverCurrentNotification:${pilotUserId}`;
  }

  /**
   * Get Redis key for driver's notification queue
   */
  private getQueueKey(pilotUserId: string): string {
    return `driverNotificationQueue:${pilotUserId}`;
  }

  /**
   * Get Redis key for driver's notification lock
   */
  private getLockKey(pilotUserId: string): string {
    return `driverNotificationLock:${pilotUserId}`;
  }

  /**
   * Acquire lock for processing notifications for a driver
   */
  private async acquireLock(pilotUserId: string): Promise<boolean> {
    const lockKey = this.getLockKey(pilotUserId);
    const lockValue = Date.now().toString();

    for (let i = 0; i < this.MAX_RETRIES; i++) {
      const acquired = await this.redis.setnx(
        lockKey,
        lockValue,
        this.LOCK_TTL,
      );
      if (acquired) {
        return true;
      }
      await new Promise((resolve) =>
        setTimeout(resolve, this.LOCK_RETRY_DELAY),
      );
    }
    return false;
  }

  /**
   * Release lock
   */
  private async releaseLock(pilotUserId: string): Promise<void> {
    const lockKey = this.getLockKey(pilotUserId);
    await this.redis.del(lockKey);
  }

  /**
   * Add notification to driver's queue
   */
  async queueNotification(
    pilotUserId: string,
    payload: NotifyDriverPayload,
  ): Promise<string> {
    const notificationId = uuidv4();
    const now = Date.now();

    const notification: DriverNotification = {
      notificationId,
      bookingId: payload.bookingId,
      payload,
      queuedAt: now,
      expiresAt: now + this.NOTIFICATION_TIMEOUT,
      status: 'PENDING',
    };

    // Acquire lock
    const lockAcquired = await this.acquireLock(pilotUserId);
    if (!lockAcquired) {
      this.logger.warn(
        `Failed to acquire lock for pilot ${pilotUserId}, retrying...`,
      );
      // Retry once after a short delay
      await new Promise((resolve) => setTimeout(resolve, 200));
      const retryLock = await this.acquireLock(pilotUserId);
      if (!retryLock) {
        throw new Error(`Failed to acquire lock for pilot ${pilotUserId}`);
      }
    }

    try {
      // Get current state
      const state = await this.getDriverState(pilotUserId);

      // Add to queue
      state.queue.push(notification);

      // Save state
      await this.saveDriverState(pilotUserId, state);

      // Process queue (async, don't wait)
      this.processQueue(pilotUserId).catch((error) => {
        this.logger.error(
          `Error processing queue for pilot ${pilotUserId}: ${error.message}`,
        );
      });

      this.logger.log(
        `Queued notification ${notificationId} for pilot ${pilotUserId}, queue length: ${state.queue.length}`,
      );

      return notificationId;
    } finally {
      await this.releaseLock(pilotUserId);
    }
  }

  /**
   * Get driver's notification state
   */
  private async getDriverState(
    pilotUserId: string,
  ): Promise<DriverNotificationState> {
    const queueKey = this.getQueueKey(pilotUserId);
    const currentKey = this.getCurrentNotificationKey(pilotUserId);

    const [queueData, currentNotificationId] = await Promise.all([
      this.redis.get(queueKey),
      this.redis.get(currentKey),
    ]);

    const queue: DriverNotification[] = queueData ? JSON.parse(queueData) : [];

    return {
      currentNotificationId: currentNotificationId || null,
      queue,
      lastProcessedAt: null,
    };
  }

  /**
   * Save driver's notification state
   */
  private async saveDriverState(
    pilotUserId: string,
    state: DriverNotificationState,
  ): Promise<void> {
    const queueKey = this.getQueueKey(pilotUserId);
    const currentKey = this.getCurrentNotificationKey(pilotUserId);

    await Promise.all([
      this.redis.set(queueKey, JSON.stringify(state.queue), this.QUEUE_TTL),
      state.currentNotificationId
        ? this.redis.set(
            currentKey,
            state.currentNotificationId,
            this.QUEUE_TTL,
          )
        : this.redis.del(currentKey),
    ]);
  }

  /**
   * Process driver's notification queue
   */
  async processQueue(pilotUserId: string): Promise<NotifyDriverPayload | null> {
    const lockAcquired = await this.acquireLock(pilotUserId);
    if (!lockAcquired) {
      // Another process is handling it
      return;
    }

    try {
      const state = await this.getDriverState(pilotUserId);

      // If there's a current notification, check if it's still valid
      if (state.currentNotificationId) {
        const currentNotification = state.queue.find(
          (n) => n.notificationId === state.currentNotificationId,
        );

        if (currentNotification) {
          // Check if current notification is still showing
          if (currentNotification.status === 'SHOWING') {
            const now = Date.now();
            if (now < currentNotification.expiresAt) {
              // Still showing, schedule check for when it expires
              const timeUntilExpiry = currentNotification.expiresAt - now;
              setTimeout(() => {
                this.processQueue(pilotUserId).catch((error) => {
                  this.logger.error(
                    `Error processing queue after timeout: ${error.message}`,
                  );
                });
              }, timeUntilExpiry);
              return;
            } else {
              // Current notification expired, mark as timeout
              currentNotification.status = 'TIMEOUT';
              state.currentNotificationId = null;
              await this.saveDriverState(pilotUserId, state);
            }
          } else if (
            currentNotification.status === 'ACCEPTED' ||
            currentNotification.status === 'CANCELLED'
          ) {
            // Current notification resolved, remove it
            state.queue = state.queue.filter(
              (n) => n.notificationId !== state.currentNotificationId,
            );
            state.currentNotificationId = null;
            await this.saveDriverState(pilotUserId, state);
          }
        } else {
          // Current notification not found in queue, clear it
          state.currentNotificationId = null;
          await this.saveDriverState(pilotUserId, state);
        }
      }

      // Process next notification in queue
      const nextNotification = state.queue.find((n) => n.status === 'PENDING');

      if (nextNotification) {
        // Check if booking is still pending
        const bookingStatus = await this.redis.get(
          `${RedisKeys.BOOKING_STATUS}${nextNotification.bookingId}`,
        );

        if (bookingStatus === BookingStatus.PENDING) {
          // Mark as showing
          nextNotification.status = 'SHOWING';
          state.currentNotificationId = nextNotification.notificationId;
          await this.saveDriverState(pilotUserId, state);

          // Return notification payload to be sent
          return nextNotification.payload;
        } else {
          // Booking no longer pending, remove from queue
          nextNotification.status = 'CANCELLED';
          state.queue = state.queue.filter(
            (n) => n.notificationId !== nextNotification.notificationId,
          );
          await this.saveDriverState(pilotUserId, state);

          // Process next
          return this.processQueue(pilotUserId);
        }
      }

      return null;
    } finally {
      await this.releaseLock(pilotUserId);
    }
  }

  /**
   * Mark notification as accepted
   */
  async markNotificationAccepted(
    pilotUserId: string,
    bookingId: string,
  ): Promise<void> {
    const lockAcquired = await this.acquireLock(pilotUserId);
    if (!lockAcquired) {
      throw new Error(`Failed to acquire lock for pilot ${pilotUserId}`);
    }

    try {
      const state = await this.getDriverState(pilotUserId);

      // Find and mark notification as accepted
      const notification = state.queue.find(
        (n) =>
          n.bookingId === bookingId &&
          (n.status === 'SHOWING' || n.status === 'PENDING'),
      );

      if (notification) {
        notification.status = 'ACCEPTED';
        if (state.currentNotificationId === notification.notificationId) {
          state.currentNotificationId = null;
        }
        state.queue = state.queue.filter(
          (n) => n.notificationId !== notification.notificationId,
        );
        await this.saveDriverState(pilotUserId, state);

        // Process next in queue
        this.processQueue(pilotUserId).catch((error) => {
          this.logger.error(
            `Error processing queue after acceptance: ${error.message}`,
          );
        });
      }
    } finally {
      await this.releaseLock(pilotUserId);
    }
  }

  /**
   * Mark notification as cancelled (booking cancelled)
   */
  async markNotificationCancelled(
    pilotUserId: string,
    bookingId: string,
  ): Promise<void> {
    const lockAcquired = await this.acquireLock(pilotUserId);
    if (!lockAcquired) {
      // Try to process anyway, but log warning
      this.logger.warn(
        `Failed to acquire lock for cancelling notification for pilot ${pilotUserId}`,
      );
    }

    try {
      const state = await this.getDriverState(pilotUserId);

      // Find and mark notification as cancelled
      const notification = state.queue.find((n) => n.bookingId === bookingId);

      if (notification) {
        notification.status = 'CANCELLED';
        if (state.currentNotificationId === notification.notificationId) {
          state.currentNotificationId = null;
        }
        state.queue = state.queue.filter(
          (n) => n.notificationId !== notification.notificationId,
        );
        await this.saveDriverState(pilotUserId, state);

        // Process next in queue
        if (lockAcquired) {
          this.processQueue(pilotUserId).catch((error) => {
            this.logger.error(
              `Error processing queue after cancellation: ${error.message}`,
            );
          });
        }
      }
    } finally {
      if (lockAcquired) {
        await this.releaseLock(pilotUserId);
      }
    }
  }

  /**
   * Clear all notifications for a driver (e.g., when driver goes offline)
   */
  async clearDriverQueue(pilotUserId: string): Promise<void> {
    const queueKey = this.getQueueKey(pilotUserId);
    const currentKey = this.getCurrentNotificationKey(pilotUserId);
    const lockKey = this.getLockKey(pilotUserId);

    await Promise.all([
      this.redis.del(queueKey),
      this.redis.del(currentKey),
      this.redis.del(lockKey),
    ]);

    this.logger.log(`Cleared notification queue for pilot ${pilotUserId}`);
  }

  /**
   * Get current notification for a driver (for debugging/monitoring)
   */
  async getCurrentNotification(
    pilotUserId: string,
  ): Promise<DriverNotification | null> {
    const state = await this.getDriverState(pilotUserId);
    if (!state.currentNotificationId) {
      return null;
    }

    return (
      state.queue.find(
        (n) => n.notificationId === state.currentNotificationId,
      ) || null
    );
  }

  /**
   * Get queue length for a driver (for debugging/monitoring)
   */
  async getQueueLength(pilotUserId: string): Promise<number> {
    const state = await this.getDriverState(pilotUserId);
    return state.queue.filter((n) => n.status === 'PENDING').length;
  }
}
