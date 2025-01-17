import { Module, MiddlewareConsumer } from '@nestjs/common';
import { PilotController } from './pilot.controller';
import { PilotService } from './pilot.service';
import { AzureBlobService } from 'src/core/utils/azure-blob.util';
import { JwtModule } from '@nestjs/jwt';

@Module({
  imports: [JwtModule],
  controllers: [PilotController],
  providers: [PilotService, AzureBlobService],
})
export class PilotModule {}
