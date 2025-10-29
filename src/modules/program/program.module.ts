import { Module } from '@nestjs/common';
import { ProgramService } from './program.service';
import { ProgramController } from './program.controller';
import { ScheduleModule } from '@nestjs/schedule';
import { RankingCronService } from './cron/ranking-cron.service';
import { AzureService } from 'src/core/utils/azure.util';

@Module({
  imports: [ScheduleModule.forRoot()],
  controllers: [ProgramController],
  providers: [ProgramService, RankingCronService, AzureService],
  exports: [ProgramService],
})
export class ProgramModule {}
