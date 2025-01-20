import { Module } from '@nestjs/common';
import { PilotController } from './pilot.controller';
import { PilotService } from './pilot.service';
import { AzureBlobService } from 'src/core/utils/azure-blob.util';
import { ConfigService } from '@nestjs/config';

@Module({
  controllers: [PilotController],
  providers: [PilotService, AzureBlobService, ConfigService],
})
export class PilotModule {}
