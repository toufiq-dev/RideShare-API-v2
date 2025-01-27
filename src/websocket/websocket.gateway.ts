import {
  SubscribeMessage,
  WebSocketGateway,
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({
  cors: { origin: '*' },
  transports: ['websocket'],
})
export class WebsocketGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer() server: Server; // Socket.IO server instance

  handleConnection(client: Socket) {
    console.log(`Client connected: ${client.id}`);
    client.emit('connection', 'Welcome to the WebSocket server! from nest');
  }

  handleDisconnect(client: Socket) {
    console.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('message') // Listens for the 'message' event
  handleMessage(client: Socket, payload: any): string {
    console.log(`Message from client ${client.id}: ${payload}`);
    return `Server received your message: ${payload}`;
  }
}
