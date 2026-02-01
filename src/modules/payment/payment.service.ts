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
  SslcommerzCallbackQueryDto,
  ReconcileSslcommerzDto,
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

  /**
   * Success callback - Verifies payment with SSLCommerz APIs
   * Called by Android app after successful payment
   */
  async verifySslcommerzSuccess(
    transactionId: string,
    userId: string,
  ): Promise<{ message: string; data?: any }> {
    const pilot = await this.prisma.pilot.findUnique({ where: { userId } });
    if (!pilot) throw new NotFoundException('User not found');

    const tx = await this.prisma.transaction.findFirst({
      where: { order_id: transactionId, pilotId: pilot.id },
    });
    if (!tx)
      throw new NotFoundException(
        `Transaction not found for transactionId: ${transactionId}`,
      );

    // Idempotency checks
    if (tx.status === TransactionStatus.SUCCESSFUL) {
      return {
        message: 'Payment already verified and processed',
        data: {
          transactionId: tx.id,
          status: 'SUCCESSFUL',
          alreadyProcessed: true,
        },
      };
    }

    if (tx.status === TransactionStatus.FAILED) {
      return {
        message: 'Transaction was previously marked as failed',
        data: {
          transactionId: tx.id,
          status: 'FAILED',
          cannotProcess: true,
        },
      };
    }

    const tranId = tx.order_id;
    if (!tranId) {
      throw new BadRequestException('Transaction missing order_id (tran_id)');
    }

    const callbackMetadata = {
      callback_type: 'success',
      callback_timestamp: new Date().toISOString(),
    };

    try {
      // Reusable validation
      const validationResult = await this.validateSslcommerzPayment(
        tranId,
        tx,
        callbackMetadata,
      );

      // Reusable validation checks
      const validationCheck = this.validateSslcommerzResponse(
        validationResult,
        tx,
        tranId,
        callbackMetadata,
      );

      if (!validationCheck.isValid) {
        return validationCheck.response;
      }

      // Reusable fulfillment
      const fulfillmentResult = await this.fulfillPayment(
        tx,
        pilot,
        validationResult,
        callbackMetadata,
      );

      return {
        message: 'Payment verified and processed successfully',
        data: {
          transactionId: tx.id,
          status: 'SUCCESSFUL',
          newBalance: fulfillmentResult.newBalance,
          coinsAdded: fulfillmentResult.coinsAdded,
        },
      };
    } catch (error) {
      // Error handling is done in validateSslcommerzPayment
      throw error;
    }
  }

  /**
   * Failure callback - Marks transaction as failed
   * Called by Android app when payment fails
   */
  async markSslcommerzFailed(
    transactionId: string,
    userId: string,
  ): Promise<{ message: string; data?: any }> {
    const pilot = await this.prisma.pilot.findUnique({ where: { userId } });
    if (!pilot) throw new NotFoundException('User not found');

    const tx = await this.prisma.transaction.findFirst({
      where: { order_id: transactionId, pilotId: pilot.id },
    });
    if (!tx)
      throw new NotFoundException(
        `Transaction not found for transactionId: ${transactionId}`,
      );

    // Idempotency checks
    if (tx.status === TransactionStatus.SUCCESSFUL) {
      return {
        message: 'Transaction was already processed successfully',
        data: {
          transactionId: tx.id,
          status: 'SUCCESSFUL',
          cannotMarkFailed: true,
        },
      };
    }

    if (tx.status === TransactionStatus.FAILED) {
      return {
        message: 'Transaction already marked as failed',
        data: {
          transactionId: tx.id,
          status: 'FAILED',
          alreadyProcessed: true,
        },
      };
    }

    // Update to failed
    await this.prisma.transaction.update({
      where: { id: tx.id },
      data: {
        status: TransactionStatus.FAILED,
        metadata: {
          ...(tx.metadata as any),
          callback_type: 'fail',
          callback_timestamp: new Date().toISOString(),
          failure_reason: 'Payment failed callback from Android app',
        },
      },
    });

    return {
      message: 'Transaction marked as failed',
      data: {
        transactionId: tx.id,
        status: 'FAILED',
      },
    };
  }

  /**
   * Manual reconciliation - Handles network disruptions
   * Called by Android app when network issue occurs but payment may have succeeded
   */
  async verifySslcommerzPayment(
    dto: ReconcileSslcommerzDto,
    userId: string,
  ): Promise<{ message: string; data?: any }> {
    const { transactionId, success, reason } = dto;

    const pilot = await this.prisma.pilot.findUnique({ where: { userId } });
    if (!pilot) throw new NotFoundException('User not found');

    const tx = await this.prisma.transaction.findFirst({
      where: { order_id: transactionId, pilotId: pilot.id },
    });
    if (!tx)
      throw new NotFoundException(
        `Transaction not found for transactionId: ${transactionId}`,
      );

    // Track reconciliation attempts
    const reconciliationAttempts =
      ((tx.metadata as any)?.reconciliation_attempts || 0) + 1;

    const reconciliationMetadata = {
      reconciliation_attempts: reconciliationAttempts,
      last_reconciliation: {
        timestamp: new Date().toISOString(),
        success,
        reason: reason || null,
      },
    };

    if (success) {
      // Idempotency: already successful
      if (tx.status === TransactionStatus.SUCCESSFUL) {
        return {
          message: 'Transaction already verified and processed',
          data: {
            transactionId: tx.id,
            status: 'SUCCESSFUL',
            alreadyProcessed: true,
            reconciliationAttempts,
          },
        };
      }

      const tranId = tx.order_id;
      if (!tranId) {
        throw new BadRequestException('Transaction missing order_id (tran_id)');
      }

      const callbackMetadata = {
        ...reconciliationMetadata,
        callback_type: 'reconcile',
        callback_timestamp: new Date().toISOString(),
      };

      try {
        // Reusable validation
        const validationResult = await this.validateSslcommerzPayment(
          tranId,
          tx,
          callbackMetadata,
        );

        // Reusable validation checks
        const validationCheck = this.validateSslcommerzResponse(
          validationResult,
          tx,
          tranId,
          callbackMetadata,
        );

        if (!validationCheck.isValid) {
          return {
            ...validationCheck.response,
            data: {
              ...validationCheck.response.data,
              reconciliationAttempts,
            },
          };
        }

        // Reusable fulfillment
        const fulfillmentResult = await this.fulfillPayment(
          tx,
          pilot,
          validationResult,
          {
            ...callbackMetadata,
            reconciled_at: new Date().toISOString(),
          },
        );

        return {
          message: 'Payment reconciled and processed successfully',
          data: {
            transactionId: tx.id,
            status: 'SUCCESSFUL',
            newBalance: fulfillmentResult.newBalance,
            coinsAdded: fulfillmentResult.coinsAdded,
            reconciliationAttempts,
          },
        };
      } catch (error) {
        throw error;
      }
    } else {
      // success=false - mark as failed
      if (tx.status === TransactionStatus.SUCCESSFUL) {
        return {
          message: 'Transaction already processed successfully',
          data: {
            transactionId: tx.id,
            status: 'SUCCESSFUL',
            cannotMarkFailed: true,
            reconciliationAttempts,
          },
        };
      }

      await this.prisma.transaction.update({
        where: { id: tx.id },
        data: {
          status: TransactionStatus.FAILED,
          metadata: {
            ...(tx.metadata as any),
            ...reconciliationMetadata,
            reconciliation_result: 'marked_as_failed',
          },
        },
      });

      return {
        message: 'Transaction marked as failed via reconciliation',
        data: {
          transactionId: tx.id,
          status: 'FAILED',
          reconciliationAttempts,
        },
      };
    }
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

  /**
   * Fulfills payment - Updates wallet and marks transaction as successful
   */
  private async fulfillPayment(
    tx: any,
    pilot: any,
    validationResult: {
      firstApiResponse: any;
      finalValidationPayload: any;
      valId: string;
    },
    callbackMetadata: Record<string, any>,
  ): Promise<{ newBalance: number; coinsAdded: number }> {
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

    const times = Number((tx.metadata as any)?.times ?? 1);
    const coinsAdded = Number(subscription.coins) * Number(times);
    const newBalance = Number(wallet.balance) + coinsAdded;

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
            sslcommerz_first_api_response: validationResult.firstApiResponse,
            sslcommerz_second_api_response:
              validationResult.finalValidationPayload,
            sslcommerz_val_id: validationResult.valId,
            validated_at: new Date().toISOString(),
            ...callbackMetadata,
          },
        },
      });
    });

    return { newBalance, coinsAdded };
  }

  /**
   * Helper to mark transaction as failed with metadata
   */
  private async markTransactionFailed(
    tx: any,
    errorMetadata: Record<string, any>,
  ): Promise<void> {
    await this.prisma.transaction.update({
      where: { id: tx.id },
      data: {
        status: TransactionStatus.FAILED,
        metadata: {
          ...(tx.metadata as any),
          ...errorMetadata,
        },
      },
    });
  }

  /**
   * Validates payment with SSLCommerz APIs (both API calls)
   * Returns validation result or throws error
   */
  private async validateSslcommerzPayment(
    tranId: string,
    tx: any,
    callbackMetadata: Record<string, any>,
  ): Promise<{
    firstApiResponse: any;
    finalValidationPayload: any;
    valId: string;
    status: string;
    validatedTranId: string;
    validatedAmount: string;
    validatedCurrency: string;
    riskLevel: string;
  }> {
    // STEP 1: Call first API with tran_id to get val_id
    let firstApiResponse: any;
    let valId: string | undefined;

    try {
      firstApiResponse = await this.validateByTranId(tranId);

      if (firstApiResponse.element && firstApiResponse.element.length > 0) {
        valId = firstApiResponse.element[0].val_id;
      } else {
        throw new BadRequestException(
          'No transaction found in SSLCommerz response',
        );
      }

      if (!valId) {
        throw new BadRequestException('Invalid Validation');
      }
    } catch (error) {
      await this.prisma.transaction.update({
        where: { id: tx.id },
        data: {
          status: TransactionStatus.FAILED,
          metadata: {
            ...(tx.metadata as any),
            sslcommerz_first_api_error:
              error.message || 'First API call failed',
            sslcommerz_first_api_response: firstApiResponse || null,
            ...callbackMetadata,
          },
        },
      });
      throw new BadRequestException(
        `Failed to validate transaction`,
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
            ...callbackMetadata,
          },
        },
      });
      throw new BadRequestException(
        `Failed to validate transaction`,
      );
    }

    return {
      firstApiResponse,
      finalValidationPayload,
      valId,
      status: status!,
      validatedTranId: validatedTranId!,
      validatedAmount: validatedAmount!,
      validatedCurrency: validatedCurrency || 'BDT',
      riskLevel: riskLevel || '0',
    };
  }

  /**
   * Validates SSLCommerz response against transaction
   * Returns validation result with response if invalid
   */
  private validateSslcommerzResponse(
    validationResult: {
      validatedTranId: string;
      status: string;
      validatedAmount: string;
      validatedCurrency: string;
      riskLevel: string;
    },
    tx: any,
    tranId: string,
    callbackMetadata: Record<string, any>,
  ): {
    isValid: boolean;
    response?: { message: string; data: any };
  } {
    // Check tran_id match
    if (validationResult.validatedTranId !== tranId) {
      this.markTransactionFailed(tx, {
        ...callbackMetadata,
        validation_error: 'tran_id mismatch',
      });
      throw new BadRequestException('tran_id mismatch from gateway');
    }

    // Check status
    if (!validationResult.status || validationResult.status !== 'VALIDATED') {
      this.markTransactionFailed(tx, {
        ...callbackMetadata,
        validation_error: `status=${validationResult.status ?? 'UNKNOWN'}`,
      });
      return {
        isValid: false,
        response: {
          message: `Payment not validated. status=${validationResult.status ?? 'UNKNOWN'}`,
          data: {
            transactionId: tx.id,
            status: 'FAILED',
            reason: `SSLCommerz status: ${validationResult.status ?? 'UNKNOWN'}`,
          },
        },
      };
    }

    // Check amount
    if (
      this.normalizeAmount(validationResult.validatedAmount) !==
      this.normalizeAmount(tx.amount.toString())
    ) {
      this.markTransactionFailed(tx, {
        ...callbackMetadata,
        validation_error: 'amount mismatch',
      });
      throw new BadRequestException('Amount mismatch from gateway');
    }

    // Check currency
    if (validationResult.validatedCurrency !== 'BDT') {
      this.markTransactionFailed(tx, {
        ...callbackMetadata,
        validation_error: 'currency mismatch',
      });
      throw new BadRequestException('Currency mismatch from gateway');
    }

    // Check risk level
    if (validationResult.riskLevel !== '0') {
      throw new ForbiddenException('Payment flagged by risk check');
    }

    return { isValid: true };
  }
}
