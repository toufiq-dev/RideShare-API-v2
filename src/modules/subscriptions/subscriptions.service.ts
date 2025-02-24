import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/core/database/prisma.service';
import {
  CreateSubscriptionTypeDto,
  UpdateSubscriptionTypeDto,
} from './dto/subscriptions.dto';

@Injectable()
export class SubscriptionsService {
  constructor(private readonly prisma: PrismaService) {}

  async getSubscriptionTypes() {
    const data = await this.prisma.pilotSubscription.findMany();

    return {
      message: 'Subscription types fetched successfully',
      data,
    };
  }

  async createSubscriptionType(
    createSubscriptionTypeDto: CreateSubscriptionTypeDto,
  ) {
    const { name, coins, price, priceBeforeDiscount } =
      createSubscriptionTypeDto;

    const data = await this.prisma.pilotSubscription.create({
      data: {
        name,
        coins,
        price,
        priceBeforeDiscount,
      },
    });

    return {
      message: 'Subscription type created successfully',
      data,
    };
  }

  async updateSubscriptionType(
    id: string,
    updateSubscriptionTypeDto: UpdateSubscriptionTypeDto,
  ) {
    const { name, coins, price, priceBeforeDiscount } =
      updateSubscriptionTypeDto;

    const data = await this.prisma.pilotSubscription.update({
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
      message: 'Subscription type updated successfully',
      data,
    };
  }

  async onboardingRecharge(pilotId: string) {}
}
