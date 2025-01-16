import { randomInt } from 'node:crypto';
import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from 'src/core/database/prisma.service';
import { RedisService } from 'src/core/cache/redis.service';
import { Msg91Util } from 'src/core/utils/msg91.util';
import { JwtService } from '@nestjs/jwt';
import {
  SendOtpDto,
  VerifyOtpDto,
  CompleteCustomerOnboardingDto,
  RefreshTokenDto,
} from './dto/auth.dto';

@Injectable()
export class AuthService {
  private readonly accessTokenExpiresIn: string;
  private readonly refreshTokenExpiresIn: string;
  private readonly jwtSecret: string;
  private readonly redisRefreshTokenTTL: number;
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly msg91: Msg91Util,
  ) {
    this.accessTokenExpiresIn = this.configService.get<string>(
      'jwt.accessTokenExpiresIn',
    );
    this.refreshTokenExpiresIn = this.configService.get<string>(
      'jwt.refreshTokenExpiresIn',
    );
    this.jwtSecret = this.configService.get<string>('jwt.secret');
    this.redisRefreshTokenTTL = this.configService.get<number>(
      'redis.refreshTokenTTL',
    );
  }

  async sendOtp(sendOtpDto: SendOtpDto) {
    const { language, phone, referralCode } = sendOtpDto;

    const Language = await this.prisma.languages.findUnique({
      where: { name: language },
    });
    if (!Language) {
      throw new NotFoundException('Language not found');
    }

    const otp = randomInt(100000, 999999).toString();

    await this.redis.set(`otp:${phone}`, otp, 300);
    await this.redis.set(`languageId:${phone}`, Language.id, 300);

    await this.msg91.sendOtp(phone);

    return { message: 'OTP sent to your phone successfully', data: { otp } };
  }

  async verifyOtp(verifyOtpDto: VerifyOtpDto) {
    const { phone, otp, role } = verifyOtpDto;

    const languageId = await this.validateOtp(phone, otp);

    const { user, isNewUser } = await this.findOrCreateUser(phone, role);

    await this.handleProfileCreation(user.id, role, languageId);

    const tokens = await this.generateTokens(user);

    return {
      message: 'OTP verified successfully',
      data: {
        ...tokens,
        isAlreadyRegistered: !isNewUser,
      },
    };
  }

  async refreshToken(refreshTokenDto: RefreshTokenDto) {
    const { refreshToken } = refreshTokenDto;

    const { userId, version } = this.decodeRefreshToken(refreshToken);

    await this.validateStoredRefreshToken(userId, refreshToken);

    const user = await this.validateUserTokenVersion(userId, version);

    const updatedUser = await this.incrementUserTokenVersion(
      userId,
      user.authTokenVersion,
    );

    const tokens = await this.generateTokens(updatedUser);

    return { data: tokens };
  }

  async completeOnboarding(
    userId: string,
    customerOnboardingDto: CompleteCustomerOnboardingDto,
  ) {
    const { name, email } = customerOnboardingDto;

    const user = await this.findUserById(userId);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: {
        name,
        email,
      },
    });

    return {
      message: 'Onboarding completed successfully',
      data: updatedUser,
    };
  }

  private async findUserById(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  private async validateOtp(phone: string, otp: string) {
    const storedOtp = await this.redis.get(`otp:${phone}`);
    if (!storedOtp || storedOtp !== otp) {
      throw new UnauthorizedException('Invalid or expired OTP');
    }

    const languageId = await this.redis.get(`languageId:${phone}`);

    // const isVerified = await this.msg91.verifyOtp(phone, otp);
    // if (!isVerified) {
    //   throw new UnauthorizedException('Invalid or expired OTP');
    // }

    await this.redis.del(`otp:${phone}`);
    await this.redis.del(`languageId:${phone}`);

    return languageId;
  }

  private async findOrCreateUser(phone: string, role) {
    let user = await this.prisma.user.findUnique({ where: { phone } });
    const isNewUser = !user;

    if (isNewUser) {
      user = await this.prisma.user.create({
        data: {
          phone,
          role,
          isPhoneVerified: true,
          authTokenVersion: 1,
        },
      });
    }

    return { user, isNewUser };
  }

  private async handleProfileCreation(
    userId: string,
    role: string,
    languageId: string,
  ): Promise<void> {
    if (role === 'CUSTOMER') {
      const customer = await this.prisma.customer.findUnique({
        where: { userId },
      });
      if (!customer) {
        await this.prisma.customer.create({
          data: {
            userId,
            languageId,
          },
        });
      }
    } else if (role === 'PILOT') {
      const pilot = await this.prisma.pilot.findUnique({
        where: { userId },
      });
      if (!pilot) {
        await this.prisma.pilot.create({
          data: {
            userId,
            languageId,
          },
        });
      }
    }
  }

  private async generateTokens(user) {
    const accessToken = this.jwtService.sign(
      { userId: user.id, role: user.role, version: user.authTokenVersion },
      { expiresIn: this.accessTokenExpiresIn },
    );

    const refreshToken = this.jwtService.sign(
      { userId: user.id, version: user.authTokenVersion },
      { expiresIn: this.refreshTokenExpiresIn },
    );

    await this.redis.set(
      `refreshToken:${user.id}`,
      refreshToken,
      this.redisRefreshTokenTTL,
    );

    return { accessToken, refreshToken };
  }

  private decodeRefreshToken(refreshToken: string) {
    try {
      return this.jwtService.verify(refreshToken, { secret: this.jwtSecret });
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
  }

  private async validateStoredRefreshToken(
    userId: string,
    refreshToken: string,
  ): Promise<void> {
    if (!userId || !refreshToken) {
      throw new UnauthorizedException('Invalid refresh token payload');
    }

    const storedToken = await this.redis.get(`refreshToken:${userId}`);

    if (!storedToken || storedToken !== refreshToken) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    await this.redis.del(`refreshToken:${userId}`);
  }

  private async validateUserTokenVersion(userId: string, version: number) {
    const user = await this.findUserById(userId);

    if (!user || user.authTokenVersion !== version) {
      throw new UnauthorizedException('Token has been invalidated');
    }
    return user;
  }

  private async incrementUserTokenVersion(
    userId: string,
    currentVersion: number,
  ) {
    const newVersion = currentVersion + 1;
    return await this.prisma.user.update({
      where: { id: userId },
      data: { authTokenVersion: newVersion },
    });
  }
}
