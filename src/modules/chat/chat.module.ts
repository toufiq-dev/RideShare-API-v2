import { Module } from '@nestjs/common';
import { ChatService } from './chat.service';
import { ChatGateway } from './chat.gateway';
import { SocketModule } from 'src/core/socket/socket.module';

@Module({
  imports: [SocketModule],
  providers: [ChatService, ChatGateway],
})
export class ChatModule {}
