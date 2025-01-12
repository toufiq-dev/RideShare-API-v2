import { randomInt } from 'node:crypto';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from 'src/core/database/prisma.service';
import { RedisService } from 'src/core/cache/redis.service';
import { TwilioUtil } from 'src/core/utils/twilio.util';
import {
  SendOtpDto,
  VerifyOtpDto,
  CompleteCustomerOnboardingDto,
} from './dto/onboarding.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly twilio: TwilioUtil,
  ) {}

  async sendOtp(sendOtpDto: SendOtpDto) {
    const { languageId, phone } = sendOtpDto;

    const otp = randomInt(1000, 9999).toString();

    await this.redis.set(`otp:${phone}`, otp, 300);
    await this.redis.set(`languageId:${phone}`, languageId, 300);

    await this.twilio.sendOtp(phone, otp);

    return 'OTP sent successfully';
  }

  // generate access token, refresh token
  async verifyOtpCustomer(verifyOtpDto: VerifyOtpDto) {
    const { phone, otp } = verifyOtpDto;

    const storedOtp = await this.redis.get(`otp:${phone}`);
    const languageId = await this.redis.get(`languageId:${phone}`);
    if (!storedOtp || storedOtp !== otp) {
      throw new UnauthorizedException('Invalid or expired OTP');
    }

    // OTP is valid, delete it from Redis
    await this.redis.del(`otp:${phone}`);
    let user = await this.prisma.user.findUnique({
      where: { phone },
    });

    if (!user) {
      user = await this.prisma.user.create({
        data: {
          phone,
          role: 'CUSTOMER',
          isPhoneVerified: true,
        },
      });
    }

    let customer = await this.prisma.customer.findUnique({
      where: { userId: user.id },
    });

    if (!customer) {
      customer = await this.prisma.customer.create({
        data: {
          userId: user.id,
          languageId,
        },
      });
    }

    await this.redis.del(`languageId:${phone}`);

    return customer;
  }

  async completeOnboarding(
    customerOnboardingDto: CompleteCustomerOnboardingDto,
  ) {
    const { phone, name, email } = customerOnboardingDto;

    return await this.prisma.user.update({
      where: { phone },
      data: {
        name,
        email,
      },
    });
  }
}
