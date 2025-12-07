import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private pool: Pool;

  constructor(private configService: ConfigService) {
    const databaseUrl = configService.get<string>('database.url');

    // Create a PostgreSQL pool as a local variable first
    const pool = new Pool({
      connectionString: databaseUrl,
    });

    // Create the adapter using the local pool variable
    const adapter = new PrismaPg(pool);

    // Call super() first before accessing 'this'
    super({
      adapter,
      log: [
        { emit: 'event', level: 'query' },
        { emit: 'event', level: 'error' },
        { emit: 'event', level: 'info' },
        { emit: 'event', level: 'warn' },
      ],
      errorFormat: 'pretty',
    });

    this.pool = pool;
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
    await this.pool.end();
  }
}
