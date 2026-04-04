import { Injectable } from '@nestjs/common';
import { Socket, Server } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { WsException } from '@nestjs/websockets';
import { RedisService } from '../cache/redis.service';
import { RedisKeys } from '../cache/redis-keys';
import { LoggerService } from '../logging/logger.service';

@Injectable()
export class SocketService {
  private _server: Server | null = null;
  // Connection key TTL: 24 hours (86400 seconds)
  private readonly CONNECTION_KEY_TTL = 86400;

  constructor(
    private readonly jwtService: JwtService,
    private readonly redis: RedisService,
    private readonly logger: LoggerService,
  ) {}

  setServer(server: Server) {
    this._server = server;
  }

  get server(): Server {
    if (!this._server) {
      throw new WsException('Socket.IO server not initialized');
    }
    return this._server;
  }

  async handleConnection(
    client: Socket,
  ): Promise<{ userId: string; role: string }> {
    const token = client.handshake.auth?.token;
    if (!token) {
      throw new WsException('Missing authentication token');
    }

    try {
      const payload = await this.jwtService.verifyAsync(token);
      const userId = payload.userId;
      const role = payload.role;

      if (!userId) {
        throw new WsException('Invalid token');
      }

      // 1. Verify token is still valid in Redis
      const storedAccessToken = await this.redis.get(
        `${RedisKeys.ACCESS_TOKEN}${userId}`,
      );
      if (!storedAccessToken || storedAccessToken !== token) {
        this.logger.logSecurity('WebSocket token mismatch; disconnecting', {
          userId,
        });
        client.disconnect(true);
        throw new WsException('Token has been invalidated');
      }

      // Check for existing connection and handle race condition
      const connectionKey = `${RedisKeys.SOCKET_CONNECTION}${userId}`;

      // Use Redis SET with NX (only if not exists) to make it atomic
      // First, try to set the new connection key atomically
      const redisClient = this.redis.getClient();
      const setResult = await redisClient.set(
        connectionKey,
        client.id,
        'EX',
        this.CONNECTION_KEY_TTL,
        'NX', // Only set if key doesn't exist
      );

      if (!setResult) {
        // Key already exists, check if it's a different client
        const existingClientId = await this.redis.get(connectionKey);

        if (existingClientId && existingClientId !== client.id) {
          this.logger.log(
            'Disconnecting previous WebSocket for user (new connection)',
            'SocketService',
          );
          const sockets = await this.server.fetchSockets();
          const oldSocket = sockets.find((s) => s.id === existingClientId);
          if (oldSocket) {
            oldSocket.disconnect(true);
          }
          // Now set the new connection key
          await this.redis.set(
            connectionKey,
            client.id,
            this.CONNECTION_KEY_TTL,
          );
        } else if (existingClientId === client.id) {
          // Same client reconnecting, just update TTL
          await redisClient.expire(connectionKey, this.CONNECTION_KEY_TTL);
        }
      }

      // Join room = userId
      await client.join(userId);

      this.logger.log(`WebSocket joined room (role=${role})`, 'SocketService');
      client.data.user = { userId, role }; // store user in socket data

      return { userId, role };
    } catch (err) {
      this.logger.warn('WebSocket JWT verification failed', 'SocketService');
      client.disconnect();
      throw new WsException('Authentication failed');
    }
  }

  async handleDisconnect(client: Socket) {
    try {
      if (client.data?.user?.userId) {
        const connectionKey = `${RedisKeys.SOCKET_CONNECTION}${client.data.user.userId}`;
        // Only delete if this client owns the connection
        const storedClientId = await this.redis.get(connectionKey);
        if (storedClientId === client.id) {
          await this.redis.del(connectionKey);
          this.logger.log('WebSocket disconnected and cleaned up', 'SocketService');
        } else {
          this.logger.debug(
            'WebSocket disconnect: connection key owned by another socket',
            'SocketService',
          );
        }
      } else {
        this.logger.debug(
          'WebSocket disconnected (no user data)',
          'SocketService',
        );
      }
    } catch (error) {
      this.logger.logError(
        error instanceof Error ? error : new Error(String(error)),
        'SocketService',
        { scope: 'handleDisconnect' },
      );
    }
  }
}
