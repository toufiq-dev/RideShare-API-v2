import { Injectable } from '@nestjs/common';
import { AzureBlobService } from 'src/core/utils/azure-blob.util';

@Injectable()
export class PilotService {
  constructor(private readonly azureBlobService: AzureBlobService) {}

  async uploadLiveSelfie(
    file: Express.Multer.File,
    userId: string,
  ): Promise<string> {
    const { buffer, originalname } = file;
    const fileUrl = await this.azureBlobService.uploadFile(
      buffer,
      originalname,
      userId,
    );
    return fileUrl;
  }
}
