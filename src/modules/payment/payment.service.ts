import {
  NotFoundException,
  Injectable,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from 'src/core/database/database.service';
import axios from 'axios';
import {
  CreateOrderDto,
  VerifyPaymentDto,
  VerifySslcommerzDto,
} from './dto/payment.dto';
import { TransactionType, TransactionStatus } from '@prisma/client';
import { randomBytes } from 'crypto';

@Injectable()
export class PaymentService {
  private readonly storeId: string;
  private readonly storePassword: string;
  private readonly validatorBaseUrl: string;
  private readonly validatorVersion: string;
  private readonly validatorFormat: string;
  private readonly testClientId: string;
  private readonly testClientSecret: string;
  private readonly createOrderUrl: string;
  private readonly apiVersion: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.storeId = this.configService.get<string>('sslcommerz.storeId');
    this.storePassword = this.configService.get<string>(
      'sslcommerz.storePassword',
    );
    this.validatorBaseUrl = this.configService.get<string>(
      'sslcommerz.validatorBaseUrl',
    );
    this.validatorVersion =
      this.configService.get<string>('sslcommerz.validatorVersion') || '3';
    this.validatorFormat =
      this.configService.get<string>('sslcommerz.validatorFormat') || 'json';
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

  async initSslcommerzSubscription(dto: CreateOrderDto, userId: string) {
    const { subscriptionId, times, couponCode } = dto;

    const subscription = await this.prisma.subscription.findUnique({
      where: { id: subscriptionId },
    });
    if (!subscription) throw new NotFoundException('Subscription not found');

    let coupon = null;
    if (couponCode) {
      coupon = await this.prisma.coupon.findUnique({
        where: { name: couponCode },
      });
      if (!coupon) throw new NotFoundException('Coupon not found');
      if (coupon.validUntil && coupon.validUntil < new Date())
        throw new BadRequestException('Coupon has expired');
    }

    const pilot = await this.prisma.pilot.findUnique({
      where: { userId },
      include: { drivingLicense: true },
    });
    if (!pilot) throw new NotFoundException('User not found');

    const wallet = await this.prisma.pilotWallet.findUnique({
      where: { pilotId: pilot.id },
    });
    if (!wallet) throw new NotFoundException('Pilot wallet not found');

    const amount = Number(subscription.price) * Number(times);
    if (!Number.isFinite(amount) || amount <= 0)
      throw new BadRequestException('Invalid amount');

    const finalAmount = amount - (coupon ? Number(coupon.discount) : 0);

    const tranId = this.generateTranId('FD');

    await this.prisma.transaction.create({
      data: {
        pilotId: pilot.id,
        walletId: wallet.id,
        amount: finalAmount,
        order_id: tranId, // store tran_id here
        balanceBefore: Number(wallet.balance),
        type: TransactionType.SUBSCRIPTION_PURCHASE,
        status: TransactionStatus.PENDING,
        subscriptionId: subscription.id,
        metadata: {
          gateway: 'SSLCOMMERZ',
          currency: 'BDT',
          times,
          subscriptionId,
          pilotId: pilot.id,
          pilotPhone: pilot.phone,
        },
      },
    });

    return {
      message: 'SSLCommerz payment initialized',
      data: {
        SSLCOMMERZ_SDK_TYPE: 'TESTBOX',
        transactionId: tranId,
        originalAmount: amount,
        couponDiscount: coupon ? Number(coupon.discount) : 0,
        couponCode: coupon ? coupon.name : null,
        finalAmount,
        storeId: this.storeId,
        storePassword: this.storePassword,
      },
    };
  }

  async verifySslcommerzSubscription(dto: VerifySslcommerzDto, userId: string) {
    const { transactionId } = dto;

    const pilot = await this.prisma.pilot.findUnique({ where: { userId } });
    if (!pilot) throw new NotFoundException('User not found');

    const tx = await this.prisma.transaction.findFirst({
      where: { id: transactionId, pilotId: pilot.id },
    });
    if (!tx)
      throw new NotFoundException(
        'Transaction not found for this transactionId',
      );

    // Idempotency: already processed
    if (tx.status === TransactionStatus.SUCCESSFUL) {
      return { message: 'Payment already verified' };
    }

    // Get tran_id from transaction order_id
    const tranId = tx.order_id;
    if (!tranId) {
      throw new BadRequestException('Transaction missing order_id (tran_id)');
    }

    // STEP 1: Call first API with tran_id to get val_id
    let firstApiResponse: any;
    let valId: string | undefined;

    try {
      firstApiResponse = await this.validateByTranId(tranId);

      // Extract val_id from first API response
      // Response structure: { element: [{ val_id: "...", ... }] }
      if (firstApiResponse.element && firstApiResponse.element.length > 0) {
        valId = firstApiResponse.element[0].val_id;
      } else {
        throw new BadRequestException(
          'No transaction found in SSLCommerz response',
        );
      }

      if (!valId) {
        throw new BadRequestException('val_id not found in first API response');
      }
    } catch (error) {
      // If first API fails, mark transaction as failed
      await this.prisma.transaction.update({
        where: { id: tx.id },
        data: {
          status: TransactionStatus.FAILED,
          metadata: {
            ...(tx.metadata as any),
            sslcommerz_first_api_error:
              error.message || 'First API call failed',
            sslcommerz_first_api_response: firstApiResponse || null,
          },
        },
      });
      throw new BadRequestException(
        `Failed to validate transaction with SSLCommerz: ${error.message}`,
      );
    }

    // STEP 2: Call second API with val_id for final validation
    let finalValidationPayload: any;
    let status: string | undefined;
    let validatedTranId: string | undefined;
    let validatedAmount: string | undefined;
    let validatedCurrency: string | undefined;
    let riskLevel: string | undefined;

    try {
      finalValidationPayload = await this.validateByValId(valId);

      status = finalValidationPayload.status;
      validatedTranId = finalValidationPayload.tran_id;
      validatedAmount = finalValidationPayload.amount;
      validatedCurrency =
        finalValidationPayload.currency_type || finalValidationPayload.currency;
      riskLevel = finalValidationPayload.risk_level;
    } catch (error) {
      // If second API fails, mark transaction as failed
      await this.prisma.transaction.update({
        where: { id: tx.id },
        data: {
          status: TransactionStatus.FAILED,
          metadata: {
            ...(tx.metadata as any),
            sslcommerz_first_api_response: firstApiResponse,
            sslcommerz_val_id: valId,
            sslcommerz_second_api_error:
              error.message || 'Second API call failed',
          },
        },
      });
      throw new BadRequestException(
        `Failed to validate with val_id: ${error.message}`,
      );
    }

    // Validation checks using second API response
    if (validatedTranId !== tranId) {
      await this.prisma.transaction.update({
        where: { id: tx.id },
        data: {
          status: TransactionStatus.FAILED,
          metadata: {
            ...(tx.metadata as any),
            sslcommerz_first_api_response: firstApiResponse,
            sslcommerz_second_api_response: finalValidationPayload,
            sslcommerz_val_id: valId,
          },
        },
      });
      throw new BadRequestException('tran_id mismatch from gateway');
    }

    if (!status || status !== 'VALIDATED') {
      await this.prisma.transaction.update({
        where: { id: tx.id },
        data: {
          status: TransactionStatus.FAILED,
          metadata: {
            ...(tx.metadata as any),
            sslcommerz_first_api_response: firstApiResponse,
            sslcommerz_second_api_response: finalValidationPayload,
            sslcommerz_val_id: valId,
          },
        },
      });
      return {
        success: false,
        message: `Payment not validated. status=${status ?? 'UNKNOWN'}`,
      };
    }

    // Amount check (critical)
    if (
      this.normalizeAmount(validatedAmount ?? '0') !==
      this.normalizeAmount(tx.amount.toString())
    ) {
      await this.prisma.transaction.update({
        where: { id: tx.id },
        data: {
          status: TransactionStatus.FAILED,
          metadata: {
            ...(tx.metadata as any),
            sslcommerz_first_api_response: firstApiResponse,
            sslcommerz_second_api_response: finalValidationPayload,
            sslcommerz_val_id: valId,
          },
        },
      });
      throw new BadRequestException('Amount mismatch from gateway');
    }

    // Currency check
    // if (validatedCurrency && validatedCurrency !== 'BDT') {
    //   await this.prisma.transaction.update({
    //     where: { id: tx.id },
    //     data: {
    //       status: TransactionStatus.FAILED,
    //       metadata: {
    //         ...(tx.metadata as any),
    //         sslcommerz_first_api_response: firstApiResponse,
    //         sslcommerz_second_api_response: finalValidationPayload,
    //         sslcommerz_val_id: valId,
    //       },
    //     },
    //   });
    //   throw new BadRequestException('Currency mismatch from gateway');
    // }

    // Optional: risk enforcement
    if (riskLevel && riskLevel !== '0') {
      throw new ForbiddenException('Payment flagged by risk check');
    }

    // Fulfillment (subscription coins)
    const subscriptionId = tx.subscriptionId;
    if (!subscriptionId)
      throw new BadRequestException('Missing subscriptionId on transaction');

    const subscription = await this.prisma.subscription.findUnique({
      where: { id: subscriptionId },
    });
    if (!subscription) throw new NotFoundException('Subscription not found');

    const wallet = await this.prisma.pilotWallet.findUnique({
      where: { pilotId: pilot.id },
    });
    if (!wallet) throw new NotFoundException('Pilot wallet not found');

    // Determine "times" from metadata
    const times = Number((tx.metadata as any)?.times ?? 1);

    const newBalance =
      Number(wallet.balance) + Number(subscription.coins) * Number(times);

    await this.prisma.$transaction(async (prisma) => {
      await prisma.pilotWallet.update({
        where: { pilotId: pilot.id },
        data: { balance: newBalance, subscriptionId },
      });

      await prisma.transaction.update({
        where: { id: tx.id },
        data: {
          status: TransactionStatus.SUCCESSFUL,
          balanceAfter: newBalance,
          metadata: {
            ...(tx.metadata as any),
            sslcommerz_first_api_response: firstApiResponse,
            sslcommerz_second_api_response: finalValidationPayload,
            sslcommerz_val_id: valId,
          },
        },
      });
    });

    return { message: 'Payment verified successfully' };
  }

  async createOrder(createOrderDto: CreateOrderDto, userId: string) {
    const { subscriptionId, times } = createOrderDto;

    try {
      const subscription = await this.prisma.subscription.findUnique({
        where: { id: subscriptionId },
      });
      if (!subscription) {
        throw new NotFoundException('Subscription not found');
      }

      const pilot = await this.prisma.pilot.findUnique({
        where: { userId },
        include: { drivingLicense: true },
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
          // customer_name: pilot.drivingLicense.nameOnLicense,
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

      const wallet: any = await this.prisma.pilotWallet.findUnique({
        where: { pilotId: pilot.id },
      });

      const transaction = await this.prisma.transaction.create({
        data: {
          pilotId: pilot.id,
          amount: Number(subscription.price) * Number(times),
          order_id: response.data.order_id,
          walletId: wallet.id,
          balanceBefore: Number(wallet.balance),
          type: TransactionType.SUBSCRIPTION_PURCHASE,
          status: TransactionStatus.PENDING,
          subscriptionId: subscription.id,
        },
      });

      return {
        message: 'Order created successfully',
        data: {
          payment_session_id: response.data.payment_session_id,
          order_id: response.data.order_id,
          transactionId: transaction.id,
        },
      };
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  async verifyPayment(
    orderId: string,
    verifyPaymentDto: VerifyPaymentDto,
    userId: string,
  ) {
    const { subscriptionId, transactionId, times } = verifyPaymentDto;

    try {
      const response = await axios.get(`${this.createOrderUrl}/${orderId}`, {
        headers: {
          'Content-Type': 'application/json',
          'x-api-version': this.apiVersion,
          'x-client-id': this.testClientId,
          'x-client-secret': this.testClientSecret,
        },
      });

      const subcsription = await this.prisma.subscription.findUnique({
        where: { id: subscriptionId },
      });

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

        const balance =
          Number(pilotWallet.balance) +
          Number(subcsription.coins) * Number(times);

        await this.prisma.$transaction(async (tx) => {
          await tx.pilotWallet.update({
            where: { pilotId: pilot.id },
            data: {
              balance: balance,
              subscriptionId,
            },
          });

          await tx.transaction.update({
            where: { id: transactionId },
            data: {
              status: TransactionStatus.SUCCESSFUL,
              balanceAfter: balance,
            },
          });
        });

        return {
          message: 'Payment verified successfully',
        };
      } else {
        await this.prisma.transaction.update({
          where: { id: transactionId },
          data: {
            status: TransactionStatus.FAILED,
          },
        });

        return {
          success: false,
          message: 'Payment failed',
        };
      }
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  private generateTranId(prefix = 'FD') {
    return `${prefix}${randomBytes(7).toString('hex')}`;
  }

  private normalizeAmount(s: string | number) {
    const n = typeof s === 'number' ? s : Number(s);
    return Math.round(n * 100);
  }

  private async validateByTranId(tranId: string) {
    const url = `${this.validatorBaseUrl}/merchantTransIDvalidationAPI.php`;
    const res = await axios.get(url, {
      params: {
        tran_id: tranId,
        store_id: this.storeId,
        store_passwd: this.storePassword,
        v: this.validatorVersion,
        format: this.validatorFormat,
      },
      timeout: 15000,
    });
    return res.data;
  }

  private async validateByValId(valId: string) {
    const url = `${this.validatorBaseUrl}/validationserverAPI.php`;
    const res = await axios.get(url, {
      params: {
        val_id: valId,
        store_id: this.storeId,
        store_passwd: this.storePassword,
      },
      timeout: 15000,
    });
    return res.data;
  }
}
