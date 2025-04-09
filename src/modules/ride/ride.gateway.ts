import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { RideService } from './ride.service';
import { WsJwtAuthGuard } from 'src/common/guards/ws-jwt.guard';
import { UseGuards } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { WsException } from '@nestjs/websockets';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
  namespace: '/socket',
})
@UseGuards(WsJwtAuthGuard)
export class RideGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(
    private readonly rideService: RideService,
    private readonly jwtService: JwtService,
  ) {}

  async handleConnection(client: Socket) {
    const token = client.handshake.auth?.token;

    if (!token) {
      throw new WsException('Missing authentication token');
    }

    try {
      const payload = await this.jwtService.verifyAsync(token);
      if (!payload) {
        console.error('Invalid token: no userId');
        client.disconnect();
        return;
      }

      await client.join(payload.userId);
      console.log(`${payload.role} joined room: ${payload.userId}`);
    } catch (err) {
      console.error('JWT verification failed:', err.message);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    client.disconnect();
    console.log('Client disconnected:', client.id);
  }

  @SubscribeMessage('updateLocation')
  async updateLocation(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: any,
  ) {
    const location = JSON.parse(body);

    return await this.rideService.handleUpdateLocation(
      client,
      location.lat,
      location.lng,
    );
  }
}
