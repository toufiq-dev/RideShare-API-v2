import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/core/database/prisma.service';
import {
  AppUpdateDto,
  CreateSubscriptionTypeDto,
  CreateSupportStuffDto,
  UpdateSubscriptionTypeDto,
} from './dto/admin.dto';
import { RoleEnum } from '../auth/dto/auth.dto';
import { randomInt } from 'crypto';
import { AppPlatform } from '@prisma/client';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  async updateAppVersion(appUpdateDto: AppUpdateDto) {
    const {
      adCustomerVersion,
      adDriverVersion,
      iosCustomerVersion,
      appDescription,
    } = appUpdateDto;

    try {
      const data = await this.prisma.platform.upsert({
        where: {
          appDescription,
        },
        update: {
          adDriverVersion,
          adCustomerVersion,
          iosCustomerVersion,
          appDescription,
        },
        create: {
          adDriverVersion,
          adCustomerVersion,
          iosCustomerVersion,
          appDescription,
        },
      });

      return {
        message: 'App version updated successfully.',
        data,
      };
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  async getAppVersion(platform: AppPlatform) {
    try {
      const data = await this.prisma.platform.findUnique({
        where: {
          appDescription: platform,
        },
      });

      return {
        message: 'App version fetched successfully.',
        data,
      };
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  async createSubscriptionType(
    createSubscriptionTypeDto: CreateSubscriptionTypeDto,
  ) {
    const { name, coins, price, priceBeforeDiscount } =
      createSubscriptionTypeDto;

    try {
      const data = await this.prisma.subscription.create({
        data: {
          name,
          coins,
          price,
          priceBeforeDiscount,
        },
      });

      return {
        message: 'Subscription type created successfully.',
        data,
      };
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  async getSubscriptionTypes() {
    try {
      const data = await this.prisma.subscription.findMany();

      return {
        message: 'Subscription types fetched successfully.',
        data,
      };
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  async updateSubscriptionType(
    id: string,
    updateSubscriptionTypeDto: UpdateSubscriptionTypeDto,
  ) {
    const { name, coins, price, priceBeforeDiscount } =
      updateSubscriptionTypeDto;

    const data = await this.prisma.subscription.update({
      where: {
        id,
      },
      data: {
        name,
        coins,
        price,
        priceBeforeDiscount,
      },
    });

    return {
      message: 'Subscription type updated successfully.',
      data,
    };
  }

  async createSupportStuff(createSupportStuffDto: CreateSupportStuffDto) {
    const { name, phone } = createSupportStuffDto;

    try {
      const user = await this.prisma.user.create({
        data: {
          role: RoleEnum.SUPPORT,
        },
      });

      const data = await this.prisma.support.create({
        data: {
          name,
          referralCode: randomInt(10000, 1000000).toString(),
          userId: user.id,
        },
      });

      return {
        message: 'Support stuff created successfully.',
        data,
      };
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  async getSupportStuffs() {
    try {
      const data = await this.prisma.support.findMany();

      return {
        message: 'Support stuffs fetched successfully.',
        data,
      };
    } catch (error) {
      console.error(error);
      throw error;
    }
  }
}
