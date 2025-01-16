import { Module } from '@nestjs/common';
import { PilotService } from './pilot.service';
import { PilotController } from './pilot.controller';

@Module({
  controllers: [PilotController],
  providers: [PilotService],
})
export class PilotModule {}
