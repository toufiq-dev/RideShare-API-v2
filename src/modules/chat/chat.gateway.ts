// src/modules/chat/chat.gateway.ts
import {
  SubscribeMessage,
  WebSocketGateway,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Socket, Server } from 'socket.io';
import { ChatService } from './chat.service';
import { UseGuards } from '@nestjs/common';
import { WsJwtAuthGuard } from 'src/common/guards/ws-jwt.guard';
import { SocketService } from 'src/core/socket/socket.service';
import { SendMessageDto } from './dto/send-message.dto';
import { PrismaService } from 'src/core/database/prisma.service';

@WebSocketGateway({ namespace: '/socket' })
@UseGuards(WsJwtAuthGuard)
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  constructor(
    private readonly chatService: ChatService,
    private readonly socketService: SocketService,
    private readonly prisma: PrismaService,
  ) {}

  get server(): Server {
    return this.socketService.server;
  }

  async handleConnection(client: Socket) {
    await this.socketService.handleConnection(client);
  }

  handleDisconnect(client: Socket) {
    this.socketService.handleDisconnect(client);
  }

  @SubscribeMessage('sendMessage')
  async handleSendMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() sendMessageDto: SendMessageDto,
  ) {
    try {
      const userId = client.data.user.userId;
      const message = await this.chatService.sendMessage(
        userId,
        sendMessageDto,
      );

      const booking = await this.prisma.booking.findUnique({
        where: { id: sendMessageDto.bookingId },
        include: { customer: true, pilot: true },
      });

      if (!booking) throw new Error('Booking not found');

      const recipientId =
        userId === booking.customer.userId
          ? booking.pilot.userId
          : booking.customer.userId;

      this.server.to(userId).to(recipientId).emit('receiveMessage', message);

      return { success: true };
    } catch (error) {
      console.error('sendMessage error:', error);
      client.emit('error', {
        message: 'Failed to send message',
        error: error.message,
      });
    }
  }
}
