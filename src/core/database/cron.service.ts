import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { DatabaseBackupService } from './backup.service';

@Injectable()
export class BackupCronService {
  private readonly logger = new Logger(BackupCronService.name);

  constructor(private readonly backupService: DatabaseBackupService) {}

  // Run every 2 minutes for testing
  @Cron('*/2 * * * *')
  async handleBackup() {
    this.logger.log('Starting scheduled backup...');

    try {
      await this.backupService.createAndUploadBackup();
      this.logger.log('Scheduled backup completed successfully');
    } catch (error) {
      this.logger.error(`Scheduled backup failed: ${error.message}`);
    }
  }
}
