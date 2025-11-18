import { JwtModule } from '@nestjs/jwt';
import configuration from './config/app.config';
import { getJwtConfig } from './config/jwt.config';
import { BullModule } from '@nestjs/bullmq';
import { getBullConfig } from './core/queue/bull.config';
import { Module, MiddlewareConsumer } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { DatabaseModule } from './core/database/database.module';
import { RedisModule } from './core/cache/redis.module';
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
import { FareModule } from './modules/fare/fare.module';
import { GeofencingModule } from './core/geofencing/geofencing.module';
import { ChatModule } from './modules/chat/chat.module';
import { FirebaseModule } from './core/firebase/firebase.module';
import { PricingModule } from './modules/pricing/pricing.module';
import { HealthModule } from './modules/health/health.module';
import { SocketModule } from './core/socket/socket.module';
import { MainGateway } from './core/socket/main.gateway';
import { ScheduleModule } from '@nestjs/schedule';
import { ProgramModule } from './modules/program/program.module';
import { MetricsModule } from './core/metrics/metrics.module';
import { CorrelationIdMiddleware } from './common/middleware/correlation-id.middleware';
import { MapsModule } from './modules/maps/maps.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),
    ScheduleModule.forRoot(),
    JwtModule.registerAsync({
      global: true,
      useFactory: getJwtConfig,
      inject: [ConfigService],
    }),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: getBullConfig,
    }),
    DatabaseModule,
    RedisModule,
    LoggerModule,
    MetricsModule,
    SocketModule,
    AuthModule,
    PilotModule,
    LanguagesModule,
    SubscriptionsModule,
    CustomerModule,
    RideModule,
    AdminModule,
    EmailModule,
    PaymentModule,
    FareModule,
    GeofencingModule,
    ChatModule,
    FirebaseModule,
    PricingModule,
    HealthModule,
    ProgramModule,
    MapsModule,
  ],
  providers: [GlobalExceptionFilter, MainGateway],
  exports: [JwtModule],
})
export class AppModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(CorrelationIdMiddleware).forRoutes('*');
    consumer.apply(ErrorLoggingMiddleware).forRoutes('*');
  }
}
