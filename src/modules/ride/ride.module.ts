import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { RideService } from './ride.service';
import { RideGateway } from './ride.gateway';
import { RideRequestProcessor } from './processor/ride.processor';
import { FareModule } from '../fare/fare.module';
import { SocketModule } from 'src/core/socket/socket.module';

@Module({
  imports: [
    SocketModule,
    FareModule,
    BullModule.registerQueueAsync({
      name: 'ride-request',
    }),
  ],
  providers: [RideGateway, RideService, RideRequestProcessor],
  exports: [RideGateway, RideService],
})
export class RideModule {}
