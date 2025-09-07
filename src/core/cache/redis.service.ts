import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import Redis, { RedisOptions } from 'ioredis';
import { ConfigService } from '@nestjs/config';
import { LoggerService } from '../../core/logging/logger.service';
import { PrismaService } from '../database/prisma.service';
import { RedisKeys } from './redis-keys';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly client: Redis;
  private readonly publisherClient: Redis;
  private readonly subscriberClient: Redis;
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

    // Main client for regular operations
    this.client = new Redis(redisUrl, options);

    this.publisherClient = new Redis(redisUrl, options);

    this.subscriberClient = new Redis(redisUrl, options);

    this.setupEventListeners();
  }

  pipeline(): any {
    return this.client.pipeline();
  }

  private setupEventListeners(): void {
    // Event listeners for main client
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

    // Event listeners for pub/sub client
    this.publisherClient.on('connect', () => {
      this.logger.log('Redis publisher client connected', this.context);
    });
    this.subscriberClient.on('connect', () => {
      this.logger.log('Redis subscriber client connected', this.context);
    });

    this.publisherClient.on('error', (error: Error) => {
      this.logger.error(
        `Redis publisher client error: ${error.message}`,
        error.stack,
        this.context,
      );
    });
    this.subscriberClient.on('error', (error: Error) => {
      this.logger.error(
        `Redis subscriber client error: ${error.message}`,
        error.stack,
        this.context,
      );
    });

    this.publisherClient.on('reconnecting', () => {
      this.logger.warn('Redis publisher client reconnecting', this.context);
    });
    this.subscriberClient.on('reconnecting', () => {
      this.logger.warn('Redis subscriber client reconnecting', this.context);
    });
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.client.ping();
      await this.publisherClient.ping();
      await this.subscriberClient.ping();
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
      await this.publisherClient.quit();
      await this.subscriberClient.quit();
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

  async mget(...keys: string[]): Promise<(string | null)[]> {
    try {
      if (keys.length === 0) return [];

      const values = await this.client.mget(...keys);
      this.logger.log(`Retrieved ${keys.length} keys using mget`, this.context);
      return values;
    } catch (error) {
      this.logger.error(`Failed to mget keys`, error.stack, this.context);
      throw error;
    }
  }

  async mset(keyValuePairs: Record<string, string>): Promise<void> {
    try {
      const args: string[] = [];
      Object.entries(keyValuePairs).forEach(([key, value]) => {
        args.push(key, value);
      });

      await this.client.mset(...args);
      this.logger.log(
        `Set ${Object.keys(keyValuePairs).length} keys using mset`,
        this.context,
      );
    } catch (error) {
      this.logger.error(`Failed to mset keys`, error.stack, this.context);
      throw error;
    }
  }

  async subscribe(channel: string): Promise<void> {
    try {
      await this.subscriberClient.subscribe(channel);
      this.logger.log(`Subscribed to channel: ${channel}`, this.context);
    } catch (error) {
      this.logger.error(
        `Failed to subscribe to channel: ${channel}`,
        error.stack,
        this.context,
      );
      throw error;
    }
  }

  async unsubscribe(channel: string): Promise<void> {
    try {
      await this.subscriberClient.unsubscribe(channel);
      this.logger.log(`Unsubscribed from channel: ${channel}`, this.context);
    } catch (error) {
      this.logger.error(
        `Failed to unsubscribe from channel: ${channel}`,
        error.stack,
        this.context,
      );
      throw error;
    }
  }

  async publish(channel: string, message: string): Promise<number> {
    try {
      const result = await this.publisherClient.publish(channel, message);
      this.logger.log(`Published message to channel: ${channel}`, this.context);
      return result;
    } catch (error) {
      this.logger.error(
        `Failed to publish to channel: ${channel}`,
        error.stack,
        this.context,
      );
      throw error;
    }
  }

  onMessage(callback: (channel: string, message: string) => void): void {
    this.subscriberClient.on('message', callback);
  }

  offMessage(callback: (channel: string, message: string) => void): void {
    this.subscriberClient.off('message', callback);
  }

  async exists(key: string): Promise<boolean> {
    try {
      const result = await this.client.exists(key);
      return result === 1;
    } catch (error) {
      this.logger.error(
        `Failed to check existence of key: ${key}`,
        error.stack,
        this.context,
      );
      throw error;
    }
  }

  async setnx(key: string, value: string, ttl?: number): Promise<boolean> {
    try {
      let result: string;
      if (ttl) {
        result = await this.client.set(key, value, 'EX', ttl, 'NX');
      } else {
        result = await this.client.set(key, value, 'NX');
      }
      return result === 'OK';
    } catch (error) {
      this.logger.error(
        `Failed to setnx key: ${key}`,
        error.stack,
        this.context,
      );
      throw error;
    }
  }

  async mgetWithTTL(
    keys: string[],
  ): Promise<Array<{ value: string | null; ttl: number }>> {
    try {
      const pipeline = this.client.pipeline();
      keys.forEach((key) => {
        pipeline.get(key);
        pipeline.ttl(key);
      });

      const results = await pipeline.exec();
      const response: Array<{ value: string | null; ttl: number }> = [];

      for (let i = 0; i < keys.length; i++) {
        const valueResult = results[i * 2];
        const ttlResult = results[i * 2 + 1];

        response.push({
          value: valueResult[1] as string | null,
          ttl: ttlResult[1] as number,
        });
      }

      return response;
    } catch (error) {
      this.logger.error(
        `Failed to mgetWithTTL for keys`,
        error.stack,
        this.context,
      );
      throw error;
    }
  }
}
