import { Module } from '@nestjs/common';
import { ArtifactsService } from './artifacts.service';
import { TariffService } from './tariff.service';
import { ScheduleModule } from '@nestjs/schedule';
import { TelemetryService } from './telemetry.service';
import { MultiplierService } from './multiplier.service';

@Module({
  imports: [ScheduleModule.forRoot()],
  providers: [
    ArtifactsService,
    TariffService,
    TelemetryService,
    MultiplierService,
  ],
  exports: [
    ArtifactsService,
    TariffService,
    TelemetryService,
    MultiplierService,
  ],
})
export class PricingModule {}
