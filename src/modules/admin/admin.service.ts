import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from 'src/core/database/prisma.service';
import {
  SuperAdminLoginDto,
  AppUpdateDto,
  CreateSubscriptionTypeDto,
  CreateSupportStuffDto,
  UpdateSubscriptionTypeDto,
  CreateAdminDto,
  AdminLoginDto,
  VerifyEmailDto,
  CreateSupportRoleDto,
} from './dto/admin.dto';
import { randomInt } from 'crypto';
import { AppPlatform, UserRole, VerificationStatus } from '@prisma/client';
import bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { RedisService } from 'src/core/cache/redis.service';
import { RedisKeys } from 'src/core/cache/redis-keys';

@Injectable()
export class AdminService {
  private readonly accessTokenExpiresIn: string;
  private readonly refreshTokenExpiresIn: string;
  private readonly redisAccessTokenTTL: number;
  private readonly redisRefreshTokenTTL: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly redis: RedisService,
  ) {
    this.accessTokenExpiresIn = this.configService.get<string>(
      'jwt.accessTokenExpiresIn',
    );
    this.refreshTokenExpiresIn = this.configService.get<string>(
      'jwt.refreshTokenExpiresIn',
    );
    this.redisAccessTokenTTL = this.configService.get<number>(
      'redis.accessTokenTTL',
    );
    this.redisRefreshTokenTTL = this.configService.get<number>(
      'redis.refreshTokenTTL',
    );
  }

  async updateAppVersion(appUpdateDto: AppUpdateDto) {
    const {
      adCustomerVersion,
      adDriverVersion,
      iosCustomerVersion,
      appDescription,
    } = appUpdateDto;

    try {
      const data = await this.prisma.platform.upsert({
        where: {
          appDescription,
        },
        update: {
          adDriverVersion,
          adCustomerVersion,
          iosCustomerVersion,
          appDescription,
        },
        create: {
          adDriverVersion,
          adCustomerVersion,
          iosCustomerVersion,
          appDescription,
        },
      });

      return {
        message: 'App version updated successfully.',
        data,
      };
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  async getAppVersion(platform: AppPlatform) {
    try {
      const data = await this.prisma.platform.findUnique({
        where: {
          appDescription: platform,
        },
      });

      return {
        message: 'App version fetched successfully.',
        data,
      };
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  async superAdminLogin(superAdminLoginDto: SuperAdminLoginDto) {
    const { email, password } = superAdminLoginDto;

    try {
      const admin = await this.prisma.superAdmin.findUnique({
        where: {
          email,
        },
      });

      if (!admin) {
        throw new UnauthorizedException('Invalid email or password');
      }

      const isPasswordValid = await bcrypt.compare(password, admin.password);

      if (!isPasswordValid) {
        throw new UnauthorizedException('Invalid email or password');
      }

      const accessToken = await this.jwtService.signAsync(
        { userId: admin.userId, role: UserRole.SUPER_ADMIN },
        { expiresIn: this.accessTokenExpiresIn },
      );

      const refreshToken = await this.jwtService.signAsync(
        { userId: admin.userId, role: UserRole.SUPER_ADMIN },
        { expiresIn: this.refreshTokenExpiresIn },
      );

      await this.redis.set(
        `${RedisKeys.ACCESS_TOKEN}${admin.userId}`,
        accessToken,
        this.redisAccessTokenTTL,
      );
      await this.redis.set(
        `${RedisKeys.REFRESH_TOKEN}${admin.userId}`,
        refreshToken,
        this.redisRefreshTokenTTL,
      );

      return {
        message: 'Admin logged in successfully.',
        data: {
          accessToken,
          refreshToken,
        },
      };
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  async createAdmin(createAdminDto: CreateAdminDto) {
    const { email, password } = createAdminDto;

    try {
      const user = await this.prisma.user.create({
        data: {
          role: UserRole.ADMIN,
        },
      });

      const hashedPassword = await bcrypt.hash(password, 10);

      const admin = await this.prisma.admin.create({
        data: {
          email,
          password: hashedPassword,
          name: 'Admin',
          userId: user.id,
        },
      });

      return {
        message: 'Admin created successfully.',
        data: {
          email: admin.email,
        },
      };
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  async adminLogin(adminLoginDto: AdminLoginDto) {
    const { email, password } = adminLoginDto;

    try {
      const admin = await this.prisma.admin.findUnique({
        where: { email },
      });

      if (!admin) {
        throw new UnauthorizedException('Invalid email or password');
      }

      const isPasswordValid = await bcrypt.compare(password, admin.password);

      if (!isPasswordValid) {
        throw new UnauthorizedException('Invalid email or password');
      }

      return {
        message:
          'Admin credentials verified successfully. Verify Email to login.',
        data: {
          email: admin.email,
        },
      };
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  async verifyEmail(verifyEmailDto: VerifyEmailDto) {
    const { email, otp } = verifyEmailDto;

    try {
      const otpFromRedis = await this.redis.get(
        `${RedisKeys.EMAIL_VERIFICATION_OTP}${email}`,
      );

      if (!otpFromRedis || otpFromRedis !== otp) {
        throw new UnauthorizedException('Invalid or Expired OTP');
      }

      await this.redis.del(`${RedisKeys.EMAIL_VERIFICATION_OTP}${email}`);

      const admin = await this.prisma.admin.findUnique({
        where: { email },
      });

      const accessToken = await this.jwtService.signAsync(
        { userId: admin.userId, role: UserRole.ADMIN },
        { expiresIn: this.accessTokenExpiresIn },
      );

      const refreshToken = await this.jwtService.signAsync(
        { userId: admin.userId, role: UserRole.ADMIN },
        { expiresIn: this.refreshTokenExpiresIn },
      );

      await this.redis.set(
        `${RedisKeys.ACCESS_TOKEN}${admin.userId}`,
        accessToken,
        this.redisAccessTokenTTL,
      );
      await this.redis.set(
        `${RedisKeys.REFRESH_TOKEN}${admin.userId}`,
        refreshToken,
        this.redisRefreshTokenTTL,
      );

      return {
        message: 'Admin verified successfully.',
        data: {
          accessToken,
          refreshToken,
        },
      };
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  async getSupportRoles() {
    try {
      const data = await this.prisma.supportRole.findMany();

      return {
        message: 'Support roles fetched successfully.',
        data,
      };
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  async createSupportRole(createSupportRoleDto: CreateSupportRoleDto) {
    const { name } = createSupportRoleDto;

    try {
      const data = await this.prisma.supportRole.create({
        data: {
          name,
        },
      });

      return {
        message: 'User role created successfully.',
        data,
      };
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  async createSubscriptionType(
    createSubscriptionTypeDto: CreateSubscriptionTypeDto,
  ) {
    const { name, coins, price, priceBeforeDiscount } =
      createSubscriptionTypeDto;

    try {
      const data = await this.prisma.subscription.create({
        data: {
          name,
          coins,
          price,
          priceBeforeDiscount,
        },
      });

      return {
        message: 'Subscription type created successfully.',
        data,
      };
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  async getSubscriptionTypes() {
    try {
      const data = await this.prisma.subscription.findMany();

      return {
        message: 'Subscription types fetched successfully.',
        data,
      };
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  async updateSubscriptionType(
    id: string,
    updateSubscriptionTypeDto: UpdateSubscriptionTypeDto,
  ) {
    const { name, coins, price, priceBeforeDiscount } =
      updateSubscriptionTypeDto;

    const data = await this.prisma.subscription.update({
      where: {
        id,
      },
      data: {
        name,
        coins,
        price,
        priceBeforeDiscount,
      },
    });

    return {
      message: 'Subscription type updated successfully.',
      data,
    };
  }

  async createSupportStuff(createSupportStuffDto: CreateSupportStuffDto) {
    const { name, phone, permissions } = createSupportStuffDto;

    try {
      const user = await this.prisma.user.create({
        data: {
          role: UserRole.SUPPORT,
        },
      });

      const data = await this.prisma.support.create({
        data: {
          name,
          phone,
          referralCode: randomInt(10000, 1000000).toString(),
          userId: user.id,
          permissions: permissions
            ? {
                createMany: {
                  data: permissions.map((perm) => ({
                    menuKey: perm.menuKey,
                    isVisible: perm.isVisible ?? true,
                  })),
                },
              }
            : undefined,
        },
        include: {
          permissions: true,
        },
      });

      return {
        message: 'Support stuff created successfully.',
        data,
      };
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  async getSupportStuffs() {
    try {
      const data = await this.prisma.support.findMany();

      return {
        message: 'Support stuffs fetched successfully.',
        data,
      };
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  async getDrivingLicense() {
    try {
      const data = await this.prisma.pilot.findMany({
        where: {
          isDLVerified: {
            not: VerificationStatus.APPROVED,
          },
        },
        select: {
          dlFrontSideUrl: true,
          dlBackSideUrl: true,
        },
        orderBy: {
          isDLVerified: 'asc',
        },
      });

      return {
        message: 'Driving license document fetched successfully',
        data,
      };
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  async getNumberPlates() {
    try {
      const data = await this.prisma.pilot.findMany({
        where: {
          isNumberPlateVerified: {
            not: VerificationStatus.APPROVED,
          },
        },
        select: {
          numberPlateUrl: true,
        },
        orderBy: {
          isDLVerified: 'asc',
        },
      });

      return {
        message: 'Driving license document fetched successfully',
        data,
      };
    } catch (error) {
      console.error(error);
      throw error;
    }
  }
}
