import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { HttpCode } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { LanguagesService } from './languages.service';
import { CurrentUser } from 'src/common/decorators/user.decorator';
import { UpdateLanguageDto } from './dto/languages.dto';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';

@Controller('languages')
export class LanguagesController {
  constructor(private readonly languagesService: LanguagesService) {}

  @Get()
  async getLanguages() {
    return this.languagesService.findAll();
  }

  @Patch('update')
  @HttpCode(200)
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Update Profile Language' })
  async updateLanguage(
    @Body() updateLanguageDto: UpdateLanguageDto,
    @CurrentUser('userId') userId: string,
  ) {
    return await this.languagesService.updateLanguage(
      userId,
      updateLanguageDto,
    );
  }
}
