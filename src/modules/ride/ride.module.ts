import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { RideService } from './ride.service';
import { RideGateway } from './ride.gateway';
import { RideRequestProcessor } from './processor/ride.processor';
import { FareModule } from '../fare/fare.module';
import { SocketModule } from 'src/core/socket/socket.module';
import { RideController } from './ride.controller';
import { RideNotificationService } from './ride-notification.service';
import { FirebaseModule } from 'src/core/firebase/firebase.module';

@Module({
  imports: [
    SocketModule,
    FareModule,
    FirebaseModule,
    BullModule.registerQueueAsync({
      name: 'ride-request',
    }),
  ],
  providers: [
    RideGateway,
    RideService,
    RideNotificationService,
    RideRequestProcessor,
  ],
  exports: [RideGateway, RideService],
  controllers: [RideController],
})
export class RideModule {}
