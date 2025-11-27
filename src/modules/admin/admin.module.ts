import { Module } from '@nestjs/common';
import { AdminService } from './services/admin.service';
import { AdminController } from './controllers/admin.controller';
import { AzureService } from 'src/core/utils/azure.util';
import { EmailModule } from '../email/email.module';
import { VerificationService } from 'src/core/utils/verification.util';
import { PilotService } from '../pilot/pilot.service';
import { PricingModule } from '../pricing/pricing.module';
import { AdminVehicleController } from './controllers/admin-vehicle.controller';
import { AdminDriverController } from './controllers/admin-driver.controller';
import { AdminDriverService } from './services/admin-driver.service';

@Module({
  imports: [EmailModule, PricingModule],
  controllers: [AdminController, AdminVehicleController, AdminDriverController],
  providers: [
    AdminService,
    AzureService,
    VerificationService,
    PilotService,
    AdminDriverService,
  ],
})
export class AdminModule {}
