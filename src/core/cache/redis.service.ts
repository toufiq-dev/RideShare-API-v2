import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import Redis, { RedisOptions } from 'ioredis';
import { ConfigService } from '@nestjs/config';
import { LoggerService } from '../../core/logging/logger.service';
import { PrismaService } from '../database/prisma.service';
import { RedisKeys } from './redis-keys';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly client: Redis;
  private readonly context = 'RedisService';

  constructor(
    private readonly configService: ConfigService,
    private readonly logger: LoggerService,
    private readonly prisma: PrismaService,
  ) {
    const redisUrl = this.configService.get<string>('redis.url');

    const options: RedisOptions = {
      retryStrategy: (times: number) => Math.min(times * 50, 2000),
      maxRetriesPerRequest: 3,
    };
    this.client = new Redis(redisUrl, options);
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    this.client.on('connect', () => {
      this.logger.log('Redis client connected', this.context);
    });

    this.client.on('error', (error: Error) => {
      this.logger.error(
        `Redis client error: ${error.message}`,
        error.stack,
        this.context,
      );
    });

    this.client.on('reconnecting', () => {
      this.logger.warn('Redis client reconnecting', this.context);
    });
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.client.ping();
      this.logger.log('Redis service initialized successfully', this.context);
    } catch (error) {
      this.logger.error(
        'Failed to initialize Redis service',
        error.stack,
        this.context,
      );
      throw error;
    }
  }

  async onModuleDestroy(): Promise<void> {
    try {
      await this.client.quit();
      this.logger.log('Redis connection closed', this.context);
    } catch (error) {
      this.logger.error(
        'Error closing Redis connection',
        error.stack,
        this.context,
      );
    }
  }

  getClient(): Redis {
    return this.client;
  }

  async set(key: string, value: string, ttl?: number): Promise<void> {
    try {
      if (ttl !== undefined) {
        await this.client.set(key, value, 'EX', ttl);
        this.logger.log(
          `Successfully set key: ${key} with TTL: ${ttl}`,
          this.context,
        );
      } else {
        await this.client.set(key, value);
        this.logger.log(
          `Successfully set key: ${key} with no TTL`,
          this.context,
        );
      }
    } catch (error) {
      this.logger.error(`Failed to set key: ${key}`, error.stack, this.context);
      throw error;
    }
  }

  async get(key: string): Promise<string | null> {
    try {
      const value = await this.client.get(key);
      if (!value) {
        this.logger.log(`Cache miss for key: ${key}`, this.context);
      }
      return value;
    } catch (error) {
      this.logger.error(`Failed to get key: ${key}`, error.stack, this.context);
      throw error;
    }
  }

  async del(key: string): Promise<void> {
    try {
      await this.client.del(key);
      this.logger.log(`Successfully deleted key: ${key}`, this.context);
    } catch (error) {
      this.logger.error(
        `Failed to delete key: ${key}`,
        error.stack,
        this.context,
      );
      throw error;
    }
  }

  async geoAdd(
    key: string,
    latitude: number,
    longitude: number,
    pilotUserId: string,
  ): Promise<number> {
    try {
      console.log('geoAdd', key, latitude, longitude, pilotUserId);
      const result = await this.client.geoadd(
        key,
        longitude,
        latitude,
        pilotUserId,
      );

      const pilot = await this.prisma.pilot.findUnique({
        where: { userId: pilotUserId },
        select: { phone: true },
      });

      this.logger.log(
        `Added ${pilot.phone} to geospatial set ${key} at (${latitude}, ${longitude}) and result, ${result}`,
        this.context,
      );

      return result;
    } catch (error) {
      this.logger.error(
        `Failed to add to geospatial set ${key}`,
        error.stack,
        this.context,
      );
      throw error;
    }
  }

  async geoPos(key: string, member: string): Promise<[number, number] | null> {
    try {
      const result = await this.client.geopos(key, member);

      if (result && result[0]) {
        const [longitude, latitude] = result[0];
        this.logger.log(
          `Fetched pilot ${member} location from ${key}: (${latitude}, ${longitude})`,
          this.context,
        );
        return [Number(latitude), Number(longitude)];
      }
      return null;
    } catch (error) {
      this.logger.error(
        `Failed to get geopos for ${member}`,
        error.stack,
        this.context,
      );
      throw error;
    }
  }

  async geoRadius(
    key: string,
    longitude: number,
    latitude: number,
    radius: number,
    unit: 'm' | 'km' | 'mi' | 'ft',
    options: { withDist?: boolean; sort?: 'ASC' | 'DESC'; count?: number } = {},
  ) {
    try {
      const args: any[] = [key, longitude, latitude, radius, unit];
      if (options.withDist) args.push('WITHDIST');
      if (options.sort) args.push(options.sort);
      if (options.count) args.push('COUNT', options.count);

      // @ts-ignore
      const result = await this.client.georadius(...args);
      this.logger.log(
        `Fetched pilots within ${radius}${unit} from (${latitude}, ${longitude})`,
        this.context,
      );

      return result;
    } catch (error) {
      this.logger.error(
        `Failed to fetch geospatial radius for ${key}`,
        error.stack,
        this.context,
      );
      throw error;
    }
  }

  async zRem(key: string, member: string): Promise<number> {
    try {
      const result = await this.client.zrem(key, member);
      this.logger.log(
        `Removed ${member} from geospatial set ${key}`,
        this.context,
      );

      return result;
    } catch (error) {
      this.logger.error(
        `Failed to remove ${member} from ${key}`,
        error.stack,
        this.context,
      );
      throw error;
    }
  }

  async setActiveRide(
    userId: string,
    bookingId: string,
    customerUserId: string,
    ttl: number = 3600,
  ): Promise<void> {
    const key = `${RedisKeys.ACTIVE_RIDE}${userId}`;

    const value = JSON.stringify({ bookingId, customerUserId });

    await this.client.set(key, value, 'EX', ttl); // TTL in seconds (e.g., 1 hour)

    this.logger.log(`Set active ride cache ${userId}: ${value}`, this.context);
  }

  async getActiveRide(
    userId: string,
  ): Promise<{ bookingId: string; customerUserId: string } | null> {
    const key = `${RedisKeys.ACTIVE_RIDE}${userId}`;

    const value = await this.client.get(key);

    this.logger.log(
      `Retrieved active ride for pilot ${userId}: ${value}`,
      this.context,
    );

    return value ? JSON.parse(value) : null;
  }

  async removeActiveRide(userId: string): Promise<void> {
    const key = `${RedisKeys.ACTIVE_RIDE}${userId}`;
    await this.client.del(key);
    this.logger.log(`Removed active ride for pilot ${userId}`, this.context);
  }

  // Cache booking status with optional TTL (default 1 hour)
  async setBookingStatus(
    bookingId: string,
    status: string,
    ttl: number = 3600,
  ): Promise<void> {
    const key = `${RedisKeys.BOOKING_STATUS}${bookingId}`;
    await this.client.set(key, status, 'EX', ttl);
    this.logger.log(
      `Cached booking status for ${bookingId}: ${status}`,
      this.context,
    );
  }

  async getBookingStatus(bookingId: string): Promise<string | null> {
    const key = `${RedisKeys.BOOKING_STATUS}${bookingId}`;
    const status = await this.client.get(key);
    this.logger.log(
      `Fetched cached booking status for ${bookingId}: ${status}`,
      this.context,
    );
    return status;
  }

  async removeBookingStatus(bookingId: string): Promise<void> {
    const key = `${RedisKeys.BOOKING_STATUS}${bookingId}`;
    await this.client.del(key);
    this.logger.log(
      `Removed cached booking status for ${bookingId}`,
      this.context,
    );
  }
}
