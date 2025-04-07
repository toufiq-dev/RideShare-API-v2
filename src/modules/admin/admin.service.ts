import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/core/database/prisma.service';
import {
  CreateSubscriptionTypeDto,
  CreateSupportStuffDto,
  UpdateSubscriptionTypeDto,
} from './dto/admin.dto';
import { RoleEnum } from '../auth/dto/auth.dto';
import { randomInt } from 'crypto';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  async createSubscriptionType(
    createSubscriptionTypeDto: CreateSubscriptionTypeDto,
  ) {
    const { name, coins, price, priceBeforeDiscount } =
      createSubscriptionTypeDto;

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
  }

  async getSubscriptionTypes() {
    const data = await this.prisma.subscription.findMany();

    return {
      message: 'Subscription types fetched successfully.',
      data,
    };
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
  }

  async getSupportStuffs() {
    const data = await this.prisma.support.findMany();

    return {
      message: 'Support stuffs fetched successfully.',
      data,
    };
  }
}
