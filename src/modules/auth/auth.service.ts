import { randomInt } from 'node:crypto';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from 'src/core/database/prisma.service';
import { RedisService } from 'src/core/cache/redis.service';
import { TwilioUtil } from 'src/core/utils/twilio.util';
import { JwtService } from '@nestjs/jwt';
import {
  SendOtpDto,
  VerifyOtpDto,
  CompleteCustomerOnboardingDto,
} from './dto/onboarding.dto';

@Injectable()
export class AuthService {
  private readonly accessTokenExpiresIn: string;
  private readonly refreshTokenExpiresIn: string;
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly twilio: TwilioUtil,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {
    this.accessTokenExpiresIn = this.configService.get<string>(
      'jwt.accessTokenExpiresIn',
    );
    this.refreshTokenExpiresIn = this.configService.get<string>(
      'jwt.refreshTokenExpiresIn',
    );
  }

  async sendOtp(sendOtpDto: SendOtpDto) {
    const { languageId, phone } = sendOtpDto;

    const otp = randomInt(100000, 999999).toString();

    await this.redis.set(`otp:${phone}`, otp, 300);
    await this.redis.set(`languageId:${phone}`, languageId, 300);

    await this.twilio.sendOtp(phone, otp);

    return 'OTP sent successfully';
  }

  async verifyOtp(verifyOtpDto: VerifyOtpDto) {
    const { phone, otp, role } = verifyOtpDto;

    const storedOtp = await this.redis.get(`otp:${phone}`);
    const languageId = await this.redis.get(`languageId:${phone}`);
    if (!storedOtp || storedOtp !== otp) {
      throw new UnauthorizedException('Invalid or expired OTP');
    }

    await this.redis.del(`otp:${phone}`);

    let user = await this.prisma.user.findUnique({
      where: { phone },
    });
    if (!user) {
      user = await this.prisma.user.create({
        data: {
          phone,
          role,
          isPhoneVerified: true,
        },
      });
    }

    if (role == 'CUSTOMER') {
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
    }

    // Generate Tokens
    const accessToken = this.jwtService.sign(
      { userId: user.id, role },
      { expiresIn: this.accessTokenExpiresIn },
    );
    const refreshToken = this.jwtService.sign(
      { userId: user.id },
      { expiresIn: this.refreshTokenExpiresIn },
    );

    await this.redis.del(`languageId:${phone}`);
    await this.redis.set(`refreshToken:${user.id}`, refreshToken, 604800);

    return { accessToken, refreshToken };
  }

  async refreshToken(userId: string, token: string) {
    const storedToken = await this.redis.get(`refreshToken:${userId}`);
    if (!storedToken || storedToken !== token) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // Generate new tokens
    const newAccessToken = this.jwtService.sign(
      { userId: user.id, role: user.role },
      { expiresIn: '15m' },
    );
    const newRefreshToken = this.jwtService.sign(
      { userId: user.id },
      { expiresIn: '7d' },
    );

    // Update refresh token in Redis
    await this.redis.set(`refreshToken:${userId}`, newRefreshToken, 604800);

    return { accessToken: newAccessToken, refreshToken: newRefreshToken };
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
