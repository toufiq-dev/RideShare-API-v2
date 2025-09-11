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
import { forwardRef, Inject, UseGuards } from '@nestjs/common';
import { SocketService } from 'src/core/socket/socket.service';
import { BookingStatus } from '@prisma/client';
import { RideNotificationService } from './services/ride-notification.service';
import { RideEvents } from 'src/core/socket/socket-events';

@WebSocketGateway({
  cors: {
    origin: '*',
    credentials: true,
  },
  namespace: '/socket',
  transports: ['websocket', 'polling'],
})
@UseGuards(WsJwtAuthGuard)
export class RideGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(
    private readonly socketService: SocketService,
    @Inject(forwardRef(() => RideService))
    private readonly rideService: RideService,
    private readonly rideNotificationService: RideNotificationService,
  ) {}

  onModuleInit() {
    this.socketService.setServer(this.server);
  }

  async handleConnection(client: Socket) {
    try {
      await this.socketService.handleConnection(client);
    } catch (error) {
      console.error(error);
      client.emit(RideEvents.ERROR, {
        message: 'Failed to connect Ride Gateway',
      });
    }
  }

  handleDisconnect(client: Socket) {
    this.socketService.handleDisconnect(client);
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
