import { Module } from '@nestjs/common';
import { RideService } from './ride.service';
import { RideGateway } from './ride.gateway';
import { FareModule } from '../fare/fare.module';
import { SocketModule } from 'src/core/socket/socket.module';
import { RideController } from './ride.controller';
import { RideNotificationService } from './services/ride-notification.service';
import { FirebaseModule } from 'src/core/firebase/firebase.module';
import { DriverSearchService } from './services/driver-search.service';

@Module({
  imports: [SocketModule, FareModule, FirebaseModule],
  providers: [
    {
      provide: RideService,
      useClass: RideService,
    },
    {
      provide: RideGateway,
      useClass: RideGateway,
    },
    RideNotificationService,
    DriverSearchService,
  ],
  exports: [RideGateway, RideService, DriverSearchService],
  controllers: [RideController],
})
export class RideModule {}
