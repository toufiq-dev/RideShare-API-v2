import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import {
  HealthCheck,
  HealthCheckService,
  HealthCheckResult,
  HealthIndicatorResult,
} from '@nestjs/terminus';
import { PrismaService } from 'src/core/database/prisma.service';
import { RedisService } from 'src/core/cache/redis.service';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private prisma: PrismaService,
    private redis: RedisService,
  ) {}

  @Get()
  @HealthCheck()
  @ApiOperation({ summary: 'Health check endpoint' })
  @ApiResponse({ status: 200, description: 'Service is healthy' })
  @ApiResponse({ status: 503, description: 'Service is unhealthy' })
  async check(): Promise<HealthCheckResult> {
    return this.health.check([
      () => this.databaseHealth(),
      () => this.redisHealth(),
    ]);
  }

  private async databaseHealth(): Promise<HealthIndicatorResult> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return {
        database: {
          status: 'up',
        },
      } as HealthIndicatorResult;
    } catch (error) {
      return {
        database: {
          status: 'down',
          error: error.message,
        },
      } as HealthIndicatorResult;
    }
  }

  private async redisHealth(): Promise<HealthIndicatorResult> {
    try {
      await this.redis.getClient().ping();
      return {
        redis: {
          status: 'up',
        },
      } as HealthIndicatorResult;
    } catch (error) {
      return {
        redis: {
          status: 'down',
          error: error.message,
        },
      } as HealthIndicatorResult;
    }
  }
}
