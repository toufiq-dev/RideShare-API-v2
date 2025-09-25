import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor(private configService: ConfigService) {
    const databaseUrl = configService.get<string>('database.url');

    super({
      datasources: {
        db: {
          url: databaseUrl,
        },
      },
      log: [
        { emit: 'event', level: 'query' },
        { emit: 'event', level: 'error' },
        { emit: 'event', level: 'info' },
        { emit: 'event', level: 'warn' },
      ],
      errorFormat: 'pretty',
    });
  }

  async onModuleInit() {
    try {
      await this.$connect();
      const databaseUrl = this.configService.get<string>('database.url');
      console.log(`Connected to database: ${databaseUrl}`);
    } catch (error) {
      throw new Error(`Database connection failed: ${error.message}`);
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
