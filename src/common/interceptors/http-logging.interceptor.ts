import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { LoggerService } from 'src/core/logging/logger.service';
import { getRequestContext } from 'src/common/middleware/correlation-id.middleware';

@Injectable()
export class HttpLoggingInterceptor implements NestInterceptor {
  constructor(private readonly logger: LoggerService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();
    const requestContext = getRequestContext();
    const startTime = Date.now();

    const { method, url, ip, headers } = request;
    const userAgent = headers['user-agent'] || 'unknown';
    const userId = (request.user as any)?.userId || requestContext?.userId;

    // Log incoming request
    this.logger.log(`Incoming ${method} ${url}`, 'HTTP');

    return next.handle().pipe(
      tap(() => {
        const duration = Date.now() - startTime;
        const statusCode = response.statusCode;

        // Enhanced HTTP logging
        this.logger.logHttp({
          method,
          url,
          statusCode,
          duration,
          requestId: requestContext?.requestId,
          userId,
          ip,
          userAgent,
        });

        // Log slow requests (>1s)
        if (duration > 1000) {
          this.logger.warn(
            `Slow request detected: ${method} ${url} took ${duration}ms`,
            'HTTP',
          );
        }
      }),
      catchError((error) => {
        const duration = Date.now() - startTime;
        const statusCode = error.status || 500;

        this.logger.error(`HTTP Error: ${method} ${url}`, error.stack, 'HTTP');
        this.logger.logHttp({
          method,
          url,
          statusCode,
          duration,
          requestId: requestContext?.requestId,
          userId,
          ip,
          userAgent,
        });

        throw error;
      }),
    );
  }
}
