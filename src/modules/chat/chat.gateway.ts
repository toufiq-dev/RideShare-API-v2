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

  @SubscribeMessage('rideSendMessage')
  async handleSendMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() sendMessageDto: SendMessageDto,
  ) {
    try {
      console.log(
        `${client.data.user.role} sending message: ${sendMessageDto}`,)

      const userId = client.data.user.userId;

      const { message, recipientId } = await this.chatService.sendMessage(
        userId,
        sendMessageDto,
      );

      console.log(`${client.data.user.role} sent: ${message.content}`);

      const ms = this.server
        .to(userId)
        .to(recipientId)
        .emit('rideReceiveMessage', message);

      console.log('Emitting rideReceiveMessage:', ms);
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
