import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { DatabaseBackupService } from './backup.service';

@Injectable()
export class BackupCronService {
  private readonly logger = new Logger(BackupCronService.name);

  constructor(private readonly backupService: DatabaseBackupService) {}

  // Run daily at 3:00 AM Bangladesh Standard Time (BST)
  // Bangladesh is UTC+6, so 3 AM BST = 21:00 UTC (previous day)
  @Cron('0 21 * * *', {
    timeZone: 'Asia/Dhaka',
  })
  async handleDailyBackup() {
    this.logger.log('Starting daily scheduled backup at 3:00 AM BST...');

    try {
      await this.backupService.createAndUploadBackup();
      this.logger.log('Daily scheduled backup completed successfully');
    } catch (error) {
      this.logger.error(`Daily scheduled backup failed: ${error.message}`);
    }
  }
}
