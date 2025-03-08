import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from 'src/core/database/prisma.service';
import axios from 'axios';
import { CreateOrderDto } from './dto/payment.dto';
import { RoleEnum } from '../auth/dto/auth.dto';

@Injectable()
export class PaymentService {
  private readonly testClientId: string;
  private readonly testClientSecret: string;
  private readonly createOrderUrl: string;
  private readonly apiVersion: string;

  constructor(
    private readonly configService: ConfigService,
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
    const { subscriptionId } = createOrderDto;

    try {
      const subscription = await this.prisma.subscription.findUnique({
        where: { id: subscriptionId },
      });
      if (!subscription)
        throw new BadRequestException('Subscription not found');

      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      });
      if (!user || user.role !== RoleEnum.PILOT) {
        throw new BadRequestException('User not found');
      }

      const data = {
        order_currency: 'INR',
        order_amount: Number(subscription.price),
        customer_details: {
          customer_id: user.id,
          customer_phone: user.phone,
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
}
