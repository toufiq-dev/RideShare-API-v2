import {
  Controller,
  Post,
  HttpCode,
  HttpStatus,
  Req,
  RawBodyRequest,
} from '@nestjs/common';
import { ApiExcludeController, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { PaymentService } from './payment.service';

/**
 * Public endpoint for Cashfree PG webhooks (no JWT).
 * Configure URL in Cashfree dashboard: POST {API_ORIGIN}/payment/cashfree/webhook
 */
@ApiTags('Payment')
@ApiExcludeController()
@Controller('payment')
export class CashfreeWebhookController {
  constructor(private readonly paymentService: PaymentService) {}

  @Post('cashfree/webhook')
  @HttpCode(HttpStatus.OK)
  handleCashfreeWebhook(@Req() req: RawBodyRequest<Request>) {
    return this.paymentService.handleCashfreeWebhook(req);
  }
}
