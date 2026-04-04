import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import multer, { diskStorage } from 'multer';
import { extname, join } from 'path';
import { AzureService } from 'src/core/utils/azure.util';
import * as fs from 'fs';
import { ConfigService } from '@nestjs/config';
import { promisify } from 'util';
import { Request } from 'express';
import { LoggerService } from 'src/core/logging/logger.service';

@Injectable()
export class CustomFileInterceptor implements NestInterceptor {
  private readonly allowedMimeTypes: string[];
  private readonly maxFileSize: number;
  private readonly tempUploadDir: string;
  private multerInstance: any;

  constructor(
    private readonly azureBlobService: AzureService,
    private readonly configService: ConfigService,
    private readonly logger: LoggerService,
  ) {
    this.allowedMimeTypes = this.configService.get<string[]>(
      'file.allowedMimeTypes',
    ) || ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'];
    this.maxFileSize =
      this.configService.get<number>('file.maxFileSize') || 3 * 1024 * 1024;
    this.tempUploadDir = this.configService.get<string>('file.tempUploadDir');

    if (!this.tempUploadDir) {
      this.tempUploadDir = join(process.cwd(), 'uploads', 'temp');
    }

    this.initializeMulter();
  }

  private initializeMulter() {
    this.ensureTempDirectoryExists();

    const storage = diskStorage({
      destination: (req, file, cb) => {
        cb(null, this.tempUploadDir);
      },
      filename: (req, file, cb) => {
        const userId = req.user?.userId || 'unknown';
        const uniqueSuffix = `${userId}-${Date.now()}`;
        const ext = extname(file.originalname);
        cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
      },
    });

    this.multerInstance = multer({
      storage,
      limits: {
        fileSize: this.maxFileSize,
      },
      fileFilter: (
        req: Request,
        file: Express.Multer.File,
        callback: (error: null, acceptFile: boolean) => void,
      ) => {
        if (!this.allowedMimeTypes.includes(file.mimetype)) {
          // Instead of passing an error, we'll set acceptFile to false
          // and handle the error in the interceptor
          callback(null, false);
          return;
        }
        callback(null, true);
      },
    }).single('file');
  }

  private ensureTempDirectoryExists(): void {
    try {
      if (!fs.existsSync(this.tempUploadDir)) {
        fs.mkdirSync(this.tempUploadDir, { recursive: true });
      }
    } catch (error) {
      throw new InternalServerErrorException(
        `Failed to create temporary upload directory: ${error.message}`,
      );
    }
  }

  private async cleanUpFile(path: string): Promise<void> {
    try {
      if (fs.existsSync(path)) {
        await promisify(fs.unlink)(path);
      }
    } catch (error) {
      this.logger.logError(
        error instanceof Error ? error : new Error(String(error)),
        'CustomFileInterceptor',
        { scope: 'cleanUpFile' },
      );
    }
  }

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<any>> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();

    return new Observable((subscriber) => {
      this.multerInstance(request, response, async (err: any) => {
        if (err) {
          if (err.code === 'LIMIT_FILE_SIZE') {
            subscriber.error(
              new BadRequestException(
                `File size exceeds the limit of ${this.maxFileSize} bytes`,
              ),
            );
            return;
          }
          subscriber.error(new BadRequestException(err.message));
          return;
        }

        const file = request.file;
        if (!file) {
          // If file was rejected by fileFilter
          if (request.fileValidationError) {
            subscriber.error(
              new BadRequestException(request.fileValidationError),
            );
            return;
          }
          subscriber.error(
            new BadRequestException(
              `Invalid file type. Allowed types: ${this.allowedMimeTypes.join(', ')}`,
            ),
          );
          return;
        }

        try {
          const buffer = await promisify(fs.readFile)(file.path);

          const azureUrl = await this.azureBlobService.uploadFile(
            buffer,
            file.originalname,
            request.user.userId,
            file.mimetype,
          );

          file.azureFileUrl = azureUrl;
          await this.cleanUpFile(file.path);

          next.handle().subscribe({
            next: (value) => subscriber.next(value),
            error: (error) => subscriber.error(error),
            complete: () => subscriber.complete(),
          });
        } catch (error) {
          await this.cleanUpFile(file.path);
          subscriber.error(
            new InternalServerErrorException(
              `File processing failed: ${error.message}`,
            ),
          );
        }
      });
    });
  }
}
