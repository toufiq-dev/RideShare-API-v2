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
import { UpdateLocationDto, CreateBookingDto } from './dto/ride.dto';
import { WsJwtAuthGuard } from 'src/common/guards/ws-jwt.guard';
import { UseGuards } from '@nestjs/common';

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

  constructor(private readonly rideService: RideService) {}

  async handleConnection(client: Socket) {
    console.log('Connection attempt from:', client.handshake.address);

    const userId = client.data?.user?.userId;
    if (userId) {
      client.join(userId);
    }

    console.log('Client connected successfully:', client.id);
  }

  handleDisconnect(client: Socket) {
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
