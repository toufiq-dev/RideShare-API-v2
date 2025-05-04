import { Injectable } from '@nestjs/common';
import { Socket, Server } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { WsException } from '@nestjs/websockets';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class SocketService {
  private _server: Server | null = null;

  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
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
      if (!payload.userId) {
        throw new WsException('Invalid token');
      }

      const user = await this.prisma.user.findUnique({
        where: { id: payload.userId },
      });
      if (!user || user.role !== payload.role) {
        console.error('User not found');
        client.disconnect();
        throw new WsException('User not found');
      }

      await client.join(payload.userId);
      console.log(`${payload.role} joined room: ${payload.userId}`);

      return { userId: payload.userId, role: payload.role };
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
