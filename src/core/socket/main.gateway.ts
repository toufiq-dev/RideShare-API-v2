import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Socket, Server } from 'socket.io';
import { UseGuards } from '@nestjs/common';
import { WsJwtAuthGuard } from 'src/common/guards/ws-jwt.guard';
import { SocketService } from './socket.service';
import { ChatService } from 'src/modules/chat/chat.service';
import { RideService } from 'src/modules/ride/ride.service';
import { RideNotificationService } from 'src/modules/ride/services/ride-notification.service';
import { SendMessageDto } from 'src/modules/chat/dto/send-message.dto';
import { ChatEvents, RideEvents } from './socket-events';
import { BookingStatus } from '@prisma/client';

@WebSocketGateway({
  cors: {
    origin: '*',
    credentials: true,
  },
  namespace: '/socket',
  transports: ['websocket', 'polling'],
})
@UseGuards(WsJwtAuthGuard)
export class MainGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(
    private readonly socketService: SocketService,
    private readonly chatService: ChatService,
    private readonly rideService: RideService,
    private readonly rideNotificationService: RideNotificationService,
  ) {}

  onModuleInit() {
    this.socketService.setServer(this.server);
    console.log('🚀 WebSocket Gateway initialized with namespace: /socket');
  }

  async handleConnection(client: Socket) {
    console.log('�� New connection attempt:');
    console.log('  - Client ID:', client.id);
    console.log('  - Namespace:', client.nsp.name);

    try {
      await this.socketService.handleConnection(client);

      console.log('✅ Client connected successfully:', client.id);
    } catch (error) {
      console.error(error);
      client.emit('error', {
        message: 'Failed to connect',
      });
    }
  }

  handleDisconnect(client: Socket) {
    this.socketService.handleDisconnect(client);
  }

  @SubscribeMessage(ChatEvents.SEND_MESSAGE)
  async handleSendMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() sendMessageDto: SendMessageDto,
  ) {
    try {
      if (!client.data?.user?.userId) {
        client.emit('error', { message: 'User not authenticated' });
        console.log('❌ Client not authenticated to send message');
        return;
      }

      const userId = client.data.user.userId;
      const { message, recipientId } = await this.chatService.sendMessage(
        userId,
        sendMessageDto,
      );

      this.server
        .to(userId)
        .to(recipientId)
        .emit(ChatEvents.RECEIVE_MESSAGE, message);

      return { success: true };
    } catch (error) {
      console.error('sendMessage error:', error);
      client.emit('error', {
        message: 'Failed to send message',
        error: error.message,
      });
    }
  }

  @SubscribeMessage(RideEvents.UPDATE_PILOT_LOCATION)
  async updateLocation(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { lat: number; lng: number; angle?: number },
  ) {
    try {
      const { lat, lng, angle } = body;
      await this.rideService.handleUpdateLocation(client, lat, lng);

      const activeRide = await this.rideService.getActiveRideForPilot(client);
      if (activeRide) {
        // Check status from Redis first
        let status = await this.rideService.getCachedBookingStatus(
          activeRide.bookingId,
        );

        // If not found in Redis, fallback to Prisma and cache it
        if (!status) {
          const booking = await this.rideService.getBookingStatus(
            activeRide.bookingId,
          );
          status = booking?.status;
          if (status) {
            await this.rideService.cacheBookingStatus(
              activeRide.bookingId,
              status,
            );
          }
        }

        if (status && status === BookingStatus.ACCEPTED) {
          this.rideNotificationService.notifyDriverLiveLocation(
            activeRide.bookingId,
            activeRide.customerUserId,
            lat,
            lng,
            angle,
          );
        }
      }

      return {
        status: 'success',
        message: 'Location updated successfully',
      };
    } catch (error) {
      console.error(error);
      client.emit(RideEvents.ERROR, {
        message: 'Failed to update location',
      });
    }
  }
}
