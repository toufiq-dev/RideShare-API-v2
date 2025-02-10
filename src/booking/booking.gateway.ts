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
import { BookingService } from './booking.service';
import { CreateBookingDto, UpdateBookingDto } from './dto/booking.dto';
import { WsJwtAuthGuard } from 'src/common/guards/ws-jwt.guard';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
  namespace: 'booking',
})
// @UseGuards(WsJwtAuthGuard)
export class BookingGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(private readonly bookingService: BookingService) {}

  async handleConnection(client: Socket) {
    try {
      console.log('Connection attempt from:', client.handshake.address);
      console.log('Auth data:', client.handshake.auth);
      
      // Temporarily disable auth check for testing
      // const user = client.data.user;
      // if (!user) {
      //   console.log('No user data found, disconnecting');
      //   client.disconnect();
      //   return;
      // }

      console.log('Client connected successfully:', client.id);
      
    } catch (error) {
      console.error('Connection error:', error);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    console.log('Client disconnected:', client.id);
  }

  @SubscribeMessage('createBooking')
  async create(
    @ConnectedSocket() client: Socket,
    @MessageBody() createBookingDto: CreateBookingDto
  ) {
    console.log(createBookingDto)
    const booking = await this.bookingService.create(createBookingDto, client.data.user);
    
    // Join booking room
    client.join(`booking:${booking.id}`);
    
    // Notify available pilots
    this.server.to('available_pilots').emit('newBookingRequest', booking);
    
    return booking;
  }

  @SubscribeMessage('acceptBooking')
  async acceptBooking(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { bookingId: string }
  ) {
    const booking = await this.bookingService.acceptBooking(
      data.bookingId,
      client.data.user
    );
    
    // Join booking room
    client.join(`booking:${booking.id}`);
    
    // Notify customer
    this.server.to(`user:${booking.customerId}`).emit('bookingAccepted', booking);
    
    return booking;
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
