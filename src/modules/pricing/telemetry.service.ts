import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService } from 'src/core/cache/redis.service';
import { LoggerService } from 'src/core/logging/logger.service';

@Injectable()
export class TelemetryService {
  private readonly CITY: string;

  constructor(
    private readonly redis: RedisService,
    private readonly configService: ConfigService,
    private readonly logger: LoggerService,
  ) {
    this.CITY = this.configService.get<string>('pricing.city');
  }

  // called when a quote or ride request is created
  async incrementDemand(h3: string, inc = 1): Promise<void> {
    const key = `D:${this.CITY}:${h3}`;

    try {
      // Use the new incrbyWithExpire method
      await this.redis.incrbyWithExpire(key, inc, 15 * 60);
    } catch (error) {
      this.logger.logError(
        error instanceof Error ? error : new Error(String(error)),
        'TelemetryService',
        { scope: 'incrementDemand' },
      );
    }
  }

  // called by your driver heartbeat/availability change
  async setSupply(h3: string, idleDrivers: number): Promise<void> {
    const key = `S:${this.CITY}:${h3}`;
    try {
      await this.redis.set(key, String(Math.max(0, idleDrivers)));
    } catch (error) {
      this.logger.logError(
        error instanceof Error ? error : new Error(String(error)),
        'TelemetryService',
        { scope: 'setSupply' },
      );
    }
  }

  // optional: get snapshot (for debugging)
  async getDemandSupply(h3: string): Promise<{ D: number; S: number }> {
    try {
      const [d, s] = await this.redis.mget(
        `D:${this.CITY}:${h3}`,
        `S:${this.CITY}:${h3}`,
      );
      return { D: Number(d || '0'), S: Number(s || '0') };
    } catch (error) {
      this.logger.logError(
        error instanceof Error ? error : new Error(String(error)),
        'TelemetryService',
        { scope: 'getDemandSupply' },
      );
      return { D: 0, S: 0 };
    }
  }
}
