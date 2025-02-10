import {
  SubscribeMessage,
  WebSocketGateway,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, WebSocket } from 'ws';


@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class WebsocketGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  afterInit(server: Server) {
    console.log('WebSocket Server Initialized');
  }

  handleConnection(client: WebSocket) {
    console.log(`Client connected successfully: ${client.id}`);
    client.emit('connection', 'Welcome to the WebWeb server!');
  }

  handleDisconnect(client: WebSocket) {
    console.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('message')
  handleMessage(
    @MessageBody() data: string,
    @ConnectedSocket() client: WebSocket,
  ) {
    console.log(`Message from client ${client.id}: ${data}`);
    return `Server received your message: ${data}`;
  }
}
