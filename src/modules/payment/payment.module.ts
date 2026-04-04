import { Module } from '@nestjs/common';
import { PaymentService } from './payment.service';
import { PaymentController } from './payment.controller';
import { CashfreeWebhookController } from './cashfree-webhook.controller';

@Module({
  controllers: [PaymentController, CashfreeWebhookController],
  providers: [PaymentService],
})
export class PaymentModule {}
