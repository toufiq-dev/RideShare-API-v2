import { Module } from '@nestjs/common';
import { EmailService } from './email.service';
import { EmailController } from './email.controller';
import { BullModule } from '@nestjs/bullmq';
import { OtpEmailProcessor } from './processor/email.processor';
import { AzureEmailService } from './azure-email.service';

@Module({
  imports: [BullModule.registerQueue({ name: 'otp-email' })],
  controllers: [EmailController],
  providers: [EmailService, OtpEmailProcessor, AzureEmailService],
  exports: [EmailService],
})
export class EmailModule {}
