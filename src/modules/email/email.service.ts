import { randomInt } from 'node:crypto';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { ConfigService } from '@nestjs/config';
import { EmailSendOtpDto, EmailVerifyEmailDto } from './dto/email.dto';
import { PrismaService } from 'src/core/database/database.service';
import { RedisService } from 'src/core/cache/redis.service';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { RedisKeys } from 'src/core/cache/redis-keys';
import { AzureEmailService } from './azure-email.service';
import { LoggerService } from 'src/core/logging/logger.service';

@Injectable()
export class EmailService {
  private transporter: nodemailer.Transporter;

  constructor(
    private configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    @InjectQueue('otp-email') private readonly otpQueue: Queue,
    private readonly azureEmailService: AzureEmailService,
    private readonly logger: LoggerService,
  ) {
    this.transporter = nodemailer.createTransport({
      host: this.configService.get<string>('EMAIL_HOST'),
      port: this.configService.get<number>('EMAIL_PORT'),
      secure: false, // true for 465, false for other ports
      auth: {
        user: this.configService.get<string>('EMAIL_USER'),
        pass: this.configService.get<string>('EMAIL_PASSWORD'),
      },
    });
  }

  async sendOtpEmail(sendOtpDto: EmailSendOtpDto) {
    const { email } = sendOtpDto;

    const otpSent = await this.redis.get(`otpSent:${email}`);
    if (otpSent) {
      throw new BadRequestException(
        'OTP already sent. Please wait for 1 minute.',
      );
    }

    // enqueue the sending email job
    await this.otpQueue.add('send-otp', { sendOtpDto });
    return { message: 'OTP will be sent shortly' };
  }

  async _sendOtpEmail(sendOtpDto: EmailSendOtpDto) {
    try {
      const { email } = sendOtpDto;
      const otp = randomInt(1000, 10000).toString();

      await this.redis.set(
        `${RedisKeys.EMAIL_VERIFICATION_OTP}${email}`,
        otp,
        60,
      );

      let sentMail = false;
      try {
        sentMail = await this.azureEmailService.sendOtpEmail(email, otp);
      } catch (azureError) {
        const mailOptions = {
          from: this.configService.get<string>('EMAIL_FROM'),
          to: email,
          subject: 'Fairdrive OTP',
          html: `
          <div style="font-family: Arial, sans-serif; padding: 20px;">
            <h2>Fairdrive Email Verification</h2>
            <p>Your One-Time Password (OTP) is:</p>
            <h3 style="color: #2c3e50;">${otp}</h3>
            <p>This OTP is valid for 1 minute.</p>
            <p>If you didn't request this, please ignore this email.</p>
          </div>
        `,
        };

        sentMail = await this.transporter.sendMail(mailOptions);
      }

      if (!sentMail) {
        throw new BadRequestException('Failed to send OTP');
      } else {
        await this.redis.set(`otpSent:${email}`, 'true', 60);
      }

      return { message: 'OTP sent to your email successfully' };
    } catch (error) {
      this.logger.logError(
        error instanceof Error ? error : new Error(String(error)),
        'EmailService',
        { scope: '_sendOtpEmail' },
      );
      throw error;
    }
  }

  async verifyOtpCustomer(verifyOtpDto: EmailVerifyEmailDto, userId: string) {
    const { email, otp } = verifyOtpDto;

    const storedOtp = await this.redis.get(`emailVerificationotp:${email}`);

    if (!storedOtp) {
      throw new BadRequestException('OTP invalid or expired');
    }

    if (storedOtp === otp) {
      await this.redis.del(`emailVerificationotp:${email}`);

      await this.prisma.customer.update({
        where: { userId },
        data: {
          isEmailVerified: true,
          email,
        },
      });

      return {
        message: 'Email verified successfully',
      };
    }

    throw new BadRequestException('Invalid OTP');
  }
}
