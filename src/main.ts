import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { GlobalExceptionFilter } from './common/filters/exception.filter';
import { LoggerService } from './core/logging/logger.service';
import { TransformResponseInterceptor } from './common/interceptors/transform-response.interceptor';
import { SocketIOAdapter } from './core/socket/socket.adapter';
import { MetricsService } from './core/metrics/metrics.service';
import { CorrelationIdMiddleware } from './common/middleware/correlation-id.middleware';
import { HttpLoggingInterceptor } from './common/interceptors/http-logging.interceptor';
import { MetricsInterceptor } from './common/interceptors/metrics.interceptor';

async function bootstrap() {
  process.env.TZ = 'UTC';

  const app = await NestFactory.create(AppModule, {
    abortOnError: false,
    bufferLogs: true,
    rawBody: true,
  });

  const logger = app.get(LoggerService);
  const metricsService = app.get(MetricsService);
  const configService = app.get(ConfigService);
  const port = configService.get<number>('app.port');

  app.useLogger(logger);

  // Use IoAdapter for Socket.IO
  app.useWebSocketAdapter(new SocketIOAdapter(app));

  // Add correlation ID middleware (before other middleware)
  app.use(
    new CorrelationIdMiddleware().use.bind(new CorrelationIdMiddleware()),
  );

  app.enableCors({
    origin: [
      'https://dashboard.fairdrivebd.com',
      'https://www.fairdrivebd.com',
      'https://staging-dash.fairdrivebd.com',
      'https://api.v1.fairdrivebd.com',
      'https://api.v2.fairdrivebd.com',
      'https://dev.fairdrivebd.com',
    ],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: [
      'Origin',
      'X-Requested-With',
      'Content-Type',
      'Accept',
      'Authorization',
      'Cache-Control',
      'Pragma',
      'X-Request-ID',
    ],
    credentials: true,
    preflightContinue: false,
    optionsSuccessStatus: 204,
  });

  app.useGlobalFilters(new GlobalExceptionFilter(logger, metricsService));
  app.useGlobalInterceptors(
    new TransformResponseInterceptor(),
    new HttpLoggingInterceptor(logger),
    new MetricsInterceptor(metricsService),
  );

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle('FairDrive API')
    .setDescription(
      'API documentation for the FairDrive Taxi Booking Application',
    )
    .setVersion('1.0')
    .addBearerAuth()
    .addTag('Auth')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api-docs', app, document);

  await app.listen(port, '0.0.0.0');
  logger.log(`Application is running on: http://localhost:${port}`);
  logger.log(`Metrics endpoint: http://localhost:${port}/metrics`);
  logger.log(`Swagger docs: http://localhost:${port}/api-docs`);
}

bootstrap();
