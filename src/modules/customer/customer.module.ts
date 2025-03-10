import { Module } from '@nestjs/common';
import { CustomerService } from './customer.service';
import { CustomerController } from './customer.controller';
import { RideModule } from '../ride/ride.module';
import { OTPService } from 'src/core/utils/otp.util';

@Module({
  imports: [RideModule],
  controllers: [CustomerController],
  providers: [CustomerService, OTPService],
})
export class CustomerModule {}
