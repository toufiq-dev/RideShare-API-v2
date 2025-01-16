import {
  Controller,
  HttpCode,
  UseGuards,
  UseInterceptors,
  Post,
  UploadedFile,
} from '@nestjs/common';
import { PilotService } from './pilot.service';
import { JwtAuthGuard } from 'src/common/guards/current-user.guard';
import { FileInterceptor } from '@nestjs/platform-express';
import { CurrentUser } from 'src/common/decorators/user.decorator';
import * as multer from 'multer';

@Controller('pilot')
export class PilotController {
  constructor(private readonly pilotService: PilotService) {}

  @Post('live-selfie')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: multer.memoryStorage(), // Use memory storage to access file buffer
      limits: {
        fileSize: 5 * 1024 * 1024, // Limit file size to 5MB
      },
      fileFilter: (req, file, callback) => {
        const allowedMimeTypes = ['image/jpeg', 'image/png'];
        if (!allowedMimeTypes.includes(file.mimetype)) {
          return callback(new Error('Only JPEG and PNG files are allowed'), false);
        }
        callback(null, true);
      },
    }),
  )
  async uploadLiveSelfie(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser('userId') userId: string,
  ) {
    return await this.pilotService.uploadLiveSelfie(file, userId);
  }
}
