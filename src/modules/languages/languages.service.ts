import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { UpdateLanguageDto } from './dto/languages.dto';
import { RoleEnum } from '../auth/dto/auth.dto';

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

  async updateLanguage(userId: string, updateLanguageDto: UpdateLanguageDto) {
    const { language } = updateLanguageDto;

    try {
      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      if (!user) {
        throw new NotFoundException('User not found.');
      }

      const languageRecord = await this.prisma.languages.findUnique({
        where: { name: language },
      });

      let data;
      if ((user.role = RoleEnum.PILOT)) {
        data = await this.prisma.pilot.update({
          where: { userId },
          data: { languageId: languageRecord.id },
        });
      } else if ((user.role = RoleEnum.CUSTOMER)) {
        data = await this.prisma.customer.update({
          where: { userId },
          data: { languageId: languageRecord.id },
        });
      }

      return {
        message: 'Language updated successfully.',
        data,
      };
    } catch (error) {
      console.error(error);
      throw error;
    }
  }
}
