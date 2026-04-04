import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/core/database/database.service';
import {
  CreateSubscriptionTypeDto,
  UpdateSubscriptionTypeDto,
} from './dto/subscriptions.dto';
import {
  TransactionType,
  TransactionStatus,
} from 'src/common/types/common.type';
import { LoggerService } from 'src/core/logging/logger.service';

@Injectable()
export class SubscriptionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: LoggerService,
  ) {}

  async getSubscriptionTypes() {
    try {
      const data = await this.prisma.subscription.findMany({
        orderBy: {
          serialNumber: 'asc',
        },
      });

      data.forEach((subscription: any) => {
        subscription.price = Number(subscription.price);
        subscription.coins = Number(subscription.coins);
        subscription.priceBeforeDiscount = Number(
          subscription.priceBeforeDiscount,
        );
      });

      return {
        message: 'Subscription types fetched successfully.',
        data,
      };
    } catch (error) {
      this.logger.logError(
        error instanceof Error ? error : new Error(String(error)),
        'SubscriptionsService',
      );
      throw error;
    }
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
}
