import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
  path: '/websocket/ride-request',
  transports: ['websocket', 'polling'],
})
export class BookingGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(BookingGateway.name);

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('ride-request')
  handleRideRequest(payload: any) {
    console.log('hello ', payload);
    this.server.emit('ride-request', payload);
  }

  @SubscribeMessage('ride-accepted')
  handleRideAccepted(payload: any) {
    this.server.emit('ride-accepted', payload);
  }
}
