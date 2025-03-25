import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import Redis, { RedisOptions } from 'ioredis';
import { ConfigService } from '@nestjs/config';
import { LoggerService } from '../../core/logging/logger.service';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly client: Redis;
  private readonly context = 'RedisService';

  constructor(
    private readonly configService: ConfigService,
    private readonly logger: LoggerService,
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

  async set(key: string, value: string, ttl: number): Promise<void> {
    try {
      await this.client.set(key, value, 'EX', ttl);
      this.logger.log(
        `Successfully set key: ${key} with TTL: ${ttl}`,
        this.context,
      );
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
    longitude: number,
    latitude: number,
    member: string,
  ): Promise<number> {
    try {
      const result = await this.client.geoadd(key, longitude, latitude, member);
      this.logger.log(
        `Added ${member} to geospatial set ${key} at (${latitude}, ${longitude})`,
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
}
