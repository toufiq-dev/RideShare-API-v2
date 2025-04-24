import { Injectable } from '@nestjs/common';
import { Socket, Server } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { WsException } from '@nestjs/websockets';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class SocketService {
  private _server: Server | null = null;
  private activeConnections: Map<string, string> = new Map();

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
    if (!token) {
      throw new WsException('Missing authentication token');
    }

    try {
      const payload = await this.jwtService.verifyAsync(token);
      const user = await this.prisma.user.findUnique({
        where: { id: payload.userId },
      });

      if (!user || user.role !== payload.role)
        throw new WsException('Invalid user/role');

      client.data.user = { userId: payload.userId, role: payload.role };

      const existingSocketId = this.activeConnections.get(payload.userId);
      if (existingSocketId) {
        this.server.sockets.sockets.get(existingSocketId)?.disconnect(true);
        console.log(
          `Disconnected existing socket for userId: ${payload.userId}`,
        );
      }

      client.data.user = { userId: payload.userId, role: payload.role };

      // Leave client.id room
      await client.leave(client.id);
      console.log(`Client ${client.id} left room: ${client.id}`);

      // Join userId room
      await client.join(payload.userId);
      console.log(`${payload.role} joined room: ${payload.userId}`);

      // Update active connections
      this.activeConnections.set(payload.userId, client.id);

      return client.data.user;
    } catch (err) {
      client.disconnect();
      throw new WsException('Authentication failed');
    }
  }

  handleDisconnect(client: Socket) {
    const userId = client.data.user?.userId;
    if (userId && this.activeConnections.get(userId) === client.id) {
      this.activeConnections.delete(userId);
    }
    console.log('Client disconnected:', client.id);
  }
}
