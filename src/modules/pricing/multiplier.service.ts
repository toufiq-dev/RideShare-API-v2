import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression, SchedulerRegistry } from '@nestjs/schedule';
import { RedisService } from 'src/core/cache/redis.service';
import { ArtifactsService } from 'src/modules/pricing/artifacts.service';
import { neighbors } from 'src/core/utils/h3.util';

const CITY = process.env.CITY || 'dhaka';
const MU_MIN = Number(process.env.MU_MIN || 0.9);
const MU_MAX = Number(process.env.MU_MAX || 1.6);
const DELTA_MAX = Number(process.env.DELTA_MAX || 0.1);
const ALPHA = Number(process.env.CAL_ALPHA || 0.6);
const KAPPA = Number(process.env.CAL_KAPPA || 0.15);
const RHO_STAR = Number(process.env.RHO_STAR || 1.0);

@Injectable()
export class MultiplierService {
  private readonly log = new Logger(MultiplierService.name);

  constructor(
    private readonly redis: RedisService,
    private readonly art: ArtifactsService,
  ) {}

  async getMu(city: string, h3: string, hour: number): Promise<number> {
    const currKey = `mu:${city}:${h3}:${hour}`;
    const priorKey = `mu_prior:${city}:${h3}:${hour}`;
    const [curr, prior] = await this.redis.mget(currKey, priorKey);
    return Number(curr ?? prior ?? 1.0) || 1.0;
  }

  applyAdjustments(
    mu: number,
    serviceName: string,
    distKm: number,
    detourRatio?: number,
  ): number {
    // distance slab adjustment (cars only typically)
    const slab = this.art.slab.get(serviceName);
    if (slab) {
      const beta =
        distKm <= 5 ? slab.short : distKm <= 12 ? slab.normal : slab.long;
      mu *= Number(beta) || 1;
    }
    // detour premium
    if (detourRatio && detourRatio > this.art.detour.threshold) {
      mu *= this.art.detour.premium;
    }
    return mu;
  }

  private stepLimit(newVal: number, prev: number): number {
    if (!isFinite(prev)) return newVal;
    const up = Math.min(prev + DELTA_MAX, newVal);
    const dn = Math.max(prev - DELTA_MAX, newVal);
    const bounded = newVal >= prev ? up : dn;
    return Math.min(MU_MAX, Math.max(MU_MIN, bounded));
  }

  @Cron(CronExpression.EVERY_5_MINUTES)
  async updateMuTick() {
    // Read all known zone:hour pairs from artifacts
    const pipe = this.redis.pipeline();
    const getCurr: Array<Promise<any>> = [];
    const keys: Array<{ h3: string; hour: number }> = [];

    for (const k of this.art.cells) {
      const [h3, hourStr] = k.split(':');
      const hour = Number(hourStr);
      keys.push({ h3, hour });
      getCurr.push(this.redis.get(`mu:${CITY}:${h3}:${hour}`));
    }
    const currVals = await Promise.all(getCurr);

    // Compute new μ from prior μ, demand/supply (last 5–15 min), and step/caps.
    const updates: Array<{ key: string; val: string }> = [];
    for (let i = 0; i < keys.length; i++) {
      const { h3, hour } = keys[i];
      const prev = Number(currVals[i] || '1');

      const priorStr = await this.redis.get(`mu_prior:${CITY}:${h3}:${hour}`);
      const prior = Number(priorStr || '1');

      // live demand & supply (TelemetryService maintains these keys)
      const dStr = await this.redis.get(`D:${CITY}:${h3}`); // recent demand
      const sStr = await this.redis.get(`S:${CITY}:${h3}`); // current supply
      const D = Number(dStr || '0');
      const S = Math.max(1, Number(sStr || '1')); // avoid div0

      // EMA-like control: ALPHA * prior + (1-ALPHA)*prev + KAPPA*(D/S - RHO*)
      let raw = ALPHA * prior + (1 - ALPHA) * prev + KAPPA * (D / S - RHO_STAR);

      // optional neighbor smoothing (use previous μ of neighbors)
      const neigh = neighbors(h3);
      if (neigh.length) {
        const nmus = await this.redis.mget(
          ...neigh.map((n) => `mu:${CITY}:${n}:${hour}`),
        );
        const valid = nmus.map(Number).filter((x) => Number.isFinite(x));
        if (valid.length)
          raw =
            0.8 * raw + 0.2 * (valid.reduce((a, b) => a + b, 0) / valid.length);
      }

      const next = this.stepLimit(raw, prev);
      updates.push({ key: `mu:${CITY}:${h3}:${hour}`, val: next.toFixed(4) });
    }

    for (const u of updates) pipe.set(u.key, u.val);
    await pipe.exec();
    this.log.log(`CAL tick updated μ for ${updates.length} zone-hour entries`);
  }
}
