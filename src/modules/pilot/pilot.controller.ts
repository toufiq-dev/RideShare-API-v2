import {
  Controller,
  HttpCode,
  UseGuards,
  UseInterceptors,
  Get,
  Post,
  UploadedFile,
} from '@nestjs/common';
import { PilotService } from './pilot.service';
import { JwtAuthGuard } from 'src/common/guards/current-user.guard';
import { CurrentUser } from 'src/common/decorators/user.decorator';
import { ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { FileInterceptor } from 'src/common/interceptors/file.interceptor';

@Controller('pilot')
export class PilotController {
  constructor(private readonly pilotService: PilotService) {}

  @Get()
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get pilot' })
  async getPilot(@CurrentUser('userId') userId: string) {
    return await this.pilotService.getPilot(userId);
  }

  @Post('live-selfie')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Upload live selfie for pilot' })
  @UseInterceptors(FileInterceptor)
  async uploadLiveSelfie(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser('userId') userId: string,
    @CurrentUser('role') role: string,
  ) {
    return await this.pilotService.uploadLiveSelfie(file, userId, role);
  }
}
