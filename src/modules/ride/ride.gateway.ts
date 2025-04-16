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
import { WsJwtAuthGuard } from 'src/common/guards/ws-jwt.guard';
import { UseGuards } from '@nestjs/common';
import { WsException } from '@nestjs/websockets';
import { SocketService } from 'src/core/socket/socket.service';

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

  constructor(
    private readonly socketService: SocketService,
    private readonly rideService: RideService,
  ) {}

  onModuleInit() {
    this.socketService.setServer(this.server);
  }

  async handleConnection(client: Socket) {
    await this.socketService.handleConnection(client);
  }

  handleDisconnect(client: Socket) {
    this.socketService.handleDisconnect(client);
  }

  @SubscribeMessage('updateLocation')
  async updateLocation(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: any,
  ) {
    try {
      const { lat, lng } = JSON.parse(body);
      console.log('Received pilot updateLocation:', lat, lng);

      const pilotId = await this.rideService.handleUpdateLocation(
        client,
        lat,
        lng,
      );

      const activeRide = await this.rideService.getActiveRideForPilot(pilotId);

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

        if (status && status !== 'CANCELLED' && status !== 'STARTED') {
          const payload = {
            bookingId: activeRide.bookingId,
            lat,
            lng,
          };
          this.server
            .to(activeRide.customerUserId)
            .emit('driverLiveLocation', payload);
          console.log('Emitting driverLiveLocation:', payload);
        } else {
          console.log(
            `Skipping location emit for booking ${activeRide.bookingId} due to status: ${status}`,
          );
        }
      }
    } catch (error) {
      console.error(error);
      client.emit('error', { message: 'Failed to update location' });
    }
  }
}
