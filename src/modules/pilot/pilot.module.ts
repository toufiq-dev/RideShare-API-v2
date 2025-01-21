import { Module } from '@nestjs/common';
import { PilotController } from './pilot.controller';
import { PilotService } from './pilot.service';
import { AzureService } from 'src/core/utils/azure.util';
import { ConfigService } from '@nestjs/config';
import { SignzyService } from 'src/core/utils/signzy.util';

@Module({
  controllers: [PilotController],
  providers: [
    PilotService,
    AzureService,
    ConfigService,
    AzureService,
    SignzyService,
  ],
})
export class PilotModule {}
