import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response, Request } from 'express';
import { Prisma } from '@prisma/client';
import { LoggerService } from 'src/core/logging/logger.service';
import { MetricsService } from 'src/core/metrics/metrics.service';
import { getRequestContext } from 'src/common/middleware/correlation-id.middleware';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  constructor(
    private readonly logger: LoggerService,
    private readonly metrics: MetricsService,
  ) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const requestContext = getRequestContext();

    let status: number;
    let errorMessage: string | object;
    let errorType = 'UnknownError';

    // Handle Prisma-specific errors
    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      errorType = 'PrismaError';
      switch (exception.code) {
        case 'P2002':
          status = HttpStatus.BAD_REQUEST;
          const targetFields = (exception.meta?.target as string[])?.join(', ');
          errorMessage = `This ${targetFields} already exists.`;
          break;
        default:
          status = HttpStatus.INTERNAL_SERVER_ERROR;
          errorMessage = 'Database error occurred';
      }
    } else if (exception instanceof HttpException) {
      errorType = 'HttpException';
      status = exception.getStatus();
      errorMessage = exception.getResponse();
    } else if (exception instanceof Error) {
      errorType = 'Error';
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      errorMessage = exception.message || 'Something went wrong';

      // Log full error with stack trace
      this.logger.logError(exception, 'GlobalExceptionFilter', {
        requestId: requestContext?.requestId,
        method: request.method,
        url: request.url,
        userId: requestContext?.userId,
        ip: request.ip,
      });
    } else {
      errorType = 'UnknownError';
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      errorMessage = 'Unexpected error occurred';
    }

    // Normalize error message
    let finalMessage: string;
    if (typeof errorMessage === 'string') {
      finalMessage = errorMessage;
    } else if (Array.isArray((errorMessage as any).message)) {
      finalMessage = (errorMessage as any).message[0];
    } else {
      finalMessage =
        (errorMessage as any).message || 'Unexpected error occurred';
    }

    // Log error with structured data
    this.logger.error(
      `Exception: ${errorType} - ${finalMessage}`,
      exception instanceof Error ? exception.stack : undefined,
      'GlobalExceptionFilter',
    );

    // Record error metrics
    const route = (request as any).route?.path || request.url;
    this.metrics.httpRequestErrors.inc({
      method: request.method,
      route: this.sanitizeRoute(route),
      status_code: status.toString(),
      version: process.env.API_VERSION || 'v1',
      error_type: errorType,
    });

    response.status(status).json({
      success: false,
      message: finalMessage,
      error: {
        code: status,
        message: finalMessage,
        path: request.url,
        timestamp: new Date().toISOString(),
        requestId: requestContext?.requestId,
      },
    });
  }

  private sanitizeRoute(route: string): string {
    return route
      .replace(
        /\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
        '/:id',
      )
      .replace(/\/\d+/g, '/:id')
      .replace(/\?.*$/, '');
  }
}
