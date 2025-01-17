import { Injectable, BadRequestException } from '@nestjs/common';
import { AzureBlobService } from 'src/core/utils/azure-blob.util';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class PilotService {
  private readonly allowedMimeTypes: string[];
  constructor(
    private readonly azureBlobService: AzureBlobService,
    private readonly configService: ConfigService,
  ) {
    this.allowedMimeTypes = this.configService.get<string[]>(
      'azure.allowedMimeTypes',
    );
  }

  async uploadLiveSelfie(file: Express.Multer.File, userId: string) {
    const { buffer, originalname, mimetype } = file;

    // if (!this.allowedMimeTypes.includes(mimetype)) {
    //   throw new BadRequestException('Only JPEG and PNG files are allowed');
    // }

    const fileUrl = await this.azureBlobService.uploadFile(
      buffer,
      originalname,
      userId,
      mimetype,
    );

    console.log(fileUrl);

    return { message: 'Live selfie uploaded successfully' };
  }
}
