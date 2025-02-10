import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { GlobalExceptionFilter } from './common/filters/exception.filter';
import { LoggerService } from './core/logging/logger.service';
import { TransformResponseInterceptor } from './common/interceptors/transform-response.interceptor';
import { WsAdapter } from '@nestjs/platform-ws';
import { NotFoundFilter } from './common/filters/not-found.filter';
async function bootstrap() {
  const app = await NestFactory.create(AppModule, { abortOnError: false });
  app.useWebSocketAdapter(new WsAdapter(app));
  
  const logger = app.get(LoggerService);
  const configService = app.get(ConfigService);
  const port = configService.get<number>('app.port');

  app.enableCors();
  app.setGlobalPrefix('api');

  app.useGlobalFilters(new GlobalExceptionFilter(), new NotFoundFilter());
  app.useGlobalInterceptors(new TransformResponseInterceptor());

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

  app.useLogger(logger);

  await app.listen(port);
  logger.log(`Application is running on: http://localhost:${port}`);
}
bootstrap();
