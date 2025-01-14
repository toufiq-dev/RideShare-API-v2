import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
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

    this.client = new Redis(redisUrl, {
      retryStrategy: (times: number) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      maxRetriesPerRequest: 3,
    });

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
}
