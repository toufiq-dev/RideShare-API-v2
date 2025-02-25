import { Module } from '@nestjs/common';
import { CustomerService } from './customer.service';
import { CustomerController } from './customer.controller';
import { RideModule } from '../ride/ride.module';

@Module({
  imports: [RideModule],
  controllers: [CustomerController],
  providers: [CustomerService],
})
export class CustomerModule {}
