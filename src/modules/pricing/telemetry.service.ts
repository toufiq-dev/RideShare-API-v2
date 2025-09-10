import { Injectable } from '@nestjs/common';
import { RedisService } from 'src/core/cache/redis.service';

const CITY = process.env.CITY || 'dhaka';

@Injectable()
export class TelemetryService {
  constructor(private readonly redis: RedisService) {}

  // called when a quote or ride request is created
  async incrementDemand(h3: string, inc = 1): Promise<void> {
    const key = `D:${CITY}:${h3}`;
    const pipe = this.redis.pipeline();
    pipe.incrby(key, inc);
    pipe.expire(key, 15 * 60); // keep last 15 minutes
    await pipe.exec();
  }

  // called by your driver heartbeat/availability change
  async setSupply(h3: string, idleDrivers: number): Promise<void> {
    await this.redis.set(`S:${CITY}:${h3}`, String(Math.max(0, idleDrivers)));
  }

  // optional: get snapshot (for debugging)
  async getDemandSupply(h3: string): Promise<{ D: number; S: number }> {
    const [d, s] = await this.redis.mget(`D:${CITY}:${h3}`, `S:${CITY}:${h3}`);
    return { D: Number(d || '0'), S: Number(s || '0') };
  }
}
