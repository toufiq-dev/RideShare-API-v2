import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { BullModule } from '@nestjs/bullmq';
import { RideService } from './ride.service';
import { RideGateway } from './ride.gateway';
import { PrismaModule } from 'src/core/database/prisma.module';
import { RideRequestProcessor } from './processors/ride.processor';

@Module({
  imports: [
    PrismaModule,
    JwtModule,
    BullModule.registerQueueAsync({
      name: 'ride-request',
    }),
  ],
  providers: [RideGateway, RideService, RideRequestProcessor],
  exports: [RideGateway, RideService],
})
export class RideModule {}
