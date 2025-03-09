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
    const data = await this.prisma.subscription.findMany();
  

    return {
      message: 'Subscription types fetched successfully.',
      data,
    };
  }

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

  async onboardingOffer(userId: string) {
    try {
      const pilot = await this.prisma.pilot.findUnique({ where: { userId } });

      const subscription = await this.prisma.subscription.findUnique({
        where: { name: 'Flexi Pack' },
      });

      // Create pilot wallet
      const data = await this.prisma.pilotWallet.create({
        data: {
          pilotId: pilot.id,
          balance: subscription.coins,
          subscriptionId: subscription.id,
        },
      });

      return {
        message: 'Pilot onboarding coins availed successfully.',
        data,
      };
    } catch (error) {
      console.error(error);
      throw error;
    }
  }
}
