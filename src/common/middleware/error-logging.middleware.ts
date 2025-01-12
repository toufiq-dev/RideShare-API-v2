import { Injectable, NestMiddleware } from '@nestjs/common';
import { LoggerService } from 'src/core/logging/logger.service';

@Injectable()
export class ErrorLoggingMiddleware implements NestMiddleware {
  constructor(private readonly logger: LoggerService) {}

  use(req: any, res: any, next: (err?: any) => void) {
    res.on('finish', () => {
      if (res.statusCode >= 400) {
        this.logger.error(
          `${req.method} ${req.originalUrl} ${res.statusCode} - ${req.ip}`,
          undefined,
          'ErrorLoggingMiddleware',
        );
      }
    });
    next();
  }
}
