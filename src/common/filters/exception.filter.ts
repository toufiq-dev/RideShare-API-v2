import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import { Response } from 'express';
import { Prisma } from '@prisma/client';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status: number;
    let errorMessage: string | object;

    // Handle Prisma-specific errors
    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      switch (exception.code) {
        case 'P2002': // Unique constraint violation
          status = HttpStatus.BAD_REQUEST; // 400
          const targetFields = (exception.meta?.target as string[])?.join(', ');
          errorMessage = `This ${targetFields} already exists.`;
          break;
        default:
          status = HttpStatus.INTERNAL_SERVER_ERROR; // 500
          errorMessage = 'Database error occurred';
          break;
      }
    }
    // Handle NotFoundException
    else if (exception instanceof NotFoundException) {
      status = HttpStatus.NOT_FOUND; // 404
      errorMessage = exception.message || 'Resource not found';
    }
    // Handle other HttpExceptions
    else if (exception instanceof HttpException) {
      status = exception.getStatus();
      errorMessage = exception.getResponse();
    }
    // Fallback for unhandled errors
    else {
      status = HttpStatus.INTERNAL_SERVER_ERROR; // 500
      errorMessage = 'Internal server error';
    }

    // Normalize error message
    const finalMessage =
      typeof errorMessage === 'string'
        ? errorMessage
        : (errorMessage as any).message || 'Unexpected error occurred';

    response.status(status).json({
      success: false,
      message: 'Request failed', // Keeping this consistent; adjust if needed
      error: {
        code: status,
        message: finalMessage,
        path: request.url, // Included for all cases
        timestamp: new Date().toISOString(),
      },
    });
  }
}
