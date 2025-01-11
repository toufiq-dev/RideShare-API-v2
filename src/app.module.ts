import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './core/database/prisma.module';
import { RedisModule } from './core/cache/redis.module';
import configuration from './config/configuration';
import { LoggerModule } from './core/logging/logger.module';
import { AuthModule } from './modules/auth/auth.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { PilotModule } from './modules/pilot/pilot.module';
import { LanguagesModule } from './modules/languages/languages.module';
import { DocumentsModule } from './modules/documents/documents.module';
import { VehiclesModule } from './modules/vehicles/vehicles.module';
import { SubscriptionsModule } from './modules/subscriptions/subscriptions.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),
    PrismaModule,
    RedisModule,
    LoggerModule,
    AuthModule,
    PilotModule,
    LanguagesModule,
    DocumentsModule,
    VehiclesModule,
    SubscriptionsModule,
  ],
  providers: [HttpExceptionFilter],
})
export class AppModule {}
