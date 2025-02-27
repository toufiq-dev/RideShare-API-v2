import { BlobServiceClient } from '@azure/storage-blob';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

@Injectable()
export class AzureService {
  private readonly blobServiceClient: BlobServiceClient;
  private readonly containerName: string;
  private readonly connectionString: string;
  private readonly endpoint: string;
  private readonly apiKey: string;

  constructor(private readonly configService: ConfigService) {
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
