import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { WsException } from '@nestjs/websockets';
import { Socket } from 'socket.io';
import { PrismaService } from 'src/core/database/prisma.service';

@Injectable()
export class WsJwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    try {
      const client: Socket = context.switchToWs().getClient();
      const token = client.handshake.auth.token?.split(' ')[1];

      if (!token) {
        throw new WsException('Missing authentication token');
      }

      const payload = await this.jwtService.verifyAsync(token);

      const user = await this.prisma.user.findUnique({
        where: { id: payload.userId },
      });

      if (!user || user.authTokenVersion !== payload.version) {
        throw new WsException('Token has been invalidated');
      }

      client.data.user = { ...payload, role: user.role };
      return true;
    } catch (err) {
      throw new WsException('Invalid credentials');
    }
  }
}
