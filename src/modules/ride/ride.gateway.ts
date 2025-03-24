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
    try {
      console.log('Connection attempt from:', client.handshake.address);
      console.log('Client connected successfully:', client.id);

      const userId = client.data.user.userId;
      client.join(`user:${userId}`);
    } catch (error) {
      console.error('Connection error:', error);
    }
  }

  handleDisconnect(client: Socket) {
    console.log('Client disconnected:', client.id);
  }

  @SubscribeMessage('updateLocation')
  async updateLocation(
    @ConnectedSocket() client: Socket,
    @MessageBody() location: UpdateLocationDto,
  ) {
    return await this.rideService.handleUpdateLocation(client, location);
  }

  @SubscribeMessage('requestRide')
  async requestRide(
    @ConnectedSocket() client: Socket,
    @MessageBody() createBookingDto: CreateBookingDto,
  ) {
    return await this.rideService.handleRequestRide(
      client,
      this.server,
      createBookingDto,
    );
  }

  @SubscribeMessage('acceptRide')
  async acceptRide(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { bookingId: string },
  ) {
    try {
      const booking = await this.rideService.handleAcceptRide(
        client,
        data.bookingId,
      );

      // Join pilot to booking-specific room
      client.join(`booking:${booking.id}`);

      // Notify customer in their room
      this.server.to(`user:${booking.customerId}`).emit('rideAccepted', {
        bookingId: booking.id,
        pilotId: booking.pilotId,
        status: booking.status,
      });

      // Notify pilot in their room
      this.server.to(`user:${booking.pilotId}`).emit('rideConfirmed', {
        bookingId: booking.id,
      });

      return { success: true, data: booking };
    } catch (error) {
      console.error(error);
      client.emit('error', { message: 'Failed to accept ride' });
    }
  }
}
