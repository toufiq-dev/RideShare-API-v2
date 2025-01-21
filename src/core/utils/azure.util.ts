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
      console.error('Azure Blob Upload Error:', error.message);
      throw new Error('Failed to upload file to Azure Blob Storage');
    }
  }

  async extractTextFromImage(imageBuffer: Buffer): Promise<any> {
    try {
      const url = `${this.endpoint}/vision/v3.2/read/analyze`;
      const response = await axios.post(url, imageBuffer, {
        headers: {
          'Content-Type': 'application/octet-stream',
          'Ocp-Apim-Subscription-Key': this.apiKey,
        },
      });
      // Wait for processing to complete
      const operationLocation = response.headers['operation-location'];
      await new Promise((resolve) => setTimeout(resolve, 3000)); // Adjust delay as needed

      const result = await axios.get(operationLocation, {
        headers: {
          'Ocp-Apim-Subscription-Key': this.apiKey,
        },
      });

      return result.data;
    } catch (error) {
      console.error('Azure OCR Error:', error.message);
      throw new Error('Failed to extract text from image.');
    }
  }
}
