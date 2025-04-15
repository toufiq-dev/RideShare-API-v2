import { Module } from '@nestjs/common';
import { ChatService } from './chat.service';
import { ChatGateway } from './chat.gateway';
import { SocketModule } from 'src/core/socket/socket.module';
import { ChatController } from './chat.controller';

@Module({
  imports: [SocketModule],
  providers: [ChatService, ChatGateway],
  controllers: [ChatController],
})
export class ChatModule {}
