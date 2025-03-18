import { Body, Controller, Get, Post, Patch } from '@nestjs/common';
import { HttpCode } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { LanguagesService } from './languages.service';
import { CurrentUser } from 'src/common/decorators/user.decorator';
import { UpdateLanguageDto } from './dto/languages.dto';

@Controller('languages')
export class LanguagesController {
  constructor(private readonly languagesService: LanguagesService) {}

  @Post()
  async createLanguage(@Body('name') name: string) {
    return this.languagesService.create(name);
  }

  @Get()
  async getLanguages() {
    return this.languagesService.findAll();
  }

  @Patch('update')
  @HttpCode(200)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update pilot Language' })
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
