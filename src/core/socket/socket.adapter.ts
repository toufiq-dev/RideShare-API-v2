import { INestApplicationContext } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { ServerOptions } from 'socket.io';
import { LoggerService } from 'src/core/logging/logger.service';

export class SocketIOAdapter extends IoAdapter {
  constructor(
    app: INestApplicationContext,
    private readonly logger: LoggerService,
  ) {
    super(app);
  }

  createIOServer(port: number, options?: ServerOptions): any {
    const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [
      'https://dashboard.fairdrivebd.com',
      'https://www.fairdrivebd.com',
      'https://staging-dash.fairdrivebd.com',
      'https://api.v1.fairdrivebd.com',
      'https://api.v2.fairdrivebd.com',
      'https://dev.fairdrivebd.com',
    ];

    const server = super.createIOServer(port, {
      ...options,
      cors: {
        origin: allowedOrigins,
        methods: ['GET', 'POST'],
        credentials: true,
      },
      transports: ['websocket', 'polling'],
    });

    this.logger.debug(
      `Socket.IO server created (port=${port}, transports=${JSON.stringify(server.engine?.transports)})`,
      'SocketIOAdapter',
    );
    this.logger.debug(
      `Socket.IO CORS origins count=${allowedOrigins.length}`,
      'SocketIOAdapter',
    );

    return server;
  }
}
