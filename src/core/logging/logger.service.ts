import { Injectable, LoggerService as NestLoggerService } from '@nestjs/common';
import { WinstonLogger } from 'nest-winston';
import * as winston from 'winston';
import { createWinstonConfig } from './winston.config';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class LoggerService extends WinstonLogger implements NestLoggerService {
  private readonly winstonLogger: winston.Logger;

  constructor(private readonly configService: ConfigService) {
    const config = createWinstonConfig(configService);
    const logger = winston.createLogger(config);
    super(logger);
    this.winstonLogger = logger; // Store reference to winston logger
  }

  log(message: string, context?: string) {
    super.log(message, context);
  }

  error(message: string, trace?: string, context?: string) {
    super.error(message, trace, context);
  }

  warn(message: string, context?: string) {
    super.warn(message, context);
  }

  debug(message: string, context?: string) {
    super.debug(message, context);
  }

  verbose(message: string, context?: string) {
    super.verbose(message, context);
  }

  // Custom logging methods with structured data
  logHttp(data: {
    method: string;
    url: string;
    statusCode: number;
    duration: number;
    requestId?: string;
    userId?: string;
    ip?: string;
    userAgent?: string;
  }) {
    this.winstonLogger.http('HTTP Request', {
      ...data,
      context: 'HTTP',
    });
  }

  logError(error: Error, context?: string, metadata?: Record<string, any>) {
    this.winstonLogger.error(error.message, {
      stack: error.stack,
      context: context || 'Error',
      ...metadata,
    });
  }

  logBusinessEvent(event: string, metadata?: Record<string, any>) {
    this.winstonLogger.info(`[BUSINESS_EVENT] ${event}`, {
      event,
      context: 'Business',
      ...metadata,
    });
  }

  logPerformance(operation: string, duration: number, metadata?: Record<string, any>) {
    this.winstonLogger.info(`[PERFORMANCE] ${operation}`, {
      operation,
      duration,
      durationMs: duration,
      context: 'Performance',
      ...metadata,
    });
  }

  logSecurity(event: string, metadata?: Record<string, any>) {
    this.winstonLogger.warn(`[SECURITY] ${event}`, {
      event,
      context: 'Security',
      ...metadata,
    });
  }
}