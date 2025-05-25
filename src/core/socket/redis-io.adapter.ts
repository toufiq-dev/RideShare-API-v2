import { IoAdapter } from '@nestjs/platform-socket.io';
import { ServerOptions, Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';
import { INestApplicationContext } from '@nestjs/common';

export class RedisIoAdapter extends IoAdapter {
  private pubClient;
  private subClient;

  constructor(
    app: INestApplicationContext,
  ) {
    super(app);

    const redisUrl = process.env.REDIS_URL

    this.pubClient = createClient({ url: redisUrl });
    this.subClient = this.pubClient.duplicate();

    // Handle connection errors
    this.pubClient.on('error', (err) =>
      console.error('Redis Pub Client Error', err),
    );
    this.subClient.on('error', (err) =>
      console.error('Redis Sub Client Error', err),
    );

    this.pubClient.connect().catch(console.error);
    this.subClient.connect().catch(console.error);
  }

  createIOServer(port: number, options?: ServerOptions): Server {
    const server: Server = super.createIOServer(port, options);
    server.adapter(createAdapter(this.pubClient, this.subClient));
    return server;
  }
}
