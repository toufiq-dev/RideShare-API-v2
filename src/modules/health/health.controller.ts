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

  // src/modules/health/health.controller.ts
  @Get('detailed')
  @HealthCheck()
  async detailedCheck(): Promise<HealthCheckResult> {
    return this.health.check([
      () => this.databaseHealth(),
      () => this.redisHealth(),
      () => this.azureStorageHealth(),
      () => this.memoryHealth(),
    ]);
  }

  private async memoryHealth(): Promise<HealthIndicatorResult> {
    const memUsage = process.memoryUsage();
    const memUsageMB = memUsage.heapUsed / 1024 / 1024;

    return {
      memory: {
        status: memUsageMB < 500 ? 'up' : 'down',
        heapUsed: `${memUsageMB.toFixed(2)}MB`,
      },
    };
  }

  private async azureStorageHealth(): Promise<HealthIndicatorResult> {
    try {
      // Add Azure storage health check
      return {
        azureStorage: {
          status: 'up',
        },
      };
    } catch (error) {
      return {
        azureStorage: {
          status: 'down',
          error: error.message,
        },
      };
    }
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
