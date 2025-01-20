import { BlobServiceClient } from '@azure/storage-blob';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AzureBlobService {
  private readonly blobServiceClient: BlobServiceClient;
  private readonly containerName: string;
  private readonly connectionString: string;

  constructor(private readonly configService: ConfigService) {
    this.connectionString = this.configService.get<string>(
      'azure.connectionString',
    );
    this.containerName = this.configService.get<string>('azure.containerName');
    this.blobServiceClient = BlobServiceClient.fromConnectionString(
      this.connectionString,
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
}
