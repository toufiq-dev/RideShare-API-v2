import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const message =
      exception instanceof HttpException
        ? exception.getResponse()
        : 'Internal server error';

    console.error('Exception Caught:', exception); // Logs the error stack

    response.status(status).json({
      success: false,
      message: 'Request failed',
      error: {
        code: status,
        message:
          typeof message === 'string'
            ? message
            : (message as any).message || 'Unexpected error occurred',
        path: request.url,
        timestamp: new Date().toISOString(),
      },
    });
  }
}
