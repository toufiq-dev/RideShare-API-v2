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
import { SocketService } from 'src/core/socket/socket.service';
import { BookingStatus } from '@prisma/client';
import { RideNotificationService } from './ride-notification.service';
import { RideEvents } from 'src/core/socket/socket-events';
import { PrismaService } from 'src/core/database/prisma.service';

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
    private readonly rideService: RideService,
    private readonly rideNotificationService: RideNotificationService,
    private readonly prisma: PrismaService,
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
  async updateLocation(@ConnectedSocket() client: Socket, @MessageBody() body) {
    try {
      const { lat, lng } = JSON.parse(body);

      await this.rideService.handleUpdateLocation(client, lat, lng);

      const pilot = await this.prisma.pilot.findUnique({
        where: {
          userId: client.data.user.userId,
        },
        select: {
          id: true,
        },
      });
      console.log('pilot ', pilot);
      // Emit driver live location to customer
      const booking = await this.prisma.booking.findFirst({
        where: {
          pilotId: pilot.id,
          status: BookingStatus.ACCEPTED,
        },
        select: {
          id: true,
          pilotId: true,
          customer: {
            select: {
              userId: true,
            },
          },
        },
      });
      console.log('booking', booking);
      if (booking) {
        this.rideNotificationService.notifyDriverLiveLocation(
          booking.id,
          booking.customer.userId,
          Number(lat),
          Number(lng),
        );
      }

      // const activeRide = await this.rideService.getActiveRideForPilot(client);

      // if (activeRide) {
      //   // Check status from Redis first
      //   let status = await this.rideService.getCachedBookingStatus(
      //     activeRide.bookingId,
      //   );

      //   // If not found in Redis, fallback to Prisma and cache it
      //   if (!status) {
      //     const booking = await this.rideService.getBookingStatus(
      //       activeRide.bookingId,
      //     );
      //     status = booking?.status;
      //     console.log('Status from Prisma:', status);
      //     if (status) {
      //       await this.rideService.cacheBookingStatus(
      //         activeRide.bookingId,
      //         status,
      //       );
      //     }
      //   }

      //   if (status && status === BookingStatus.ACCEPTED) {
      //     this.rideNotificationService.notifyDriverLiveLocation(
      //       activeRide.bookingId,
      //       activeRide.customerUserId,
      //       lat,
      //       lng,
      //     );
      //   } else {
      //     console.log(
      //       `Skipping location emit for booking ${activeRide.bookingId} due to status: ${status}`,
      //     );
      //   }
      // }
    } catch (error) {
      console.error(error);
      client.emit(RideEvents.ERROR, { message: 'Failed to update location' });
    }
  }
}
