import { Module } from '@nestjs/common';
import { PilotController } from './pilot.controller';
import { PilotService } from './pilot.service';
import { AzureService } from 'src/core/utils/azure.util';
import { ConfigService } from '@nestjs/config';
import { VerificationService } from 'src/core/utils/verification.util';
import { RideModule } from '../ride/ride.module';
import { OTPService } from 'src/core/utils/otp.util';

@Module({
  imports: [RideModule],
  controllers: [PilotController],
  providers: [
    PilotService,
    AzureService,
    ConfigService,
    AzureService,
    VerificationService,
    OTPService,
  ],
})
export class PilotModule {}
