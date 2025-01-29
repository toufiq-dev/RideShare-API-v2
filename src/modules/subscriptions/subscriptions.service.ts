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
    const data = await this.prisma.subscriptionType.findMany();

    return {
      message: 'Subscription types fetched successfully',
      data,
    };
  }

  async createSubscriptionType(
    createSubscriptionTypeDto: CreateSubscriptionTypeDto,
  ) {
    const { name, coins, description } = createSubscriptionTypeDto;

    const data = await this.prisma.subscriptionType.create({
      data: {
        name,
        coins,
        description,
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
    const { name, coins, description } = updateSubscriptionTypeDto;

    const data = await this.prisma.subscriptionType.update({
      where: {
        id,
      },
      data: {
        name,
        coins,
        description,
      },
    });

    return {
      message: 'Subscription type updated successfully',
      data,
    };
  }

  async onboardingRecharge(pilotId: string) {}
}
