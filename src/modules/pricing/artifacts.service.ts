import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as readline from 'node:readline';
import { RedisService } from '../../core/cache/redis.service';

type Slab = 'short' | 'normal' | 'long';

@Injectable()
export class ArtifactsService implements OnModuleInit {
  private readonly log = new Logger(ArtifactsService.name);
  private slabBetas = new Map<
    string,
    { short: number; normal: number; long: number }
  >();
  private detourPremium = { threshold: 1.25, premium: 1.0 };
  private knownCells = new Set<string>();

  constructor(private readonly redis: RedisService) {}

  get slab() {
    return this.slabBetas;
  }
  get detour() {
    return this.detourPremium;
  }
  get cells() {
    return this.knownCells;
  }

  async onModuleInit() {
    const dir = process.env.ARTIFACTS_DIR || './artifacts';
    const city = process.env.CITY || 'dhaka';

    // 1) load zone-hour prior to Redis (and initialize current mu to prior)
    const priorPath = path.join(dir, 'mu_zonehour.jsonl'); // from Colab
    await this.loadZoneHourPriorJSONL(priorPath, city);

    // 2) load slab betas to memory
    const slabPath = path.join(dir, 'slab_betas.json');
    await this.loadSlabBetasJSON(slabPath);

    // 3) detour premium
    const detourPath = path.join(dir, 'detour_premium.json');
    if (fs.existsSync(detourPath)) {
      this.detourPremium = JSON.parse(fs.readFileSync(detourPath, 'utf-8'));
      this.log.log(`Detour premium: ${JSON.stringify(this.detourPremium)}`);
    }
  }

  private async loadZoneHourPriorJSONL(file: string, city: string) {
    const rl = readline.createInterface({
      input: fs.createReadStream(file),
      crlfDelay: Infinity,
    });
    const pipe = this.redis.pipeline();
    let n = 0;
    for await (const line of rl) {
      if (!line.trim()) continue;
      const { pickup_h3_r8, hour, mu_prior } = JSON.parse(line);
      if (!pickup_h3_r8 && pickup_h3_r8 !== 0) continue;
      const keyPrior = `mu_prior:${city}:${pickup_h3_r8}:${hour}`;
      const keyCurr = `mu:${city}:${pickup_h3_r8}:${hour}`;
      pipe.set(keyPrior, Number(mu_prior).toFixed(4));
      pipe.set(keyCurr, Number(mu_prior).toFixed(4));
      this.knownCells.add(`${pickup_h3_r8}:${hour}`);
      n++;
      if (n % 5000 === 0) await pipe.exec();
    }
    await pipe.exec();
    this.log.log(`Loaded ${n} zone-hour priors for ${city}`);
  }

  private async loadSlabBetasJSON(file: string) {
    const arr = JSON.parse(fs.readFileSync(file, 'utf-8')) as Array<{
      service_name: string;
      slab: Slab;
      beta: number;
    }>;
    const grouped = new Map<
      string,
      { short: number; normal: number; long: number }
    >();
    for (const r of arr) {
      const s = r['service_name'] || r['serviceName'];
      if (!grouped.has(s)) grouped.set(s, { short: 1, normal: 1, long: 1 });
      grouped.get(s)![r.slab] = Number(r.beta) || 1;
    }
    this.slabBetas = grouped;
    this.log.log(`Loaded slab betas for ${grouped.size} services`);
  }
}
