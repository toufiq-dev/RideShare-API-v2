import { NotFoundException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from 'src/core/database/prisma.service';
import axios from 'axios';
import { CreateOrderDto } from './dto/payment.dto';
import { RedisService } from 'src/core/cache/redis.service';
import { TransactionType, TransactionStatus } from '@prisma/client';

@Injectable()
export class PaymentService {
  private readonly testClientId: string;
  private readonly testClientSecret: string;
  private readonly createOrderUrl: string;
  private readonly apiVersion: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly redis: RedisService,
    private readonly prisma: PrismaService,
  ) {
    this.testClientId = this.configService.get<string>(
      'cashfreePayment.testClientId',
    );
    this.testClientSecret = this.configService.get<string>(
      'cashfreePayment.testClientSecret',
    );
    this.createOrderUrl = this.configService.get<string>(
      'cashfreePayment.createOrderURL',
    );
    this.apiVersion = this.configService.get<string>(
      'cashfreePayment.apiVersion',
    );
  }

  async createOrder(createOrderDto: CreateOrderDto, userId: string) {
    const { subscriptionId, times } = createOrderDto;

    try {
      const subscription = await this.prisma.subscription.findUnique({
        where: { id: subscriptionId },
      });
      if (!subscription) throw new NotFoundException('Subscription not found');

      const pilot = await this.prisma.pilot.findUnique({
        where: { userId },
      });
      if (!pilot) {
        throw new NotFoundException('User not found');
      }

      const data = {
        order_currency: 'INR',
        order_amount: Number(Number(subscription.price) * Number(times)),
        customer_details: {
          customer_id: pilot.id,
          customer_phone: pilot.phone,
        },
      };

      const response = await axios.post(this.createOrderUrl, data, {
        headers: {
          'Content-Type': 'application/json',
          'x-api-version': this.apiVersion,
          'x-client-id': this.testClientId,
          'x-client-secret': this.testClientSecret,
        },
      });

      if (response.status !== 200) {
        throw new Error('Failed to create order');
      }

      await this.redis.set(`subscriptionId:${userId}`, subscriptionId, 300);

      await this.prisma.transaction.create({
        data: {
          pilotId: pilot.id,
          amount: subscription.coins,
          type: TransactionType.SUBSCRIPTION_PURCHASE,
          status: TransactionStatus.PENDING,
        },
      });

      return {
        message: 'Order created successfully',
        data: {
          payment_session_id: response.data.payment_session_id,
          order_id: response.data.order_id,
        },
      };
    } catch (error) {
      console.error(error);
      throw new error();
    }
  }

  async verifyPayment(orderId: string, userId: string) {
    try {
      const response = await axios.get(`${this.createOrderUrl}/${orderId}`, {
        headers: {
          'Content-Type': 'application/json',
          'x-api-version': this.apiVersion,
          'x-client-id': this.testClientId,
          'x-client-secret': this.testClientSecret,
        },
      });

      if (response.status !== 200) {
        throw new Error('Failed to verify payment');
      }

      if (response.data.order_status === 'PAID') {
        const pilot = await this.prisma.pilot.findUnique({
          where: { userId },
        });
        if (!pilot) {
          throw new NotFoundException('User not found');
        }

        const pilotWallet = await this.prisma.pilotWallet.findUnique({
          where: { pilotId: pilot.id },
        });
        if (!pilotWallet) {
          throw new NotFoundException('Pilot wallet not found');
        }

        const subscriptionId = await this.redis.get(`subscriptionId:${userId}`);
        const amount = Number(response.data.order_amount);
        const balance = Number(pilotWallet.balance);

        await this.prisma.$transaction(async (tx) => {
          await tx.pilotWallet.update({
            where: { pilotId: pilot.id },
            data: {
              balance: balance + amount,
              subscriptionId,
            },
          });

          await tx.transaction.create({
            data: {
              pilotId: pilot.id,
              walletId: pilotWallet.id,
              amount,
              type: TransactionType.SUBSCRIPTION_PURCHASE,
              status: TransactionStatus.SUCCESSFULL,
              balanceBefore: balance,
              balanceAfter: balance + amount,
              order_id: response.data.order_id,
            },
          });
        });

        return {
          message: 'Payment verified successfully',
          data: {
            pilotWallet,
          },
        };
      }
    } catch (error) {
      console.error(error);
      throw new error();
    }
  }
}
