import { BlobServiceClient } from '@azure/storage-blob';
import { Injectable } from '@nestjs/common';

@Injectable()
export class AzureBlobService {
  private readonly blobServiceClient: BlobServiceClient;
  private readonly containerName = 'live-selfie';

  constructor() {
    const AZURE_STORAGE_CONNECTION_STRING =
      process.env.AZURE_STORAGE_CONNECTION_STRING;
    this.blobServiceClient = BlobServiceClient.fromConnectionString(
      AZURE_STORAGE_CONNECTION_STRING,
    );
  }

  async uploadFile(
    buffer: Buffer,
    originalName: string,
    userId: string,
  ): Promise<string> {
    const containerClient = this.blobServiceClient.getContainerClient(
      this.containerName,
    );

    await containerClient.createIfNotExists({ access: 'container' });

    const uniqueFileName = `${userId}-${Date.now()}-${originalName}`;
    const blockBlobClient = containerClient.getBlockBlobClient(uniqueFileName);

    await blockBlobClient.uploadData(buffer, {
      blobHTTPHeaders: { blobContentType: 'image/jpeg' },
    });

    return blockBlobClient.url;
  }
}
