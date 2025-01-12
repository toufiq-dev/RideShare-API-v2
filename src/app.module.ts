import { Module, MiddlewareConsumer } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './core/database/prisma.module';
import { RedisModule } from './core/cache/redis.module';
import configuration from './config/configuration';
import { GlobalExceptionFilter } from './common/filters/exception.filter';
import { LoggerModule } from './core/logging/logger.module';
import { AuthModule } from './modules/auth/auth.module';
import { PilotModule } from './modules/pilot/pilot.module';
import { LanguagesModule } from './modules/languages/languages.module';
import { DocumentsModule } from './modules/documents/documents.module';
import { VehiclesModule } from './modules/vehicles/vehicles.module';
import { SubscriptionsModule } from './modules/subscriptions/subscriptions.module';
import { ErrorLoggingMiddleware } from './common/middleware/error-logging.middleware';

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
  providers: [GlobalExceptionFilter],
})
export class AppModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(ErrorLoggingMiddleware).forRoutes('*');
  }
}
