import { Module } from '@nestjs/common';
import { RideService } from './ride.service';
import { FareModule } from '../fare/fare.module';
import { RideController } from './ride.controller';
import { RideNotificationService } from './services/ride-notification.service';
import { FirebaseModule } from 'src/core/firebase/firebase.module';
import { DriverSearchService } from './services/driver-search.service';

@Module({
  imports: [FareModule, FirebaseModule],
  providers: [
    {
      provide: RideService,
      useClass: RideService,
    },
    RideNotificationService,
    DriverSearchService,
  ],
  exports: [RideService, DriverSearchService, RideNotificationService],
  controllers: [RideController],
})
export class RideModule {}
