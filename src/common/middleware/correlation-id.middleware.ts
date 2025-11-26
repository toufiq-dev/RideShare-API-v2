import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { AsyncLocalStorage } from 'async_hooks';

export class RequestContext {
  constructor(
    public readonly requestId: string,
    public readonly userId?: string,
    public readonly startTime: number = Date.now(),
  ) {}

  getDuration(): number {
    return Date.now() - this.startTime;
  }
}

const asyncLocalStorage = new AsyncLocalStorage<RequestContext>();

@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const requestId = (req.headers['x-request-id'] as string) || uuidv4();
    const userId = req.user ? (req.user as any).userId : undefined;
    const context = new RequestContext(requestId, userId);

    // Store in AsyncLocalStorage for request lifecycle
    asyncLocalStorage.run(context, () => {
      // Add to request object for easy access
      (req as any).requestId = requestId;
      (req as any).requestContext = context;

      // Add to response headers
      res.setHeader('X-Request-ID', requestId);

      next();
    });
  }
}

// Helper function to get current request context
export function getRequestContext(): RequestContext | undefined {
  return asyncLocalStorage.getStore();
}
