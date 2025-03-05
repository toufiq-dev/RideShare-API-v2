import { Module, MiddlewareConsumer } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { getJwtConfig } from './config/jwt.config';
import { PrismaModule } from './core/database/prisma.module';
import { RedisModule } from './core/cache/redis.module';
import configuration from './config/configuration';
import { GlobalExceptionFilter } from './common/filters/exception.filter';
import { LoggerModule } from './core/logging/logger.module';
import { AuthModule } from './modules/auth/auth.module';
import { PilotModule } from './modules/pilot/pilot.module';
import { LanguagesModule } from './modules/languages/languages.module';
import { SubscriptionsModule } from './modules/subscriptions/subscriptions.module';
import { ErrorLoggingMiddleware } from './common/middleware/error-logging.middleware';
import { CustomerModule } from './modules/customer/customer.module';
import { RideModule } from './modules/ride/ride.module';
import { AdminModule } from './modules/admin/admin.module';
import { EmailModule } from './modules/email/email.module';
import { PaymentModule } from './modules/payment/payment.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),
    JwtModule.registerAsync({
      global: true,
      useFactory: getJwtConfig,
      inject: [ConfigService],
    }),
    PrismaModule,
    RedisModule,
    LoggerModule,
    AuthModule,
    PilotModule,
    LanguagesModule,
    SubscriptionsModule,
    CustomerModule,
    RideModule,
    AdminModule,
    EmailModule,
    PaymentModule,
  ],
  providers: [GlobalExceptionFilter],
  exports: [JwtModule],
})
export class AppModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(ErrorLoggingMiddleware).forRoutes('*');
  }
}
