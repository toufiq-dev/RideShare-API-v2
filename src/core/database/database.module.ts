import { Global, Module } from '@nestjs/common';
import { PrismaService } from './database.service';
import { DatabaseBackupService } from './backup.service';
import { BackupCronService } from './cron.service';
import { ScheduleModule } from '@nestjs/schedule';

@Global()
@Module({
  imports: [ScheduleModule.forRoot()],
  providers: [PrismaService, DatabaseBackupService, BackupCronService],
  exports: [PrismaService],
})
export class DatabaseModule {}
