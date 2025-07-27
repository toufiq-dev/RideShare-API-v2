import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from 'src/core/database/prisma.service';
import {
  AppUpdateDto,
  CreateSubscriptionTypeDto,
  CreateSupportStuffDto,
  UpdateSubscriptionTypeDto,
  VerifyEmailDto,
  CreateSupportRoleDto,
  LoginDto,
  CreateAdminDto,
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

  async login(loginDto: LoginDto) {
    const { email, password } = loginDto;

    try {
      const user = await this.prisma.user.findUnique({
        where: { email },
      });
      if (!user) {
        throw new UnauthorizedException('Invalid email or password');
      }

      let roledUser = null;
      if (user.role === UserRole.ADMIN) {
        roledUser = await this.prisma.admin.findUnique({
          where: {
            userId: user.id,
          },
          select: {
            password: true,
          },
        });
      } else if (user.role === UserRole.SUPPORT) {
        roledUser = await this.prisma.support.findUnique({
          where: {
            userId: user.id,
          },
          select: {
            password: true,
          },
        });
      } else if (user.role === UserRole.SUPER_ADMIN) {
        roledUser = await this.prisma.superAdmin.findUnique({
          where: {
            userId: user.id,
          },
          select: {
            password: true,
          },
        });
      }

      const isPasswordValid = roledUser
        ? await bcrypt.compare(password, roledUser.password)
        : null;

      if (!isPasswordValid) {
        throw new UnauthorizedException('Invalid email or password');
      }

      return {
        message: 'Credentials verified successfully. Verify Email to login.',
        data: {
          email: user.email,
        },
      };
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  async getUserInfo(userId: string) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      if (user.role === UserRole.ADMIN) {
        const admin = await this.prisma.admin.findUnique({
          where: { userId },
          select: {
            name: true,
          },
        });

        return {
          message: 'Admin info fetched successfully.',
          data: {
            name: admin.name,
            role: user.role,
          },
        };
      } else if (user.role === UserRole.SUPPORT) {
        const support = await this.prisma.support.findUnique({
          where: { userId },
          select: {
            name: true,
            phone: true,
            referralCode: true,
            supportRole: {
              select: {
                name: true,
                description: true,
                supportPermissions: {
                  select: {
                    menuKey: true,
                    isVisible: true,
                  },
                },
              },
            },
          },
        });

        return {
          message: 'Support info fetched successfully.',
          data: support,
        };
      } else if (user.role === UserRole.SUPER_ADMIN) {
        const superAdmin = await this.prisma.superAdmin.findUnique({
          where: { userId },
          select: {
            name: true,
          },
        });

        return {
          message: 'Super admin info fetched successfully.',
          data: {
            name: superAdmin.name,
            role: user.role,
          },
        };
      }
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

      const admin = await this.prisma.user.findUnique({
        where: { email },
      });

      const accessToken = await this.jwtService.signAsync(
        { userId: admin.id, role: UserRole.ADMIN },
        { expiresIn: this.accessTokenExpiresIn },
      );

      const refreshToken = await this.jwtService.signAsync(
        { userId: admin.id, role: UserRole.ADMIN },
        { expiresIn: this.refreshTokenExpiresIn },
      );

      await this.redis.set(
        `${RedisKeys.ACCESS_TOKEN}${admin.id}`,
        accessToken,
        this.redisAccessTokenTTL,
      );
      await this.redis.set(
        `${RedisKeys.REFRESH_TOKEN}${admin.id}`,
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

  async createAdmin(createAdminDto: CreateAdminDto) {
    const { email, password } = createAdminDto;

    try {
      const existingUser = await this.prisma.user.findUnique({
        where: {
          email,
        },
      });
      if (existingUser) {
        throw new BadRequestException('Admin already exists');
      }

      const user = await this.prisma.user.create({
        data: {
          role: UserRole.ADMIN,
          email,
        },
      });

      const hashedPassword = await bcrypt.hash(password, 10);

      await this.prisma.admin.create({
        data: {
          password: hashedPassword,
          name: 'Admin',
          userId: user.id,
        },
      });

      return {
        message: 'Admin created successfully.',
        data: {
          email: user.email,
        },
      };
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  async getMenuPermissions() {
    try {
      const data = await this.prisma.supportPermission.findMany();

      return {
        message: 'Menu permissions fetched successfully.',
        data,
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
    const { name, supportPermissionIds, description } = createSupportRoleDto;

    try {
      const existingRole = await this.prisma.supportRole.findFirst({
        where: {
          name: {
            equals: name,
            mode: 'insensitive',
          },
        },
      });

      if (existingRole) {
        throw new BadRequestException(`Role ${name} already exists`);
      }

      const data = await this.prisma.supportRole.create({
        data: {
          name,
          description,
          supportPermissions: {
            connect: supportPermissionIds.map((id) => ({ id })),
          },
        },
      });

      return {
        message: 'Support role created successfully.',
        data,
      };
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  async createSupportStuff(createSupportStuffDto: CreateSupportStuffDto) {
    const { name, phone, supportRoleId, email, password } =
      createSupportStuffDto;

    try {
      const user = await this.prisma.user.create({
        data: {
          role: UserRole.SUPPORT,
          email,
        },
      });

      const hashedPassword = await bcrypt.hash(password, 10);

      const data = await this.prisma.support.create({
        data: {
          name,
          phone,
          referralCode: randomInt(10000, 1000000).toString(),
          userId: user.id,
          supportRoleId,
          password: hashedPassword,
        },
      });

      return {
        message: 'Support stuff created successfully.',
        data: {
          email: user.email,
        },
      };
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  async getSupportStuffs() {
    try {
      const data = await this.prisma.support.findMany({
        select: {
          id: true,
          name: true,
          phone: true,
          referralCode: true,
          supportRole: {
            select: {
              name: true,
              supportPermissions: {
                select: {
                  menuKey: true,
                },
              },
            },
          },
        },
      });

      return {
        message: 'Support stuffs fetched successfully.',
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
