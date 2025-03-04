import { Injectable } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { ConfigService } from '@nestjs/config';
import { VerifyEmailDto } from './dto/email.dto';
import { PrismaService } from 'src/core/database/prisma.service';
import { VerifyOtpDto } from '../auth/dto/auth.dto';

@Injectable()
export class EmailService {
  private transporter: nodemailer.Transporter;
  private readonly otpStore: Map<string, { otp: string; expires: number }> =
    new Map();

  constructor(
    private configService: ConfigService,
    private readonly prisma: PrismaService,
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

  async sendOtpEmail(verifyEmailDto: VerifyEmailDto) {
    try {
      const otp = Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit OTP
      const expires = Date.now() + 3 * 60 * 1000; // Expires in 10 minutes

      const mailOptions = {
        from: this.configService.get<string>('EMAIL_FROM'),
        to: verifyEmailDto.email,
        subject: 'Fairdrive OTP',
        html: `
        <div style="font-family: Arial, sans-serif; padding: 20px;">
          <h2>Taxi Booking Verification</h2>
          <p>Your One-Time Password (OTP) is:</p>
          <h3 style="color: #2c3e50;">${otp}</h3>
          <p>This OTP is valid for 3 minutes.</p>
          <p>If you didn't request this, please ignore this email.</p>
        </div>
      `,
      };

      await this.transporter.sendMail(mailOptions);
      this.otpStore.set(verifyEmailDto.email, { otp, expires });

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
    const storedOtp = this.otpStore.get(email);

    if (!storedOtp) {
      return {
        message: 'Invalid OTP',
      };
    }

    if (Date.now() > storedOtp.expires) {
      this.otpStore.delete(email);
      return {
        message: 'OTP expired',
      };
    }

    if (storedOtp.otp === otp) {
      this.otpStore.delete(email); // OTP can only be used once

      await this.prisma.user.update({
        where: { id: userId },
        data: {
          isEmailVerified: true,
        },
      });

      return {
        message: 'Email verified successfully',
      };
    }

    return {
      message: 'OTP verification failed',
    };
  }
}
