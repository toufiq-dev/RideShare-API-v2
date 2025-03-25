import { Module } from '@nestjs/common';
import { CustomerService } from './customer.service';
import { CustomerController } from './customer.controller';
import { RideModule } from '../ride/ride.module';
import { OTPService } from 'src/core/utils/otp.util';
import { FareModule } from '../fare/fare.module';
import { BullModule } from '@nestjs/bullmq';
import { RideService } from '../ride/ride.service';

@Module({
  imports: [
    RideModule,
    RideService,
    FareModule,
    BullModule.registerQueue({ name: 'ride-request' }),
  ],
  controllers: [CustomerController],
  providers: [CustomerService, OTPService],
})
export class CustomerModule {}
