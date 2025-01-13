import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';

@Injectable()
export class LanguagesService {
  constructor(private prisma: PrismaService) {}

  async create(name: string) {
    return this.prisma.languages.create({
      data: {
        name,
      },
    });
  }

  async findAll() {
    const languages = await this.prisma.languages.findMany();

    return { languages };
  }
}
