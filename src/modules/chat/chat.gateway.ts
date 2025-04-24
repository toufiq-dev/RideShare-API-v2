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
import { ChatEvents } from 'src/core/socket/socket-events';

@WebSocketGateway({ namespace: '/socket' })
@UseGuards(WsJwtAuthGuard)
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  constructor(
    private readonly chatService: ChatService,
    private readonly socketService: SocketService,
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

  @SubscribeMessage(ChatEvents.SEND_MESSAGE)
  async handleSendMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() sendMessageDto: SendMessageDto,
  ) {
    try {
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
}
