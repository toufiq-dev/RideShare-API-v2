import {
  BadRequestException,
  Injectable,
  NotFoundException,
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
  VerifyDriverDto,
  PromoterDetailsDto,
  DocumentType,
  ResetPasswordDto,
  SendResetPasswordOtpDto,
  EditMenuPermissionsDto,
  EditStaffDto,
  EditSupportRoleDto,
} from './dto/admin.dto';
import { randomInt } from 'crypto';
import {
  AppPlatform,
  UserRole,
  UserStatus,
  VerificationStatus,
} from '@prisma/client';
import bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { RedisService } from 'src/core/cache/redis.service';
import { RedisKeys } from 'src/core/cache/redis-keys';
import { AzureService } from 'src/core/utils/azure.util';
import { EmailService } from '../email/email.service';
import { SendOtpDto } from '../email/dto/email.dto';

@Injectable()
export class AdminService {
  private readonly accessTokenExpiresIn: string;
  private readonly refreshTokenExpiresIn: string;
  private readonly redisAccessTokenTTL: number;
  private readonly redisRefreshTokenTTL: number;

  private readonly verificationFieldMap = {
    [DocumentType.SELFIE]: 'isSelfieVerified',
    [DocumentType.NID]: 'isNidVerified',
    [DocumentType.DRIVING_LICENSE]: 'isDLVerified',
    [DocumentType.REGISTRATION_CERTIFICATE]: 'isRCVerified',
    [DocumentType.NUMBER_PLATE]: 'isNumberPlateVerified',
    [DocumentType.TAX_TOKEN]: 'isTaxTokenVerified',
    [DocumentType.VEHICLE_OWNERS_NID]: 'isVehicleOwnersNidVerified',
  } as const;

  private readonly rejectionReasonFieldMap = {
    [DocumentType.SELFIE]: 'selfieRejectionReason',
    [DocumentType.NID]: 'nidRejectionReason',
    [DocumentType.DRIVING_LICENSE]: 'dlRejectionReason',
    [DocumentType.REGISTRATION_CERTIFICATE]: 'rcRejectionReason',
    [DocumentType.NUMBER_PLATE]: 'numberPlateRejectionReason',
    [DocumentType.TAX_TOKEN]: 'taxTokenRejectionReason',
    [DocumentType.VEHICLE_OWNERS_NID]: 'vehicleOwnersNidRejectionReason',
  } as const;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly redis: RedisService,
    private readonly azureService: AzureService,
    private readonly emailService: EmailService,
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

  async sendResetPasswordOtp(sendResetPasswordOtpDto: SendResetPasswordOtpDto) {
    const { email } = sendResetPasswordOtpDto;

    try {
      const user = await this.prisma.user.findUnique({
        where: { email },
        select: { id: true, role: true },
      });

      if (!user) {
        throw new UnauthorizedException('Invalid email');
      }

      const emailOtpDto: SendOtpDto = { email };

      await this.emailService.sendOtpEmail(emailOtpDto);

      return {
        message: 'Reset password OTP sent to your email successfully.',
      };
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  async resetPassword(resetPasswordDto: ResetPasswordDto) {
    const { otp, newPassword, email } = resetPasswordDto;

    try {
      const otpFromRedis = await this.redis.get(
        `${RedisKeys.EMAIL_VERIFICATION_OTP}${email}`,
      );

      if (!otpFromRedis || otpFromRedis !== otp) {
        throw new UnauthorizedException('Invalid or Expired OTP');
      }

      const user = await this.prisma.user.findUnique({
        where: { email },
      });

      const hashedPassword = await bcrypt.hash(newPassword, 10);

      if (user.role === UserRole.ADMIN) {
        await this.prisma.admin.update({
          where: { userId: user.id },
          data: { password: hashedPassword },
        });
      } else if (user.role === UserRole.SUPPORT) {
        await this.prisma.support.update({
          where: { userId: user.id },
          data: { password: hashedPassword },
        });
      } else if (user.role === UserRole.SUPER_ADMIN) {
        await this.prisma.superAdmin.update({
          where: { userId: user.id },
          data: { password: hashedPassword },
        });
      }

      const accessToken = await this.jwtService.signAsync(
        { userId: user.id, role: user.role },
        { expiresIn: this.accessTokenExpiresIn },
      );

      const refreshToken = await this.jwtService.signAsync(
        { userId: user.id, role: user.role },
        { expiresIn: this.refreshTokenExpiresIn },
      );

      await this.redis.set(
        `${RedisKeys.ACCESS_TOKEN}${user.id}`,
        accessToken,
        this.redisAccessTokenTTL,
      );
      await this.redis.set(
        `${RedisKeys.REFRESH_TOKEN}${user.id}`,
        refreshToken,
        this.redisRefreshTokenTTL,
      );

      return {
        message: 'Password reset successfully.',
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

  async verifyEmail(verifyEmailDto: VerifyEmailDto) {
    const { email, otp } = verifyEmailDto;

    try {
      const otpFromRedis = await this.redis.get(
        `${RedisKeys.EMAIL_VERIFICATION_OTP}${email}`,
      );

      if (!otpFromRedis || otpFromRedis !== otp) {
        throw new UnauthorizedException('Invalid or Expired OTP');
      }

      const admin = await this.prisma.user.findUnique({
        where: { email },
        select: { id: true, role: true },
      });

      const accessToken = await this.jwtService.signAsync(
        { userId: admin.id, role: admin.role },
        { expiresIn: this.accessTokenExpiresIn },
      );

      const refreshToken = await this.jwtService.signAsync(
        { userId: admin.id, role: admin.role },
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

  async getStaffList() {
    try {
      const adminList = await this.prisma.admin.findMany({
        where: {
          user: {
            status: UserStatus.ACTIVE,
          },
        },
        select: {
          id: true,
          name: true,
          user: {
            select: {
              email: true,
              status: true,
              role: true,
            },
          },
        },
      });

      const supportList = await this.prisma.support.findMany({
        where: {
          user: {
            status: UserStatus.ACTIVE,
          },
        },
        select: {
          id: true,
          name: true,
          user: {
            select: {
              email: true,
              status: true,
              role: true,
            },
          },
          supportRole: {
            select: {
              id: true,
              name: true,
              description: true,
              supportPermissions: {
                select: {
                  id: true,
                  menuKey: true,
                  isVisible: true,
                },
              },
            },
          },
        },
      });

      return {
        message: 'Staff list fetched successfully.',
        data: {
          adminList,
          supportList,
        },
      };
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  async deleteStaff(id: string) {
    try {
      const support = await this.prisma.support.findUnique({
        where: {
          id,
        },
      });

      if (!support) {
        throw new NotFoundException('Staff not found');
      }

      await this.prisma.user.update({
        where: { id: support.userId },
        data: {
          status: UserStatus.INACTIVE,
        },
      });

      return {
        message: 'Staff deleted successfully.',
      };
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  async editStaff(id: string, editStaffDto: EditStaffDto) {
    const { supportRoleId } = editStaffDto;

    try {
      const staff = await this.prisma.support.findUnique({
        where: { id },
      });

      if (!staff) {
        throw new NotFoundException('Staff not found');
      }

      if (supportRoleId) {
        const roleExists = await this.prisma.supportRole.findUnique({
          where: { id: supportRoleId },
        });

        if (!roleExists) {
          throw new BadRequestException('Invalid support role');
        }

        // Update staff's role assignment
        await this.prisma.support.update({
          where: { id },
          data: {
            supportRoleId,
          },
        });
      }

      const updatedSupport = await this.prisma.support.findUnique({
        where: { id },
        include: {
          user: {
            select: {
              email: true,
              status: true,
              role: true,
            },
          },
          supportRole: {
            select: {
              name: true,
              description: true,
              supportPermissions: {
                select: {
                  id: true,
                  menuKey: true,
                  isVisible: true,
                },
              },
            },
          },
        },
      });

      return {
        message: 'Staff role updated successfully.',
        data: updatedSupport,
      };
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  async getMenuPermissions(page: number, pageSize: number) {
    try {
      const skip = (page - 1) * pageSize;
      const totalCount = await this.prisma.supportPermission.count();
      const totalPages = Math.ceil(totalCount / pageSize);
      const hasNextPage = page < totalPages;
      const hasPrevPage = page > 1;
      const data = await this.prisma.supportPermission.findMany({
        skip,
        take: pageSize,
      });

      return {
        message: 'Menu permissions fetched successfully.',
        data: {
          menuPermissions: data,
          pagination: {
            totalItems: totalCount,
            totalPages,
            currentPage: page,
            pageSize,
            hasNextPage,
            hasPrevPage,
          },
        },
      };
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  async editMenuPermissions(
    id: string,
    editMenuPermissionsDto: EditMenuPermissionsDto,
  ) {
    const { menuKey } = editMenuPermissionsDto;

    try {
      const menuPermission = await this.prisma.supportPermission.findUnique({
        where: { id },
      });

      if (!menuPermission) {
        throw new NotFoundException('Menu permission not found');
      }

      const data = await this.prisma.supportPermission.update({
        where: { id },
        data: {
          menuKey,
        },
      });

      return {
        message: 'Menu permission updated successfully.',
        data,
      };
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  async deleteMenuPermissions(id: string) {
    try {
      const menuPermission = await this.prisma.supportPermission.findUnique({
        where: { id },
      });

      if (!menuPermission) {
        throw new NotFoundException('Menu permission not found');
      }

      await this.prisma.supportPermission.delete({
        where: { id },
      });

      return {
        message: 'Menu permission deleted successfully.',
      };
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  async getSupportRoles(page: number, pageSize: number, search?: string) {
    try {
      const skip = (page - 1) * pageSize;

      const whereClause: any = {};

      if (search) {
        whereClause.OR = [
          {
            name: {
              contains: search,
              mode: 'insensitive',
            },
          },
          {
            description: {
              contains: search,
              mode: 'insensitive',
            },
          },
        ];
      }

      const totalCount = await this.prisma.supportRole.count({
        where: whereClause,
      });
      const totalPages = Math.ceil(totalCount / pageSize);
      const hasNextPage = page < totalPages;
      const hasPrevPage = page > 1;

      const data = await this.prisma.supportRole.findMany({
        where: whereClause,
        include: {
          supportPermissions: true,
        },

        skip,
        take: pageSize,
      });

      return {
        message: 'Support roles fetched successfully.',
        data: {
          supportRoles: data,
          pagination: {
            totalItems: totalCount,
            totalPages,
            currentPage: page,
            pageSize,
            hasNextPage,
            hasPrevPage,
          },
        },
      };
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  async editSupportRole(id: string, editSupportRoleDto: EditSupportRoleDto) {
    const { name, description, supportPermissionIds } = editSupportRoleDto;

    try {
      // Check if role exists
      const existingRole = await this.prisma.supportRole.findUnique({
        where: { id },
      });

      if (!existingRole) {
        throw new NotFoundException('Support role not found');
      }

      // If name is being updated, check for duplicates
      if (name && name !== existingRole.name) {
        const duplicateRole = await this.prisma.supportRole.findFirst({
          where: {
            name: {
              equals: name,
              mode: 'insensitive',
            },
            id: { not: id }, // Exclude current role
          },
        });

        if (duplicateRole) {
          throw new BadRequestException(`Role ${name} already exists`);
        }
      }

      // Validate permissions if provided
      if (supportPermissionIds && supportPermissionIds.length > 0) {
        const validPermissions = await this.prisma.supportPermission.findMany({
          where: {
            id: { in: supportPermissionIds },
          },
        });

        if (validPermissions.length !== supportPermissionIds.length) {
          throw new BadRequestException('Some permission IDs are invalid');
        }
      }

      // Update the role
      const data = await this.prisma.supportRole.update({
        where: { id },
        data: {
          ...(name && { name }),
          ...(description && { description }),
          ...(supportPermissionIds && {
            supportPermissions: {
              set: supportPermissionIds.map((permissionId) => ({
                id: permissionId,
              })),
            },
          }),
        },
        include: {
          supportPermissions: {
            select: {
              id: true,
              menuKey: true,
              isVisible: true,
            },
          },
        },
      });

      return {
        message: 'Support role updated successfully.',
        data,
      };
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  async deleteSupportRole(id: string) {
    try {
      // Check if role exists
      const existingRole = await this.prisma.supportRole.findUnique({
        where: { id },
        include: {
          support: true, // Check if any support staff are using this role
        },
      });

      if (!existingRole) {
        throw new NotFoundException('Support role not found');
      }

      // Check if role is being used by any support staff
      if (existingRole.support && existingRole.support.length > 0) {
        throw new BadRequestException(
          `Cannot delete role. ${existingRole.support.length} support staff are currently assigned to this role.`,
        );
      }

      // Delete the role
      await this.prisma.supportRole.delete({
        where: { id },
      });

      return {
        message: 'Support role deleted successfully.',
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

  async getSupportStuffs(page: number, pageSize: number) {
    try {
      const skip = (page - 1) * pageSize;

      const totalCount = await this.prisma.support.count();

      const supportStuffs = await this.prisma.support.findMany({
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
        skip,
        take: pageSize,
      });

      const totalPages = Math.ceil(totalCount / pageSize);
      const hasNextPage = page < totalPages;
      const hasPrevPage = page > 1;

      return {
        message: 'Support stuffs fetched successfully.',
        data: {
          supportStuffs,
          pagination: {
            totalItems: totalCount,
            totalPages,
            currentPage: page,
            pageSize,
            hasNextPage,
            hasPrevPage,
          },
        },
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

  async getDriverList(
    page: number,
    pageSize: number,
    search?: string,
    status?: UserStatus,
    sortBy?: string,
    sortOrder?: 'asc' | 'desc',
  ) {
    try {
      const skip = (page - 1) * pageSize;

      const whereClause: any = {};

      if (status) {
        whereClause.user = {
          status: status,
        };
      }

      if (search) {
        whereClause.OR = [
          { phone: { contains: search.trim(), mode: 'insensitive' } },
          {
            drivingLicense: {
              nameOnLicense: { contains: search.trim(), mode: 'insensitive' },
            },
          },
        ];
      }

      const orderByClause: any = {};
      if (sortBy && sortOrder) {
        orderByClause[sortBy] = sortOrder;
      } else {
        orderByClause.createdAt = 'desc';
      }

      const totalCount = await this.prisma.pilot.count({
        where: whereClause,
      });
      const activeCount = await this.prisma.pilot.count({
        where: {
          ...whereClause,
          user: {
            status: UserStatus.ACTIVE,
          },
        },
      });
      const pendingCount = await this.prisma.pilot.count({
        where: {
          ...whereClause,
          user: {
            status: UserStatus.IN_REVIEW,
          },
        },
      });
      const suspendedCount = await this.prisma.pilot.count({
        where: {
          ...whereClause,
          user: {
            status: UserStatus.SUSPENDED,
          },
        },
      });

      const pilots = await this.prisma.pilot.findMany({
        where: whereClause,
        orderBy: orderByClause,
        select: {
          id: true,
          phone: true,
          createdAt: true,
          drivingLicense: {
            select: {
              nameOnLicense: true,
            },
          },
          user: {
            select: {
              country: true,
              status: true,
            },
          },
          wallet: {
            select: {
              balance: true,
            },
          },
        },
        skip,
        take: pageSize,
      });

      const pilotsWithEarnings = await Promise.all(
        pilots.map(async (pilot) => {
          const earningsData = await this.prisma.pilotTrips.aggregate({
            where: {
              pilotId: pilot.id,
            },
            _sum: {
              amount: true,
            },
            _count: {
              id: true,
            },
          });

          return {
            ...pilot,
            totalEarnings: Number(earningsData._sum.amount || 0),
            totalTrips: earningsData._count.id,
          };
        }),
      );

      // Calculate pagination metadata
      const totalPages = Math.ceil(totalCount / pageSize);
      const hasNextPage = page < totalPages;
      const hasPrevPage = page > 1;

      return {
        message: 'Driver list fetched successfully.',
        data: {
          pilots: pilotsWithEarnings,
          totalPilots: totalCount,
          activePilots: activeCount,
          pendingPilots: pendingCount,
          suspendedPilots: suspendedCount,
          pagination: {
            totalItems: totalCount,
            totalPages,
            currentPage: page,
            pageSize,
            hasNextPage,
            hasPrevPage,
          },
        },
      };
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  async getDriverDetails(id: string) {
    try {
      const pilot = await this.prisma.pilot.findUnique({
        where: { id },
      });

      if (!pilot) {
        throw new NotFoundException('Driver not found');
      }

      const data = await this.prisma.pilot.findUnique({
        where: { id },
        select: {
          id: true,
          phone: true,
          isDLVerified: true,
          isRCVerified: true,
          isNidVerified: true,
          isSelfieVerified: true,
          isVehicleOwnersNidVerified: true,
          isNumberPlateVerified: true,
          isTaxTokenVerified: true,
          isPanCardVerified: true,
          isAadhaarVerified: true,
          isFairCoinAvailed: true,
          drivingLicense: {
            select: {
              nameOnLicense: true,
              dateOfBirth: true,
            },
          },
          wallet: {
            select: {
              balance: true,
              subscription: {
                select: {
                  name: true,
                },
              },
            },
          },
          vehicle: {
            select: {
              regNo: true,
              model: true,
              vehicleTypeBD: {
                select: {
                  name: true,
                  passengerCapacity: true,
                },
              },
            },
          },
        },
      });

      return {
        message: 'Driver details fetched successfully.',
        data,
      };
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  async getDriverVerification(
    page: number,
    pageSize: number,
    search?: string,
    sortBy?: string,
    sortOrder?: 'asc' | 'desc',
  ) {
    try {
      const skip = (page - 1) * pageSize;

      const whereClause: any = {};

      if (search) {
        whereClause.OR = [
          { phone: { contains: search.trim(), mode: 'insensitive' } },
          {
            drivingLicense: {
              nameOnLicense: { contains: search.trim(), mode: 'insensitive' },
            },
          },
        ];
      }

      const orderByClause: any = {};
      if (sortBy && sortOrder) {
        orderByClause[sortBy] = sortOrder;
      } else {
        orderByClause.createdAt = 'desc';
      }

      const totalCount = await this.prisma.pilot.count({
        where: whereClause,
      });

      const pilots = await this.prisma.pilot.findMany({
        where: whereClause,
        select: {
          id: true,
          phone: true,
          isDLVerified: true,
          isRCVerified: true,
          isNidVerified: true,
          isSelfieVerified: true,
          isVehicleOwnersNidVerified: true,
          isNumberPlateVerified: true,
          isTaxTokenVerified: true,
          drivingLicense: {
            select: {
              nameOnLicense: true,
            },
          },
          createdAt: true,
        },
        orderBy: orderByClause,
        skip,
        take: pageSize,
      });

      // Calculate pagination metadata
      const totalPages = Math.ceil(totalCount / pageSize);
      const hasNextPage = page < totalPages;
      const hasPrevPage = page > 1;

      return {
        message: 'Driver verification fetched successfully.',
        data: {
          pilots,
          pagination: {
            totalItems: totalCount,
            totalPages,
            currentPage: page,
            pageSize,
            hasNextPage,
            hasPrevPage,
          },
        },
      };
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  async getDriverDocument(driverId: string, documentType: DocumentType) {
    try {
      const data = await this.prisma.pilot.findUnique({
        where: { id: driverId },
        include: {
          drivingLicense: {
            select: {
              dateOfBirth: true,
              licenseNumber: true,
              validUntill: true,
            },
          },
          nid: {
            select: {
              name: true,
              dateOfBirth: true,
              nidNumber: true,
            },
          },
          vehicle: {
            select: {
              regNo: true,
              registrationDate: true,
              colour: true,
              model: true,
              seatCapacity: true,
              vehicleTypeBD: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
      });

      if (!data) {
        throw new NotFoundException('Driver not found');
      }

      if (documentType === DocumentType.NID) {
        return {
          message: 'NID document fetched successfully.',
          data: {
            id: data.id,
            nidVerified: data.isNidVerified,
            nidFrontSideUrl: data.nidFrontSideUrl,
            nidBackSideUrl: data.nidBackSideUrl,
            name: data.nid.name,
            dateOfBirth: data.nid.dateOfBirth,
            nidNumber: data.nid.nidNumber,
          },
        };
      } else if (documentType === DocumentType.DRIVING_LICENSE) {
        return {
          message: 'Driving license document fetched successfully.',
          data: {
            id: data.id,
            dlVerified: data.isDLVerified,
            dlFrontSideUrl: data.dlFrontSideUrl,
            dlBackSideUrl: data.dlBackSideUrl,
            dateOfBirth: data.drivingLicense.dateOfBirth,
            licenseNumber: data.drivingLicense.licenseNumber,
            validUntill: data.drivingLicense.validUntill,
          },
        };
      } else if (documentType === DocumentType.SELFIE) {
        return {
          message: 'Selfie document fetched successfully.',
          data: {
            id: data.id,
            selfieVerified: data.isSelfieVerified,
            selfieUrl: data.selfieUrl,
          },
        };
      } else if (documentType === DocumentType.VEHICLE_OWNERS_NID) {
        return {
          message: 'Vehicle owners NID document fetched successfully.',
          data: {
            id: data.id,
            vehicleOwnersNidVerified: data.isVehicleOwnersNidVerified,
            vehicleOwnersNidFrontSideUrl: data.vehicleOwnersNidFrontSideUrl,
            vehicleOwnersNidBackSideUrl: data.vehicleOwnersNidBackSideUrl,
          },
        };
      } else if (documentType === DocumentType.REGISTRATION_CERTIFICATE) {
        return {
          message: 'Registration certificate document fetched successfully.',
          data: {
            id: data.id,
            rcVerified: data.isRCVerified,
            rcFrontSideUrl: data.rcFrontSideUrl,
            rcBackSideUrl: data.rcBackSideUrl,
            vehicleNumber: data.vehicle.regNo,
            vehicleType: data.vehicle.vehicleTypeBD.name,
            registrationDate: data.vehicle.registrationDate,
            vehicleColour: data.vehicle.colour,
            seatCapacity: data.vehicle.seatCapacity,
          },
        };
      } else if (documentType === DocumentType.NUMBER_PLATE) {
        return {
          message: 'Number plate document fetched successfully.',
          data: {
            id: data.id,
            numberPlateVerified: data.isNumberPlateVerified,
            numberPlateUrl: data.numberPlateUrl,
          },
        };
      } else if (documentType === DocumentType.TAX_TOKEN) {
        return {
          message: 'Tax token document fetched successfully.',
          data: {
            id: data.id,
            taxTokenVerified: data.isTaxTokenVerified,
            taxTokenUrl: data.taxTokenUrl,
          },
        };
      }
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  async verifyDriver(
    driverId: string,
    documentType: DocumentType,
    verifyDriverDto: VerifyDriverDto,
  ) {
    const {
      verificationStatus,
      rejectionReason,
      name,
      dateOfBirth,
      documentNumber,
      vehicleRegNo,
      vehicleType,
      vehicleColor,
      vehicleModel,
      seatCapacity,
      expiryDate,
      issueDate,
    } = verifyDriverDto;

    try {
      const pilot = await this.prisma.pilot.findUnique({
        where: { id: driverId },
        include: {
          drivingLicense: true,
          nid: true,
          vehicle: {
            include: {
              vehicleTypeBD: true,
            },
          },
        },
      });

      if (!pilot) {
        throw new NotFoundException('Driver not found');
      }

      const result = await this.prisma.$transaction(async (prisma) => {
        // Prepare pilot update data
        const pilotUpdateData: any = {
          [this.verificationFieldMap[documentType]]: verificationStatus,
        };

        // Add rejection reason if status is REJECTED, clear it otherwise
        if (verificationStatus === VerificationStatus.REJECTED) {
          pilotUpdateData[this.rejectionReasonFieldMap[documentType]] =
            rejectionReason;
        } else {
          pilotUpdateData[this.rejectionReasonFieldMap[documentType]] = null;
        }

        // Update pilot verification status
        const updatedPilot = await prisma.pilot.update({
          where: { id: driverId },
          data: pilotUpdateData,
          include: {
            drivingLicense: true,
            nid: true,
            vehicle: {
              include: {
                vehicleTypeBD: true,
              },
            },
          },
        });

        // Update related fields based on document type
        await this.updateRelatedFields(prisma, driverId, documentType, {
          name,
          dateOfBirth,
          documentNumber,
          vehicleRegNo,
          vehicleType,
          vehicleColor,
          vehicleModel,
          seatCapacity,
          expiryDate,
          issueDate,
        });

        return updatedPilot;
      });

      return {
        message: 'Driver verification updated successfully.',
        data: result,
      };
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  async getNid() {
    try {
      const data = await this.prisma.pilot.findMany({
        where: {
          isNidVerified: {
            not: VerificationStatus.APPROVED,
          },
        },
        select: {
          nidFrontSideUrl: true,
          nidBackSideUrl: true,
        },
        orderBy: {
          isNidVerified: 'asc',
        },
      });

      return {
        message: 'NID document fetched successfully',
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
          isNumberPlateVerified: 'asc',
        },
      });

      return {
        message: 'Number plate document fetched successfully',
        data,
      };
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  async uploadDocuments(
    files: {
      livePhoto?: Express.Multer.File[];
      idPhoto?: Express.Multer.File[];
      nidPhoto?: Express.Multer.File[];
    },
    promoterData: PromoterDetailsDto,
    userId: string,
  ) {
    try {
      const promoter = await this.prisma.promoter.findUnique({
        where: { userId },
      });

      if (!promoter) {
        throw new NotFoundException('Promoter not found');
      }

      const updateData: any = promoterData;

      if (files?.livePhoto?.[0]) {
        const livePhotoUrl = await this.azureService.uploadFile(
          files.livePhoto[0].buffer,
          files.livePhoto[0].originalname,
          userId,
          files.livePhoto[0].mimetype,
        );
        updateData.livePhotoUrl = livePhotoUrl;
      }

      if (files?.idPhoto?.[0]) {
        const idPhotoUrl = await this.azureService.uploadFile(
          files.idPhoto[0].buffer,
          files.idPhoto[0].originalname,
          userId,
          files.idPhoto[0].mimetype,
        );
        updateData.idPhotoUrl = idPhotoUrl;
      }

      if (files?.nidPhoto?.[0]) {
        const nidPhotoUrl = await this.azureService.uploadFile(
          files.nidPhoto[0].buffer,
          files.nidPhoto[0].originalname,
          userId,
          files.nidPhoto[0].mimetype,
        );
        updateData.nidPhotoUrl = nidPhotoUrl;
      }

      updateData.isApproved = true;
      const updatedPromoter = await this.prisma.promoter.update({
        where: { userId },
        data: updateData,
      });

      return {
        message: 'Documents uploaded successfully',
        data: updatedPromoter,
      };
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  async getPromoterProfile(userId: string) {
    const promoter = await this.prisma.promoter.findUnique({
      where: { userId },
      select: {
        id: true,
        name: true,
        phone: true,
        livePhotoUrl: true,
        idPhotoUrl: true,
        nidPhotoUrl: true,
        isAlreadyRegistered: true,
        isApproved: true,
        totalDriversOnboarded: true,
        onboardedPilots: {
          select: {
            id: true,
            phone: true,
            user: {
              select: {
                status: true,
              },
            },
            drivingLicense: {
              select: {
                nameOnLicense: true,
              },
            },
          },
        },
      },
    });

    promoter.onboardedPilots.forEach((pilot) => {
      pilot.phone = this.maskPhoneNumber(pilot.phone);
    });

    if (!promoter) {
      throw new NotFoundException('Promoter not found');
    }

    return {
      message: 'Promoter profile fetched successfully',
      data: promoter,
    };
  }

  async getPromoterList(page: number, pageSize: number, search: string) {
    try {
      const skip = (page - 1) * pageSize;

      const whereClause: any = {};
      if (search && search.trim()) {
        whereClause.OR = [
          {
            name: {
              contains: search.trim(),
              mode: 'insensitive',
            },
          },
          {
            phone: {
              contains: search.trim(),
              mode: 'insensitive',
            },
          },
        ];
      }

      const totalCount = await this.prisma.promoter.count({
        where: whereClause,
      });

      const promoters = await this.prisma.promoter.findMany({
        where: whereClause,
        select: {
          id: true,
          name: true,
          phone: true,
          totalDriversOnboarded: true,
          onboardedPilots: {
            select: {
              id: true,
              phone: true,
              isSelfieVerified: true,
              isDLVerified: true,
              isNidVerified: true,
              isRCVerified: true,
              isVehicleOwnersNidVerified: true,
              isNumberPlateVerified: true,
              isTaxTokenVerified: true,
              selfieUrl: true,
              dlFrontSideUrl: true,
              dlBackSideUrl: true,
              nidFrontSideUrl: true,
              nidBackSideUrl: true,
              rcFrontSideUrl: true,
              rcBackSideUrl: true,
              vehicleOwnersNidFrontSideUrl: true,
              vehicleOwnersNidBackSideUrl: true,
              numberPlateUrl: true,
              taxTokenUrl: true,
              user: {
                select: {
                  status: true,
                },
              },
              drivingLicense: {
                select: {
                  nameOnLicense: true,
                },
              },
            },
          },
        },
        skip,
        take: pageSize,
      });

      const totalPages = Math.ceil(totalCount / pageSize);
      const hasNextPage = page < totalPages;
      const hasPrevPage = page > 1;

      return {
        message: 'Promoter list fetched successfully',
        data: promoters,
        pagination: {
          totalItems: totalCount,
          totalPages,
          currentPage: page,
          pageSize,
          hasNextPage,
          hasPrevPage,
        },
      };
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  private maskPhoneNumber(phone: string): string {
    if (phone.length <= 4) return phone;
    return phone.slice(0, 2) + '*'.repeat(phone.length - 4) + phone.slice(-2);
  }

  private async updateRelatedFields(
    prisma: any,
    driverId: string,
    documentType: DocumentType,
    fields: {
      name?: string;
      dateOfBirth?: string;
      documentNumber?: string;
      vehicleRegNo?: string;
      vehicleType?: string;
      vehicleColor?: string;
      vehicleModel?: string;
      seatCapacity?: number;
      expiryDate?: string;
      issueDate?: string;
    },
  ) {
    const {
      name,
      dateOfBirth,
      documentNumber,
      vehicleRegNo,
      vehicleType,
      vehicleColor,
      vehicleModel,
      seatCapacity,
      expiryDate,
      issueDate,
    } = fields;

    switch (documentType) {
      case DocumentType.NID:
        if (name || dateOfBirth || documentNumber) {
          const nidUpdateData: any = {};
          if (name) nidUpdateData.name = name;
          if (dateOfBirth) nidUpdateData.dateOfBirth = new Date(dateOfBirth);
          if (documentNumber) nidUpdateData.nidNumber = documentNumber;

          await prisma.nid.upsert({
            where: { pilotId: driverId },
            update: nidUpdateData,
            create: {
              pilotId: driverId,
              ...nidUpdateData,
            },
          });
        }
        break;

      case DocumentType.DRIVING_LICENSE:
        if (name || dateOfBirth || documentNumber || expiryDate || issueDate) {
          const dlUpdateData: any = {};
          if (name) dlUpdateData.nameOnLicense = name;
          if (dateOfBirth) dlUpdateData.dateOfBirth = new Date(dateOfBirth);
          if (documentNumber) dlUpdateData.licenseNumber = documentNumber;
          if (expiryDate) dlUpdateData.validUntill = new Date(expiryDate);
          if (issueDate) dlUpdateData.dateOfIssue = new Date(issueDate);

          await prisma.drivingLicense.upsert({
            where: { pilotId: driverId },
            update: dlUpdateData,
            create: {
              pilotId: driverId,
              ...dlUpdateData,
            },
          });
        }
        break;

      case DocumentType.REGISTRATION_CERTIFICATE:
      case DocumentType.NUMBER_PLATE:
      case DocumentType.TAX_TOKEN:
        if (
          vehicleRegNo ||
          vehicleType ||
          vehicleColor ||
          vehicleModel ||
          seatCapacity
        ) {
          const vehicleUpdateData: any = {};
          if (vehicleRegNo) vehicleUpdateData.regNo = vehicleRegNo;
          if (vehicleColor) vehicleUpdateData.colour = vehicleColor;
          if (vehicleModel) vehicleUpdateData.model = vehicleModel;
          if (seatCapacity) vehicleUpdateData.seatCapacity = seatCapacity;

          // Handle vehicle type update
          if (vehicleType) {
            const vehicleTypeBD = await prisma.vehicleTypeBD.findFirst({
              where: { name: vehicleType },
            });
            if (vehicleTypeBD) {
              vehicleUpdateData.vehicleTypeBDId = vehicleTypeBD.id;
            }
          }

          await prisma.vehicle.upsert({
            where: { pilotId: driverId },
            update: vehicleUpdateData,
            create: {
              pilotId: driverId,
              ...vehicleUpdateData,
            },
          });
        }
        break;

      case DocumentType.VEHICLE_OWNERS_NID:
        if (name || dateOfBirth || documentNumber) {
          const nidUpdateData: any = {};
          if (name) nidUpdateData.vehicleOwnerNidName = name;
          if (dateOfBirth)
            nidUpdateData.vehicleOwnerNidDateOfBirth = new Date(dateOfBirth);
          if (documentNumber)
            nidUpdateData.vehicleOwnerNidNumber = documentNumber;

          await prisma.nid.upsert({
            where: { pilotId: driverId },
            update: nidUpdateData,
            create: {
              pilotId: driverId,
              ...nidUpdateData,
            },
          });
        }
        break;

      default:
        // No additional fields to update for other document types
        break;
    }
  }
}
