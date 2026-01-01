import { IoAdapter } from '@nestjs/platform-socket.io';
import { ServerOptions } from 'socket.io';

export class SocketIOAdapter extends IoAdapter {
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

    // Log the server creation
    console.log('🚀 Socket.IO server created on port:', port);
    console.log('📡 Available transports:', server.engine?.transports);
    console.log('🌐 Allowed origins:', allowedOrigins);

    return server;
  }
}
