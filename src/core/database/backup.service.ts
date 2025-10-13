import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BlobServiceClient } from '@azure/storage-blob';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';

const execAsync = promisify(exec);

@Injectable()
export class DatabaseBackupService {
  private readonly logger = new Logger(DatabaseBackupService.name);
  private readonly blobServiceClient: BlobServiceClient;
  private readonly containerName: string;
  private readonly databaseUrl: string;

  constructor(private readonly configService: ConfigService) {
    const connectionString = this.configService.get<string>(
      'azure.connectionString',
    );
    this.containerName = this.configService.get<string>(
      'azure.containerNameDb',
    );
    this.databaseUrl = this.configService.get<string>('database.url');

    // Debug logging
    this.logger.log(`DATABASE_URL from env: ${process.env.DATABASE_URL}`);
    this.logger.log(
      `DATABASE_URL from config: ${this.configService.get<string>('db.url')}`,
    );
    this.logger.log(`DATABASE_URL final: ${this.databaseUrl}`);

    if (!connectionString) {
      throw new Error('Azure Storage connection string is not configured');
    }
    if (!this.databaseUrl) {
      throw new Error('Database URL is not configured');
    }

    this.blobServiceClient =
      BlobServiceClient.fromConnectionString(connectionString);
  }

  async createAndUploadBackup(): Promise<void> {
    const timestamp = new Date()
      .toISOString()
      .replace(/[:.]/g, '-')
      .slice(0, 19);
    const backupFileName = `fairdrive-api_backup_${timestamp}.sql`;
    const backupDir = '/tmp';
    const localBackupPath = path.join(backupDir, backupFileName);

    try {
      this.logger.log(`Starting backup: ${backupFileName}`);

      // Create database backup using pg_dump
      const databaseUrl = this.databaseUrl.replace(/\?.*$/, '');
      const pgDumpCommand = `pg_dump "${databaseUrl}" > "${localBackupPath}"`;

      await execAsync(pgDumpCommand);

      // Check if backup file was created
      if (!fs.existsSync(localBackupPath)) {
        throw new Error('Backup file was not created');
      }

      this.logger.log(`Backup created successfully: ${backupFileName}`);

      // Upload to Azure Blob Storage
      await this.uploadToAzureBlob(localBackupPath, backupFileName);

      // Clean up local file
      if (fs.existsSync(localBackupPath)) {
        fs.unlinkSync(localBackupPath);
        this.logger.log('Local backup file cleaned up');
      }
    } catch (error) {
      this.logger.error(`Backup failed: ${error.message}`);

      // Clean up local file if it exists
      if (fs.existsSync(localBackupPath)) {
        fs.unlinkSync(localBackupPath);
      }

      throw error;
    }
  }

  private async uploadToAzureBlob(
    localFilePath: string,
    blobName: string,
  ): Promise<void> {
    try {
      this.logger.log(`Uploading ${blobName} to Azure Blob Storage...`);

      const containerClient = this.blobServiceClient.getContainerClient(
        this.containerName,
      );

      // Ensure container exists
      await containerClient.createIfNotExists();

      const blockBlobClient = containerClient.getBlockBlobClient(blobName);

      // Upload the file
      await blockBlobClient.uploadFile(localFilePath);

      this.logger.log(
        `Successfully uploaded ${blobName} to Azure Blob Storage`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to upload to Azure Blob Storage: ${error.message}`,
      );
      throw error;
    }
  }
}
