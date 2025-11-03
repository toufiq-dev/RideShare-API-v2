import { utilities as nestWinstonModuleUtilities } from 'nest-winston';
import * as winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file'; // Changed this line
import LokiTransport from 'winston-loki';
import { ConfigService } from '@nestjs/config';

export const createWinstonConfig = (
  configService: ConfigService,
): winston.LoggerOptions => {
  const nodeEnv = configService.get<string>('app.environment') || 'development';
  const logLevel = configService.get<string>('logging.level') || 'info';
  const enableFileLogging =
    configService.get<boolean>('logging.enableFileLogging') ?? true;
  const enableLoki = configService.get<boolean>('logging.enableLoki') ?? true;
  const lokiUrl =
    configService.get<string>('logging.lokiUrl') || 'http://loki:3100';

  const transports: winston.transport[] = [];

  // Console transport - Always enabled with pretty format for development
  transports.push(
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
        winston.format.errors({ stack: true }),
        nodeEnv === 'development'
          ? winston.format.combine(
              winston.format.colorize({ all: true }),
              nestWinstonModuleUtilities.format.nestLike('FairDrive', {
                prettyPrint: true,
                colors: true,
              }),
            )
          : winston.format.json(),
      ),
    }),
  );

  // File transports - Rotated daily logs
  if (enableFileLogging) {
    const fileFormat = winston.format.combine(
      winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
      winston.format.errors({ stack: true }),
      winston.format.json(),
      winston.format.metadata({
        fillExcept: ['message', 'level', 'timestamp', 'context'],
      }),
    );

    // Combined logs (all levels)
    transports.push(
      new DailyRotateFile({
        filename: 'logs/combined-%DATE%.log',
        datePattern: 'YYYY-MM-DD',
        zippedArchive: true,
        maxSize: '20m',
        maxFiles: '14d',
        format: fileFormat,
        level: 'info',
      }),
    );

    // Error logs only
    transports.push(
      new DailyRotateFile({
        filename: 'logs/error-%DATE%.log',
        datePattern: 'YYYY-MM-DD',
        zippedArchive: true,
        maxSize: '20m',
        maxFiles: '30d',
        format: fileFormat,
        level: 'error',
      }),
    );

    // HTTP access logs
    transports.push(
      new DailyRotateFile({
        filename: 'logs/http-%DATE%.log',
        datePattern: 'YYYY-MM-DD',
        zippedArchive: true,
        maxSize: '20m',
        maxFiles: '14d',
        format: fileFormat,
        level: 'http',
      }),
    );
  }

  // Loki transport - Log aggregation for Grafana
  if (enableLoki && nodeEnv === 'production') {
    transports.push(
      new LokiTransport({
        host: lokiUrl,
        json: true,
        format: winston.format.json(),
        labels: {
          app: 'fairdrive-api',
          environment: nodeEnv,
          version: process.env.API_VERSION || 'v1',
        },
        onConnectionError: (err) => {
          console.error('Loki connection error:', err);
        },
        gracefulShutdown: false,
      }),
    );
  }

  return {
    level: logLevel,
    format: winston.format.combine(
      winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
      winston.format.errors({ stack: true }),
      winston.format.splat(),
      winston.format.json(),
      winston.format.metadata(),
    ),
    defaultMeta: {
      service: 'fairdrive-api',
      environment: nodeEnv,
      version: process.env.API_VERSION || 'v1',
    },
    transports,
    exceptionHandlers: [
      new winston.transports.File({ filename: 'logs/exceptions.log' }),
      new winston.transports.Console(),
    ],
    rejectionHandlers: [
      new winston.transports.File({ filename: 'logs/rejections.log' }),
      new winston.transports.Console(),
    ],
  };
};
