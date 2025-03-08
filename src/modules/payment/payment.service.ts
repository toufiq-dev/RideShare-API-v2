import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from 'src/core/database/prisma.service';
import axios from 'axios';

@Injectable()
export class PaymentService {
  private readonly createOrderUrl: string;
  private readonly testClientId: string;
  private readonly testClientSecret: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.createOrderUrl = this.configService.get<string>(
      'cashfreePayment.createOrderURL',
    );
    this.testClientId = this.configService.get<string>(
      'cashfreePayment.testClientId',
    );
    this.testClientSecret = this.configService.get<string>(
      'cashfreePayment.testClientSecret',
    );
  }

  async createOrder() {}
}
