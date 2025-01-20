import { Module } from '@nestjs/common';
import { PilotController } from './pilot.controller';
import { PilotService } from './pilot.service';
import { AzureBlobService } from 'src/core/utils/azure-blob.util';

@Module({
  controllers: [PilotController],
  providers: [PilotService, AzureBlobService],
})
export class PilotModule {}
