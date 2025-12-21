import { Module } from '@nestjs/common';
import { AdminService } from './services/admin.service';
import { AdminController } from './controllers/admin.controller';
import { AzureService } from 'src/core/utils/azure.util';
import { EmailModule } from '../email/email.module';
import { VerificationService } from 'src/core/utils/verification.util';
import { PricingModule } from '../pricing/pricing.module';
import { AdminVehicleController } from './controllers/admin-vehicle.controller';
import { AdminDriverController } from './controllers/admin-driver.controller';
import { AdminDriverService } from './services/admin-driver.service';
import { PilotModule } from '../pilot/pilot.module';

@Module({
  imports: [EmailModule, PricingModule, PilotModule],
  controllers: [AdminController, AdminVehicleController, AdminDriverController],
  providers: [
    AdminService,
    AzureService,
    VerificationService,
    AdminDriverService,
  ],
})
export class AdminModule {}
