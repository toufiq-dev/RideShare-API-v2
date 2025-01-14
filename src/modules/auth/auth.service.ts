import { randomInt } from 'node:crypto';
import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from 'src/core/database/prisma.service';
import { RedisService } from 'src/core/cache/redis.service';
import { TwilioUtil } from 'src/core/utils/twilio.util';
import { JwtService } from '@nestjs/jwt';
import {
  SendOtpDto,
  VerifyOtpDto,
  CompleteCustomerOnboardingDto,
  RefreshTokenDto,
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
    const { language, phone } = sendOtpDto;

    const Language = await this.prisma.languages.findUnique({
      where: { name: language },
    });
    if (!Language) {
      throw new NotFoundException('Language not found');
    }

    const otp = randomInt(100000, 999999).toString();

    await this.redis.set(`otp:${phone}`, otp, 300);
    await this.redis.set(`languageId:${phone}`, Language.id, 300);

    await this.twilio.sendOtp(phone, otp);

    return { message: 'OTP sent to your phone successfully', data: { otp } };
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

    return {
      message: 'OTP verified successfully',
      data: {
        accessToken,
        refreshToken,
      },
    };
  }

  async refreshToken(refreshTokenDto: RefreshTokenDto) {
    const { userId, refreshToken } = refreshTokenDto;

    const storedToken = await this.redis.get(`refreshToken:${userId}`);
    if (!storedToken || storedToken !== refreshToken) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    await this.redis.del(`refreshToken:${userId}`);

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const newAccessToken = this.jwtService.sign(
      { userId: user.id, role: user.role },
      { expiresIn: this.accessTokenExpiresIn },
    );
    const newRefreshToken = this.jwtService.sign(
      { userId: user.id },
      { expiresIn: this.refreshTokenExpiresIn },
    );

    await this.redis.set(`refreshToken:${userId}`, newRefreshToken, 604800);

    return {
      data: { accessToken: newAccessToken, refreshToken: newRefreshToken },
    };
  }

  async completeOnboarding(
    userId: string,
    customerOnboardingDto: CompleteCustomerOnboardingDto,
  ) {
    const { name, email } = customerOnboardingDto;

    let user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        name,
        email,
      },
    });

    return {
      message: 'Onboarding completed successfully',
      data: user,
    };
  }
}
