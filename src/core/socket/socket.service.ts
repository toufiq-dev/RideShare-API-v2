import { Injectable } from '@nestjs/common';
import { Socket, Server } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { WsException } from '@nestjs/websockets';
import { RedisService } from '../cache/redis.service';
import { RedisKeys } from '../cache/redis-keys';

@Injectable()
export class SocketService {
  private _server: Server | null = null;

  constructor(
    private readonly jwtService: JwtService,
    private readonly redis: RedisService,
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
    console.log('Socket connection token:', token);
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
        console.log(`Token mismatch for user ${userId} - disconnecting`);
        client.disconnect(true);
        throw new WsException('Token has been invalidated');
      }

      // Check for existing connection
      const connectionKey = `${RedisKeys.SOCKET_CONNECTION}${userId}`;
      const existingClientId = await this.redis.get(connectionKey);

      if (existingClientId && existingClientId !== client.id) {
        console.log(
          `Disconnecting previous socket ${existingClientId} for user ${userId}`,
        );
        const sockets = await this.server.fetchSockets();
        const oldSocket = sockets.find((s) => s.id === existingClientId);
        if (oldSocket) {
          oldSocket.disconnect(true);
        }
      }

      // Join room = userId
      await client.join(userId);
      await this.redis.set(connectionKey, client.id);

      console.log(`${role} joined room: ${userId}`);
      client.data.user = { userId, role }; // store user in socket data

      return { userId, role };
    } catch (err) {
      console.error('JWT verification failed:', err.message);
      client.disconnect();
      throw new WsException('Authentication failed');
    }
  }

  handleDisconnect(client: Socket) {
    console.log('Client disconnected:', client.id);
  }
}
