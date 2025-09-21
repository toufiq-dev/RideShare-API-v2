import { Module } from '@nestjs/common';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';
import { AzureService } from 'src/core/utils/azure.util';
import { EmailModule } from '../email/email.module';
import { VerificationService } from 'src/core/utils/verification.util';
import { PilotService } from '../pilot/pilot.service';
import { PricingModule } from '../pricing/pricing.module';

@Module({
  imports: [EmailModule, PricingModule],
  controllers: [AdminController],
  providers: [AdminService, AzureService, VerificationService, PilotService],
})
export class AdminModule {}
