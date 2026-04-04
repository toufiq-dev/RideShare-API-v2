import { BlobServiceClient } from '@azure/storage-blob';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { LoggerService } from 'src/core/logging/logger.service';

@Injectable()
export class AzureService {
  private readonly blobServiceClient: BlobServiceClient;
  private readonly containerName: string;
  private readonly connectionString: string;
  private readonly endpoint: string;
  private readonly apiKey: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly logger: LoggerService,
  ) {
    this.connectionString = this.configService.get<string>(
      'azure.connectionString',
    );
    this.containerName = this.configService.get<string>('azure.containerName');
    this.blobServiceClient = BlobServiceClient.fromConnectionString(
      this.connectionString,
    );
    this.endpoint = this.configService.get<string>(
      'azure.cognitiveServices.endpoint',
    );
    this.apiKey = this.configService.get<string>(
      'azure.cognitiveServices.apiKey',
    );
  }

  async uploadFile(
    buffer: Buffer,
    originalName: string,
    userId: string,
    contentType: string,
  ) {
    try {
      const containerClient = this.blobServiceClient.getContainerClient(
        this.containerName,
      );

      await containerClient.createIfNotExists({ access: 'container' });

      const uniqueFileName = `${userId}-${Date.now()}-${originalName}`;
      const blockBlobClient =
        containerClient.getBlockBlobClient(uniqueFileName);

      await blockBlobClient.uploadData(buffer, {
        blobHTTPHeaders: { blobContentType: contentType },
      });

      return blockBlobClient.url;
    } catch (error) {
      throw new Error('Failed to upload file to Azure Blob Storage');
    }
  }

  async deleteFile(fileUrl: string): Promise<void> {
    try {
      if (!fileUrl) {
        this.logger.debug('No file URL provided for deletion', 'AzureService');
        return;
      }

      const url = new URL(fileUrl);
      const pathParts = url.pathname.split('/').filter(Boolean);

      if (pathParts.length < 2) {
        this.logger.warn('Invalid blob URL structure for deletion', 'AzureService');
        return;
      }

      const containerName = pathParts[0];
      const blobName = decodeURIComponent(pathParts.slice(1).join('/'));

      this.logger.debug(
        `Deleting blob container=${containerName}`,
        'AzureService',
      );

      const containerClient =
        this.blobServiceClient.getContainerClient(containerName);
      const blockBlobClient = containerClient.getBlockBlobClient(blobName);

      const exists = await blockBlobClient.exists();
      if (!exists) {
        this.logger.debug(
          `Blob not found (container=${containerName})`,
          'AzureService',
        );
        return;
      }

      await blockBlobClient.deleteIfExists({ deleteSnapshots: 'include' });
      this.logger.debug(
        `Blob deleted (container=${containerName})`,
        'AzureService',
      );
    } catch (error) {
      this.logger.logError(
        error instanceof Error ? error : new Error(String(error)),
        'AzureService',
        { scope: 'deleteFile' },
      );
      throw new Error('Failed to delete file from Azure Blob Storage');
    }
  }

  async extractTextFromImage(imageBuffer: Buffer): Promise<any> {
    try {
      const url = `${this.endpoint}vision/v3.2/read/analyze`;

      const response = await axios.post(url, imageBuffer, {
        headers: {
          'Content-Type': 'application/octet-stream',
          'Ocp-Apim-Subscription-Key': this.apiKey,
        },
      });

      const operationLocation = response.headers['operation-location'];

      // Poll for results with exponential backoff
      const maxRetries = 5; // Maximum polling attempts
      let retryCount = 0;
      let delay = 500; // Initial delay

      while (retryCount < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, delay));

        const result = await axios.get(operationLocation, {
          headers: {
            'Ocp-Apim-Subscription-Key': this.apiKey,
          },
        });

        const { status } = result.data;
        if (status === 'succeeded') {
          return result.data; // Return OCR results
        } else if (status === 'failed') {
          throw new Error('OCR processing failed');
        }

        // exponential backoff
        retryCount += 1;
        delay *= 2; // Double the delay after each retry
      }

      throw new Error('OCR processing timed out');
    } catch (error) {
      throw new Error('Failed to extract text from image.');
    }
  }
}
