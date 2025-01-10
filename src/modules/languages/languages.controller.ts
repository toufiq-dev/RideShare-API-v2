import { Body, Controller, Get, Post } from '@nestjs/common';
import { LanguagesService } from './languages.service';

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
}
