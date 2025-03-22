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
import {
  UpdateLocationDto,
  CreateBookingDto,
  UpdateBookingDto,
} from './dto/ride.dto';
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
    const booking = await this.rideService.handleRequestRide(
      client,
      createBookingDto,
      client.data.user,
    );

    // Join booking room
    client.join(`booking:${booking.id}`);
  }

  @SubscribeMessage('acceptRide')
  async acceptRide(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { bookingId: string },
  ) {
    try {
      const booking = await this.rideService.handleAcceptRide(
        data.bookingId,
        client.data.user,
      );

      // Join booking room
      client.join(`booking:${booking.id}`);

      // Notify customer
      this.server
        .to(`user:${booking.customerId}`)
        .emit('rideAccepted', booking);

      return booking;
    } catch (error) {
      console.error(error);
    }
  }

  // @SubscribeMessage('updateBooking')
  // async update(
  //   @ConnectedSocket() client: Socket,
  //   @MessageBody() updateBookingDto: UpdateBookingDto
  // ) {
  //   const booking = await this.bookingService.update(
  //     updateBookingDto.id,
  //     updateBookingDto,
  //     client.data.user
  //   );

  //   // Notify all clients in the booking room
  //   this.server.to(`booking:${booking.id}`).emit('bookingUpdated', booking);

  //   return booking;
  // }

  // @SubscribeMessage('cancelBooking')
  // async cancelBooking(
  //   @ConnectedSocket() client: Socket,
  //   @MessageBody() data: { bookingId: string, reason?: string }
  // ) {
  //   const booking = await this.bookingService.cancelBooking(
  //     data.bookingId,
  //     client.data.user,
  //     data.reason
  //   );

  //   // Notify all clients in the booking room
  //   this.server.to(`booking:${booking.id}`).emit('bookingCancelled', booking);

  //   return booking;
  // }

  // @SubscribeMessage('updateLocation')
  // async updateLocation(
  //   @ConnectedSocket() client: Socket,
  //   @MessageBody() location: { latitude: number; longitude: number }
  // ) {
  //   if (client.data.user.role !== 'PILOT') {
  //     return;
  //   }

  //   const updatedPilot = await this.bookingService.updatePilotLocation(
  //     client.data.user.id,
  //     location
  //   );

  //   // If pilot is in an active booking, notify the customer
  //   if (updatedPilot.activeBooking) {
  //     this.server
  //       .to(`booking:${updatedPilot.activeBooking.id}`)
  //       .emit('pilotLocation', location);
  //   }

  //   return updatedPilot;
  // }
}
