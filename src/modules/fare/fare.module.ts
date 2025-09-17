import { Module } from '@nestjs/common';
import { FareService } from './fare.service';
import { FareController } from './fare.controller';
import { PricingModule } from '../pricing/pricing.module';

@Module({
  imports: [PricingModule],
  controllers: [FareController],
  providers: [FareService],
  exports: [FareService],
})
export class FareModule {}
