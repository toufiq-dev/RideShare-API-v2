import { Module } from '@nestjs/common';
import { EmailService } from './email.service';
import { EmailController } from './email.controller';
import { BullModule } from '@nestjs/bullmq';
import { OtpEmailProcessor } from './processor/email.processor';

@Module({
  imports: [BullModule.registerQueue({ name: 'otp-email' })],
  controllers: [EmailController],
  providers: [EmailService, OtpEmailProcessor],
})
export class EmailModule {}
