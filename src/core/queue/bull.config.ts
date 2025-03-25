import { ConfigService } from '@nestjs/config';
import { QueueOptions } from 'bullmq';

export const getBullConfig = (configService: ConfigService): QueueOptions => {
  const redisUrl = configService.get<string>('redis.url');
  return {
    connection: {
      url: redisUrl,
    },
    defaultJobOptions: {
      removeOnComplete: true,
      removeOnFail: 100, // keep last 100 failed jobs
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 1000,
      },
    },
  };
};
