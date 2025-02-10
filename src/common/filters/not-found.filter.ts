import {
  ExceptionFilter,
  Catch,
  NotFoundException,
  ArgumentsHost,
} from '@nestjs/common';
import { Response } from 'express';

@Catch(NotFoundException)
export class NotFoundFilter implements ExceptionFilter {
  catch(exception: NotFoundException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    response.status(404).json({
      success: false,
      message: 'Resource not found',
      error: {
        code: 404,
        message: `Cannot ${request.method} ${request.url}`,
        path: request.url,
        timestamp: new Date().toISOString(),
      },
    });
  }
}
