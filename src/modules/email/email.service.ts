import { randomInt } from 'node:crypto';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { ConfigService } from '@nestjs/config';
import { sendOtpDto, VerifyEmailDto } from './dto/email.dto';
import { PrismaService } from 'src/core/database/prisma.service';
import { RedisService } from 'src/core/cache/redis.service';

@Injectable()
export class EmailService {
  private transporter: nodemailer.Transporter;

  constructor(
    private configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
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

  async sendOtpEmail(sendOtpDto: sendOtpDto, userId: string) {
    try {
      const { email } = sendOtpDto;

      const otp = randomInt(1000, 10000).toString();
      await this.redis.set(`emailVerificationotp:${email}`, otp, 270);

      const customer = await this.prisma.customer.findUnique({
        where: { userId },
      });
      if (!customer) {
        throw new NotFoundException('Customer not found.');
      }
      if (customer.email === email) {
        throw new BadRequestException('This Email already exists.')
      }

      const mailOptions = {
        from: this.configService.get<string>('EMAIL_FROM'),
        to: email,
        subject: 'Fairdrive OTP',
        html: `
        <div style="font-family: Arial, sans-serif; padding: 20px;">
          <h2>Fairdrive Email Verification</h2>
          <p>Your One-Time Password (OTP) is:</p>
          <h3 style="color: #2c3e50;">${otp}</h3>
          <p>This OTP is valid for 3 minutes.</p>
          <p>If you didn't request this, please ignore this email.</p>
        </div>
      `,
      };

      await this.transporter.sendMail(mailOptions);

      return {
        message: 'OTP sent successfully',
      };
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  async verifyOtp(verifyOtpDto: VerifyEmailDto, userId: string) {
    const { email, otp } = verifyOtpDto;

    const storedOtp = await this.redis.get(`emailVerificationotp:${email}`);

    if (!storedOtp) {
      throw new BadRequestException('OTP not found');
    }

    if (storedOtp === otp) {
      await this.redis.del(`emailVerificationotp:${email}`);

      await this.prisma.customer.update({
        where: { userId },
        data: {
          isEmailVerified: true,
        },
      });

      await this.prisma.customer.update({
        where: { userId },
        data: {
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
