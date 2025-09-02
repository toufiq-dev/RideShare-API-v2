import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { GlobalExceptionFilter } from './common/filters/exception.filter';
import { LoggerService } from './core/logging/logger.service';
import { TransformResponseInterceptor } from './common/interceptors/transform-response.interceptor';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { WinstonModule } from 'nest-winston';
import { winstonConfig } from './core/logging/winston.config';

async function bootstrap() {
  process.env.TZ = 'UTC';

  const app = await NestFactory.create(AppModule, {
    abortOnError: false,
    logger: WinstonModule.createLogger(winstonConfig),
  });

  const logger = app.get(LoggerService);
  const configService = app.get(ConfigService);
  const port = configService.get<number>('app.port');

  app.useLogger(logger);

  app.enableCors({
    origin: [
      'https://dashboard.fairdrive.com.bd',
      'https://api.fairdriveindia.com',
      'https://www.fairdrive.com.bd',
      // Add other allowed origins as needed
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
    ],
    credentials: true,
    preflightContinue: false,
    optionsSuccessStatus: 204,
  });

  app.useGlobalFilters(new GlobalExceptionFilter());
  app.useGlobalInterceptors(new TransformResponseInterceptor());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  // Use IoAdapter for Socket.IO
  app.useWebSocketAdapter(new IoAdapter(app));

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

  await app.listen(port);
  logger.log(`Application is running on: http://localhost:${port}`);
}
bootstrap();
