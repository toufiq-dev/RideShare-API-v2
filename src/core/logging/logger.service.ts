import { Injectable, ConsoleLogger } from '@nestjs/common';

@Injectable()
export class LoggerService extends ConsoleLogger {
  log(message: string, context?: string) {
    super.log(`[${new Date().toISOString()}] ${message}`, context);
  }

  error(message: string, trace?: string, context?: string) {
    super.error(message, trace, context);
  }

  warn(message: string, context?: string) {
    super.warn(message, context);
  }
}
