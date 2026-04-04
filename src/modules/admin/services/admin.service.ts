import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from 'src/core/database/database.service';
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
} from '../dto/admin.dto';
import { randomUUID } from 'node:crypto';
import {
  AppPlatform,
  UserRole,
  UserStatus,
  VehicleTypeNameBD,
  VerificationStatus,
} from '@prisma/client';
import bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { RedisService } from 'src/core/cache/redis.service';
import { RedisKeys } from 'src/core/cache/redis-keys';
import { AzureService } from 'src/core/utils/azure.util';
import { EmailService } from '../../email/email.service';
import { EmailSendOtpDto } from '../../email/dto/email.dto';
import { DocumentValidation } from '../admin.constants';
import { VerificationService } from 'src/core/utils/verification.util';
import moment from 'moment-timezone';
import { PilotService } from '../../pilot/pilot.service';
import { FilterVehicleTypeBDFilterDto } from '../dto/admin-vehicle-type-filter.dto';
import { LoggerService } from 'src/core/logging/logger.service';

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
    private readonly verificationService: VerificationService,
    private readonly pilotService: PilotService,
    private readonly logger: LoggerService,
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
      this.logger.logError(
        error instanceof Error ? error : new Error(String(error)),
        'AdminService',
      );
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
      this.logger.logError(
        error instanceof Error ? error : new Error(String(error)),
        'AdminService',
      );
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
      this.logger.logError(
        error instanceof Error ? error : new Error(String(error)),
        'AdminService',
      );
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
      this.logger.logError(
        error instanceof Error ? error : new Error(String(error)),
        'AdminService',
      );
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

      const emailOtpDto: EmailSendOtpDto = { email };

      await this.emailService.sendOtpEmail(emailOtpDto);

      return {
        message: 'Reset password OTP sent to your email successfully.',
      };
    } catch (error) {
      this.logger.logError(
        error instanceof Error ? error : new Error(String(error)),
        'AdminService',
      );
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
      this.logger.logError(
        error instanceof Error ? error : new Error(String(error)),
        'AdminService',
      );
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
      this.logger.logError(
        error instanceof Error ? error : new Error(String(error)),
        'AdminService',
      );
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
      this.logger.logError(
        error instanceof Error ? error : new Error(String(error)),
        'AdminService',
      );
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
      this.logger.logError(
        error instanceof Error ? error : new Error(String(error)),
        'AdminService',
      );
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
          status: UserStatus.DELETED,
        },
      });

      return {
        message: 'Staff deleted successfully.',
      };
    } catch (error) {
      this.logger.logError(
        error instanceof Error ? error : new Error(String(error)),
        'AdminService',
      );
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
      this.logger.logError(
        error instanceof Error ? error : new Error(String(error)),
        'AdminService',
      );
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
      this.logger.logError(
        error instanceof Error ? error : new Error(String(error)),
        'AdminService',
      );
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
      this.logger.logError(
        error instanceof Error ? error : new Error(String(error)),
        'AdminService',
      );
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
      this.logger.logError(
        error instanceof Error ? error : new Error(String(error)),
        'AdminService',
      );
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
      this.logger.logError(
        error instanceof Error ? error : new Error(String(error)),
        'AdminService',
      );
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
      this.logger.logError(
        error instanceof Error ? error : new Error(String(error)),
        'AdminService',
      );
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
      this.logger.logError(
        error instanceof Error ? error : new Error(String(error)),
        'AdminService',
      );
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
      this.logger.logError(
        error instanceof Error ? error : new Error(String(error)),
        'AdminService',
      );
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
          referralCode: randomUUID().replace(/-/g, ''),
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
      this.logger.logError(
        error instanceof Error ? error : new Error(String(error)),
        'AdminService',
      );
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
      this.logger.logError(
        error instanceof Error ? error : new Error(String(error)),
        'AdminService',
      );
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
      this.logger.logError(
        error instanceof Error ? error : new Error(String(error)),
        'AdminService',
      );
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
      this.logger.logError(
        error instanceof Error ? error : new Error(String(error)),
        'AdminService',
      );
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
      this.logger.logError(
        error instanceof Error ? error : new Error(String(error)),
        'AdminService',
      );
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
      this.logger.logError(
        error instanceof Error ? error : new Error(String(error)),
        'AdminService',
      );
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
      this.logger.logError(
        error instanceof Error ? error : new Error(String(error)),
        'AdminService',
      );
      throw error;
    }
  }

  async getDriverDocument(driverId: string, documentType: DocumentType) {
    try {
      const data = await this.prisma.pilot.findUnique({
        where: { id: driverId },
        include: {
          user: {
            select: {
              metadata: true,
            },
          },
          drivingLicense: {
            select: {
              nameOnLicense: true,
              dateOfBirth: true,
              licenseNumber: true,
              validUntill: true,
              createdAt: true,
            },
          },
          nid: {
            select: {
              name: true,
              dateOfBirth: true,
              nidNumber: true,
              vehicleOwnerNidName: true,
              vehicleOwnerNidDateOfBirth: true,
              vehicleOwnerNidNumber: true,
            },
          },
          vehicle: {
            select: {
              regNo: true,
              registrationDate: true,
              colour: true,
              model: true,
              seatCapacity: true,
              createdAt: true,
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

      const getDocumentValidation = (documentType: DocumentType) => {
        if (!data.user?.metadata || !Array.isArray(data.user.metadata)) {
          return null;
        }

        return data.user.metadata.filter(
          (item: any) => item.documentType === documentType,
        );
      };

      if (documentType === DocumentType.NID) {
        return {
          message: 'NID document fetched successfully.',
          data: {
            id: data.id,
            nidVerified: data.isNidVerified,
            nidFrontSideUrl: data?.nidFrontSideUrl ?? null,
            nidBackSideUrl: data?.nidBackSideUrl ?? null,
            name: data?.nid?.name ?? null,
            dateOfBirth: data?.nid?.dateOfBirth ?? null,
            nidNumber: data?.nid?.nidNumber ?? null,
            uploadedAt: data.createdAt,
            validation: getDocumentValidation(DocumentType.NID),
          },
        };
      } else if (documentType === DocumentType.DRIVING_LICENSE) {
        return {
          message: 'Driving license document fetched successfully.',
          data: {
            id: data.id,
            nameOnLicense: data?.drivingLicense?.nameOnLicense ?? null,
            dlVerified: data.isDLVerified,
            dlFrontSideUrl: data?.dlFrontSideUrl ?? null,
            dlBackSideUrl: data?.dlBackSideUrl ?? null,
            dateOfBirth: data?.drivingLicense?.dateOfBirth ?? null,
            licenseNumber: data?.drivingLicense?.licenseNumber ?? null,
            validUntill: data?.drivingLicense?.validUntill ?? null,
            uploadedAt: data?.drivingLicense?.createdAt ?? null,
            validation: getDocumentValidation(DocumentType.DRIVING_LICENSE),
          },
        };
      } else if (documentType === DocumentType.SELFIE) {
        return {
          message: 'Selfie document fetched successfully.',
          data: {
            id: data.id,
            selfieVerified: data.isSelfieVerified,
            selfieUrl: data?.selfieUrl ?? null,
            uploadedAt: data.createdAt,
            validation: getDocumentValidation(DocumentType.SELFIE),
          },
        };
      } else if (documentType === DocumentType.VEHICLE_OWNERS_NID) {
        return {
          message: 'Vehicle owners NID document fetched successfully.',
          data: {
            id: data.id,
            name: data?.nid?.vehicleOwnerNidName ?? null,
            dateOfBirth: data?.nid?.vehicleOwnerNidDateOfBirth ?? null,
            nidNumber: data?.nid?.vehicleOwnerNidNumber ?? null,
            vehicleOwnersNidVerified: data.isVehicleOwnersNidVerified,
            vehicleOwnersNidFrontSideUrl:
              data?.vehicleOwnersNidFrontSideUrl ?? null,
            vehicleOwnersNidBackSideUrl:
              data?.vehicleOwnersNidBackSideUrl ?? null,
            uploadedAt: data.createdAt,
            validation: getDocumentValidation(DocumentType.VEHICLE_OWNERS_NID),
          },
        };
      } else if (documentType === DocumentType.REGISTRATION_CERTIFICATE) {
        return {
          message: 'Registration certificate document fetched successfully.',
          data: {
            id: data.id,
            rcVerified: data.isRCVerified,
            rcFrontSideUrl: data?.rcFrontSideUrl ?? null,
            rcBackSideUrl: data?.rcBackSideUrl ?? null,
            vehicleNumber: data?.vehicle?.regNo ?? null,
            vehicleType: data?.vehicle?.vehicleTypeBD?.name ?? null,
            registrationDate: data?.vehicle?.registrationDate ?? null,
            vehicleColour: data?.vehicle?.colour ?? null,
            seatCapacity: data?.vehicle?.seatCapacity ?? null,
            uploadedAt: data?.vehicle?.createdAt ?? null,
            validation: getDocumentValidation(
              DocumentType.REGISTRATION_CERTIFICATE,
            ),
          },
        };
      } else if (documentType === DocumentType.NUMBER_PLATE) {
        return {
          message: 'Number plate document fetched successfully.',
          data: {
            id: data.id,
            numberPlateVerified: data.isNumberPlateVerified,
            numberPlateUrl: data?.numberPlateUrl ?? null,
            uploadedAt: data.createdAt,
            validation: getDocumentValidation(DocumentType.NUMBER_PLATE),
          },
        };
      } else if (documentType === DocumentType.TAX_TOKEN) {
        return {
          message: 'Tax token document fetched successfully.',
          data: {
            id: data.id,
            taxTokenVerified: data.isTaxTokenVerified,
            taxTokenUrl: data?.taxTokenUrl ?? null,
            uploadedAt: data.createdAt,
            validation: getDocumentValidation(DocumentType.TAX_TOKEN),
          },
        };
      }
    } catch (error) {
      this.logger.logError(
        error instanceof Error ? error : new Error(String(error)),
        'AdminService',
      );
      throw error;
    }
  }

  async getVehicleTypes() {
    const data = await this.prisma.vehicleTypeBD.findMany();
    return {
      message: 'Vehicle types fetched successfully.',
      data,
    };
  }

  async verifyDriver(
    driverId: string,
    documentType: DocumentType,
    verifyDriverDto: VerifyDriverDto,
    userId: string,
  ) {
    const {
      verificationStatus,
      rejectionReason,
      name,
      dateOfBirth,
      documentNumber,
      vehicleRegNo,
      vehicleTypeId,
      vehicleColor,
      expiryDate,
      vehicleRegDate,
    } = verifyDriverDto;

    try {
      const supportStuff = await this.prisma.support.findUnique({
        where: {
          userId,
        },
        select: {
          name: true,
        },
      });

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

      const user = await this.prisma.user.findUnique({
        where: { id: pilot.userId },
        select: {
          metadata: true,
        },
      });

      if (!user) {
        throw new NotFoundException('User not found');
      }

      await this.prisma.$transaction(async (prisma) => {
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
        await prisma.pilot.update({
          where: { id: driverId },
          data: pilotUpdateData,
        });

        // Update related fields based on document type
        await this.updateRelatedFields(prisma, driverId, documentType, {
          name,
          dateOfBirth,
          documentNumber,
          vehicleRegNo,
          vehicleTypeId,
          vehicleColor,
          expiryDate,
          vehicleRegDate,
        });

        const validationRecord: DocumentValidation = {
          documentType,
          reviewedOn: new Date().toISOString(),
          reviewedBy: supportStuff?.name ?? 'Unknown',
          verificationStatus,
          rejectionReason: rejectionReason || '',
        };

        if (!user.metadata || !Array.isArray(user.metadata)) {
          await prisma.user.update({
            where: { id: pilot.userId },
            data: {
              metadata: [validationRecord] as any,
            },
          });
        } else {
          await prisma.user.update({
            where: { id: pilot.userId },
            data: {
              metadata: [...(user.metadata as any[]), validationRecord] as any,
            },
          });
        }
      });

      const data = await this.prisma.pilot.findUnique({
        where: { id: driverId },
        include: {
          drivingLicense: true,
          nid: true,
          vehicle: {
            include: {
              vehicleTypeBD: true,
            },
          },
          user: {
            select: {
              metadata: true,
            },
          },
        },
      });

      if (
        data.isSelfieVerified === VerificationStatus.REJECTED ||
        data.isNidVerified === VerificationStatus.REJECTED ||
        data.isDLVerified === VerificationStatus.REJECTED ||
        data.isRCVerified === VerificationStatus.REJECTED ||
        data.isNumberPlateVerified === VerificationStatus.REJECTED ||
        data.isTaxTokenVerified === VerificationStatus.REJECTED ||
        data.isVehicleOwnersNidVerified === VerificationStatus.REJECTED
      ) {
        await this.prisma.user.update({
          where: { id: data.userId },
          data: { status: UserStatus.ONBOARDING },
        });
      }

      if (
        data.isSelfieVerified === VerificationStatus.APPROVED &&
        data.isNidVerified === VerificationStatus.APPROVED &&
        data.isDLVerified === VerificationStatus.APPROVED &&
        data.isRCVerified === VerificationStatus.APPROVED &&
        data.isNumberPlateVerified === VerificationStatus.APPROVED &&
        data.isTaxTokenVerified === VerificationStatus.APPROVED &&
        data.isVehicleOwnersNidVerified === VerificationStatus.APPROVED
      ) {
        await this.prisma.user.update({
          where: { id: pilot.userId },
          data: {
            status: UserStatus.ACTIVE,
          },
        });
      }

      return {
        message: 'Driver verification updated successfully.',
        data,
      };
    } catch (error) {
      this.logger.logError(
        error instanceof Error ? error : new Error(String(error)),
        'AdminService',
      );
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
      this.logger.logError(
        error instanceof Error ? error : new Error(String(error)),
        'AdminService',
      );
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
      this.logger.logError(
        error instanceof Error ? error : new Error(String(error)),
        'AdminService',
      );
      throw error;
    }
  }

  async driverDocumentsUpload(
    files: { front: Express.Multer.File[]; back?: Express.Multer.File[] },
    driverId: string,
    documentType: DocumentType,
  ) {
    try {
      const pilot = await this.prisma.pilot.findUnique({
        where: { id: driverId },
        select: {
          id: true,
          isDLVerified: true,
          dlFrontSideUrl: true,
          dlBackSideUrl: true,
          isRCVerified: true,
          rcFrontSideUrl: true,
          rcBackSideUrl: true,
          isNidVerified: true,
          nidFrontSideUrl: true,
          nidBackSideUrl: true,
          isVehicleOwnersNidVerified: true,
          vehicleOwnersNidFrontSideUrl: true,
          vehicleOwnersNidBackSideUrl: true,
          isNumberPlateVerified: true,
          numberPlateUrl: true,
          isTaxTokenVerified: true,
          taxTokenUrl: true,
          isSelfieVerified: true,
          selfieUrl: true,
        },
      });
      if (!pilot) {
        throw new NotFoundException('Driver not found');
      }

      const updateData: any = {};

      if (
        documentType === DocumentType.DRIVING_LICENSE &&
        pilot.isDLVerified !== VerificationStatus.APPROVED
      ) {
        if (files?.front?.[0]) {
          const dlFrontSideUrl = await this.azureService.uploadFile(
            files.front[0].buffer,
            files.front[0].originalname,
            driverId,
            files.front[0].mimetype,
          );
          updateData.dlFrontSideUrl = dlFrontSideUrl;
        }

        if (files?.back?.[0]) {
          const dlBackSideUrl = await this.azureService.uploadFile(
            files.back[0].buffer,
            files.back[0].originalname,
            driverId,
            files.back[0].mimetype,
          );
          updateData.dlBackSideUrl = dlBackSideUrl;
        }

        if (pilot.dlFrontSideUrl || pilot.dlBackSideUrl) {
          await this.deletePreviousFiles(
            pilot.dlFrontSideUrl,
            pilot.dlBackSideUrl,
          );
        }

        let verificationResponse = await this.verificationService.extractDLData(
          files.front[0].buffer,
        );

        if (!verificationResponse) {
          throw new BadRequestException(
            'Failed to extract driving license data.',
          );
        }

        const formattedDateOfBirth = verificationResponse?.dateOfBirth
          ? moment(verificationResponse.dateOfBirth, 'DD MMM YYYY')
              .startOf('day')
              .toISOString()
          : null;

        const formattedLicenseExpiryDate =
          verificationResponse?.licenseExpiryDate
            ? moment(verificationResponse.licenseExpiryDate, 'DD MMM YYYY')
                .startOf('day')
                .toISOString()
            : null;

        // Validate required dates before upsert
        if (!formattedDateOfBirth) {
          throw new BadRequestException(
            'Date of birth could not be extracted from the driving license. Please ensure the document is clear and readable.',
          );
        }

        if (!formattedLicenseExpiryDate) {
          throw new BadRequestException(
            'License expiry date could not be extracted from the driving license. Please ensure the document is clear and readable.',
          );
        }

        verificationResponse = {
          ...verificationResponse,
          dateOfBirth: formattedDateOfBirth,
          licenseExpiryDate: formattedLicenseExpiryDate,
        };

        const data = await this.prisma.drivingLicense.upsert({
          where: { pilotId: pilot.id },
          update: {
            licenseNumber: verificationResponse.licenseNumber,
            dateOfBirth: formattedDateOfBirth,
            validUntill: formattedLicenseExpiryDate,
            nameOnLicense: verificationResponse.name,
          },
          create: {
            licenseNumber: verificationResponse.licenseNumber,
            dateOfBirth: formattedDateOfBirth,
            validUntill: formattedLicenseExpiryDate,
            nameOnLicense: verificationResponse.name,
            pilotId: pilot.id,
          },
        });

        // await this.prisma.pilot.update({
        //   where: { id: pilot.id },
        //   data: {
        //     isDLVerified: VerificationStatus.IN_PROGRESS,
        //   },
        // });

        await this.pilotService.updateUserStatusAfterDocumentUpload(pilot.id);
      } else if (
        documentType === DocumentType.REGISTRATION_CERTIFICATE &&
        pilot.isRCVerified !== VerificationStatus.APPROVED
      ) {
        if (files?.front?.[0]) {
          const rcFrontSideUrl = await this.azureService.uploadFile(
            files.front[0].buffer,
            files.front[0].originalname,
            driverId,
            files.front[0].mimetype,
          );
          updateData.rcFrontSideUrl = rcFrontSideUrl;
        }

        if (files?.back?.[0]) {
          const rcBackSideUrl = await this.azureService.uploadFile(
            files.back[0].buffer,
            files.back[0].originalname,
            driverId,
            files.back[0].mimetype,
          );
          updateData.rcBackSideUrl = rcBackSideUrl;
        }

        if (pilot.rcFrontSideUrl || pilot.rcBackSideUrl) {
          await this.deletePreviousFiles(
            pilot.rcFrontSideUrl,
            pilot.rcBackSideUrl,
          );
        }

        let verificationResponse = await this.verificationService.extractRCData(
          files.front[0].buffer,
        );

        if (!verificationResponse) {
          throw new BadRequestException('Failed to extract RC data.');
        }

        if (
          !verificationResponse.registrationPoint &&
          !verificationResponse.series &&
          !verificationResponse.seriesEnglish &&
          !verificationResponse.number &&
          !verificationResponse.vehicleType &&
          !verificationResponse.registrationDate &&
          !verificationResponse.vehicleColour &&
          !verificationResponse.model &&
          !verificationResponse.seatCapacity
        ) {
          throw new BadRequestException(
            'This RC card is either non-existing or invalid.',
          );
        }

        const formattedRegistrationDate = moment(
          verificationResponse?.registrationDate,
          'DD MMM YYYY',
        )
          .startOf('day')
          .toISOString();

        const vehicleTypeBD = await this.verificationService.mapVehicleType(
          verificationResponse.vehicleType,
        );
        if (
          !vehicleTypeBD ||
          !Object.values(VehicleTypeNameBD).includes(vehicleTypeBD)
        ) {
          throw new BadRequestException('Invalid vehicle type');
        }
        const vehicleTypeBDId = await this.prisma.vehicleTypeBD.findUnique({
          where: { name: vehicleTypeBD },
          select: { id: true },
        });

        await this.prisma.vehicle.upsert({
          where: { pilotId: pilot.id },
          update: {
            regNo: verificationResponse.number,
            colour: verificationResponse.vehicleColour,
            model: verificationResponse.model,
            seatCapacity: verificationResponse.seatCapacity,
            vehicleTypeIdBD: vehicleTypeBDId.id,
            registrationDate: formattedRegistrationDate,
          },
          create: {
            regNo: verificationResponse.number,
            colour: verificationResponse.vehicleColour,
            model: verificationResponse.model,
            seatCapacity: verificationResponse.seatCapacity,
            vehicleTypeIdBD: vehicleTypeBDId.id,
            registrationDate: formattedRegistrationDate,
            pilotId: pilot.id,
          },
        });

        // await this.prisma.pilot.update({
        //   where: { id: pilot.id },
        //   data: {
        //     isRCVerified: VerificationStatus.IN_PROGRESS,
        //   },
        // });

        await this.pilotService.updateUserStatusAfterDocumentUpload(pilot.id);
      } else if (
        documentType === DocumentType.NID &&
        pilot.isNidVerified !== VerificationStatus.APPROVED
      ) {
        if (files?.front?.[0]) {
          const nidFrontSideUrl = await this.azureService.uploadFile(
            files.front[0].buffer,
            files.front[0].originalname,
            driverId,
            files.front[0].mimetype,
          );
          updateData.nidFrontSideUrl = nidFrontSideUrl;
        }

        if (files?.back?.[0]) {
          const nidBackSideUrl = await this.azureService.uploadFile(
            files.back[0].buffer,
            files.back[0].originalname,
            driverId,
            files.back[0].mimetype,
          );
          updateData.nidBackSideUrl = nidBackSideUrl;
        }

        if (pilot.nidFrontSideUrl || pilot.nidBackSideUrl) {
          await this.deletePreviousFiles(
            pilot.nidFrontSideUrl,
            pilot.nidBackSideUrl,
          );
        }

        const verificationResponse =
          await this.verificationService.extractNidData(files.front[0].buffer);

        if (!verificationResponse) {
          throw new BadRequestException('Failed to extract NID data.');
        }
        if (
          !verificationResponse.nidNumber &&
          !verificationResponse.name &&
          !verificationResponse.dateOfBirth
        ) {
          throw new BadRequestException(
            'This NID card is either non-existing or invalid.',
          );
        }

        const formattedDateOfBirth = moment(
          verificationResponse?.dateOfBirth,
          'DD MMM YYYY',
        )
          .startOf('day')
          .toISOString();

        await this.prisma.nid.upsert({
          where: { pilotId: pilot.id },
          update: {
            nidNumber: verificationResponse.nidNumber,
            name: verificationResponse.name,
            dateOfBirth: formattedDateOfBirth,
          },
          create: {
            nidNumber: verificationResponse.nidNumber,
            name: verificationResponse.name,
            dateOfBirth: formattedDateOfBirth,
            pilotId: pilot.id,
          },
        });

        // await this.prisma.pilot.update({
        //   where: { id: pilot.id },
        //   data: {
        //     isNidVerified: VerificationStatus.IN_PROGRESS,
        //   },
        // });

        await this.pilotService.updateUserStatusAfterDocumentUpload(pilot.id);
      } else if (
        documentType === DocumentType.VEHICLE_OWNERS_NID &&
        pilot.isVehicleOwnersNidVerified !== VerificationStatus.APPROVED
      ) {
        if (files?.front?.[0]) {
          const vehicleOwnersNidFrontSideUrl =
            await this.azureService.uploadFile(
              files.front[0].buffer,
              files.front[0].originalname,
              driverId,
              files.front[0].mimetype,
            );
          updateData.vehicleOwnersNidFrontSideUrl =
            vehicleOwnersNidFrontSideUrl;
        }
        if (files?.back?.[0]) {
          const vehicleOwnersNidBackSideUrl =
            await this.azureService.uploadFile(
              files.back[0].buffer,
              files.back[0].originalname,
              driverId,
              files.back[0].mimetype,
            );
          updateData.vehicleOwnersNidBackSideUrl = vehicleOwnersNidBackSideUrl;
        }

        if (
          pilot.vehicleOwnersNidFrontSideUrl ||
          pilot.vehicleOwnersNidBackSideUrl
        ) {
          await this.deletePreviousFiles(
            pilot.vehicleOwnersNidFrontSideUrl,
            pilot.vehicleOwnersNidBackSideUrl,
          );
        }

        const verificationResponse =
          await this.verificationService.extractNidData(files.front[0].buffer);

        if (!verificationResponse) {
          throw new BadRequestException('Failed to extract NID data.');
        }
        if (
          !verificationResponse.nidNumber &&
          !verificationResponse.name &&
          !verificationResponse.dateOfBirth
        ) {
          throw new BadRequestException(
            'This NID card is either non-existing or invalid.',
          );
        }

        const formattedDateOfBirth = moment(
          verificationResponse?.dateOfBirth,
          'DD MMM YYYY',
        )
          .startOf('day')
          .toISOString();

        await this.prisma.nid.upsert({
          where: { pilotId: pilot.id },
          update: {
            vehicleOwnerNidNumber: verificationResponse.nidNumber,
            vehicleOwnerNidName: verificationResponse.name,
            vehicleOwnerNidDateOfBirth: formattedDateOfBirth,
          },
          create: {
            vehicleOwnerNidNumber: verificationResponse.nidNumber,
            vehicleOwnerNidName: verificationResponse.name,
            vehicleOwnerNidDateOfBirth: formattedDateOfBirth,
            pilotId: pilot.id,
          },
        });
        // await this.prisma.pilot.update({
        //   where: { id: pilot.id },
        //   data: {
        //     isVehicleOwnersNidVerified: VerificationStatus.IN_PROGRESS,
        //   },
        // });

        await this.pilotService.updateUserStatusAfterDocumentUpload(pilot.id);
      } else if (
        documentType === DocumentType.NUMBER_PLATE &&
        pilot.isNumberPlateVerified !== VerificationStatus.APPROVED
      ) {
        if (files?.front?.[0]) {
          const numberPlateUrl = await this.azureService.uploadFile(
            files.front[0].buffer,
            files.front[0].originalname,
            driverId,
            files.front[0].mimetype,
          );
          updateData.numberPlateUrl = numberPlateUrl;
        }

        if (pilot.numberPlateUrl) {
          await this.deletePreviousFiles(pilot.numberPlateUrl);
        }

        const verificationResponse =
          await this.verificationService.extractNumberPlateData(
            files.front[0].buffer,
          );

        if (!verificationResponse) {
          throw new BadRequestException('Failed to extract number plate data.');
        }

        if (!verificationResponse.numberPlate) {
          throw new BadRequestException(
            'Number plate is not valid or not readable.',
          );
        }

        // await this.prisma.pilot.update({
        //   where: { id: pilot.id },
        //   data: {
        //     isNumberPlateVerified: VerificationStatus.IN_PROGRESS,
        //   },
        // });

        await this.pilotService.updateUserStatusAfterDocumentUpload(pilot.id);
      } else if (
        documentType === DocumentType.TAX_TOKEN &&
        pilot.isTaxTokenVerified !== VerificationStatus.APPROVED
      ) {
        if (files?.front?.[0]) {
          const taxTokenUrl = await this.azureService.uploadFile(
            files.front[0].buffer,
            files.front[0].originalname,
            driverId,
            files.front[0].mimetype,
          );
          updateData.taxTokenUrl = taxTokenUrl;
        }

        if (pilot.taxTokenUrl) {
          await this.deletePreviousFiles(pilot.taxTokenUrl);
        }

        // await this.prisma.pilot.update({
        //   where: { id: pilot.id },
        //   data: {
        //     isTaxTokenVerified: VerificationStatus.IN_PROGRESS,
        //   },
        // });

        const verificationResponse =
          await this.verificationService.extractTaxTokenData(
            files.front[0].buffer,
          );

        if (!verificationResponse) {
          throw new BadRequestException('Failed to extract tax token data.');
        }

        if (!verificationResponse.name) {
          throw new BadRequestException(
            'Tax token is not valid or not readable.',
          );
        }

        await this.pilotService.updateUserStatusAfterDocumentUpload(pilot.id);
      } else if (
        documentType === DocumentType.SELFIE &&
        pilot.isSelfieVerified !== VerificationStatus.APPROVED
      ) {
        if (files?.front?.[0]) {
          const selfieUrl = await this.azureService.uploadFile(
            files.front[0].buffer,
            files.front[0].originalname,
            driverId,
            files.front[0].mimetype,
          );
          updateData.selfieUrl = selfieUrl;
        }

        if (pilot.selfieUrl) {
          await this.deletePreviousFiles(pilot.selfieUrl);
        }

        // await this.prisma.pilot.update({
        //   where: { id: pilot.id },
        //   data: {
        //     isSelfieVerified: VerificationStatus.IN_PROGRESS,
        //   },
        // });

        await this.pilotService.updateUserStatusAfterDocumentUpload(pilot.id);
      } else {
        throw new BadRequestException(
          'Document type is already approved or invalid document type',
        );
      }

      const updatedPilot = await this.prisma.pilot.update({
        where: { id: driverId },
        data: updateData,
      });

      return {
        message: 'Documents uploaded successfully',
        data: updatedPilot,
      };
    } catch (error) {
      this.logger.logError(
        error instanceof Error ? error : new Error(String(error)),
        'AdminService',
      );
      throw error;
    }
  }

  async promoterDocumentsUpload(
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
      this.logger.logError(
        error instanceof Error ? error : new Error(String(error)),
        'AdminService',
      );
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
        referralCode: true,
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
          createdAt: true,
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
              createdAt: true,
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
      this.logger.logError(
        error instanceof Error ? error : new Error(String(error)),
        'AdminService',
      );
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
      vehicleTypeId?: string;
      vehicleColor?: string;
      expiryDate?: string;
      vehicleRegDate?: string;
    },
  ) {
    const {
      name,
      dateOfBirth,
      documentNumber,
      vehicleRegNo,
      vehicleTypeId,
      vehicleColor,
      expiryDate,
      vehicleRegDate,
    } = fields;

    switch (documentType) {
      case DocumentType.NID:
        if (name || dateOfBirth || documentNumber) {
          const nidUpdateData: any = {};
          if (name) nidUpdateData.name = name;
          if (dateOfBirth) nidUpdateData.dateOfBirth = new Date(dateOfBirth);
          if (documentNumber) nidUpdateData.nidNumber = documentNumber;

          await prisma.nid.update({
            where: { pilotId: driverId },
            data: nidUpdateData,
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

          await prisma.nid.update({
            where: { pilotId: driverId },
            data: nidUpdateData,
          });
        }
        break;

      case DocumentType.DRIVING_LICENSE:
        if (name || dateOfBirth || documentNumber || expiryDate) {
          const dlUpdateData: any = {};
          if (name) dlUpdateData.nameOnLicense = name;
          if (dateOfBirth) dlUpdateData.dateOfBirth = new Date(dateOfBirth);
          if (documentNumber) dlUpdateData.licenseNumber = documentNumber;
          if (expiryDate) dlUpdateData.validUntill = new Date(expiryDate);

          await prisma.drivingLicense.update({
            where: { pilotId: driverId },
            data: dlUpdateData,
          });
        }
        break;

      case DocumentType.REGISTRATION_CERTIFICATE:
        if (vehicleRegNo || vehicleTypeId || vehicleColor) {
          const vehicleUpdateData: any = {};
          if (vehicleRegNo) vehicleUpdateData.regNo = vehicleRegNo;
          if (vehicleColor) vehicleUpdateData.colour = vehicleColor;
          if (vehicleRegDate)
            vehicleUpdateData.regUpto = new Date(vehicleRegDate);

          // Handle vehicle type update
          if (vehicleTypeId) {
            const vehicleTypeBD = await prisma.vehicleTypeBD.findFirst({
              where: { id: vehicleTypeId },
            });
            if (vehicleTypeBD) {
              vehicleUpdateData.vehicleTypeIdBD = vehicleTypeBD.id;
            }
          }

          await prisma.vehicle.update({
            where: { pilotId: driverId },
            data: vehicleUpdateData,
          });
        }
        break;

      case DocumentType.NUMBER_PLATE:
        if (vehicleRegNo) {
          const vehicleUpdateData: any = {};
          if (vehicleRegNo) vehicleUpdateData.regNo = vehicleRegNo;

          await prisma.vehicle.update({
            where: { pilotId: driverId },
            data: vehicleUpdateData,
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

          await prisma.nid.update({
            where: { pilotId: driverId },
            data: nidUpdateData,
          });
        }
        break;

      default:
        // No additional fields to update for other document types
        break;
    }
  }

  private async deletePreviousFiles(frontUrl: string, backUrl?: string) {
    try {
      const deletePromises: Promise<void>[] = [];

      if (frontUrl) {
        deletePromises.push(this.azureService.deleteFile(frontUrl));
      }

      if (backUrl) {
        deletePromises.push(this.azureService.deleteFile(backUrl));
      }

      if (deletePromises.length > 0) {
        await Promise.allSettled(deletePromises);
      }
    } catch (error) {
      this.logger.logError(
        error instanceof Error ? error : new Error(String(error)),
        'AdminService',
        { scope: 'deletePreviousFiles' },
      );
    }
  }

  async getVehicleTypesListBD(query: FilterVehicleTypeBDFilterDto) {
    try {
      const { page = 1, pageSize = 10, search, startDate, endDate } = query;

      const skip = (page - 1) * pageSize;

      const whereClause: any = {};

      if (search && search.trim()) {
        whereClause.OR = [
          { name: { contains: search.trim(), mode: 'insensitive' } },
        ];
      }

      if (startDate || endDate) {
        whereClause.createdAt = {};
        if (startDate) {
          whereClause.createdAt.gte = new Date(startDate);
        }
        if (endDate) {
          whereClause.createdAt.lte = new Date(endDate);
        }
      }

      const totalCount = await this.prisma.vehicleTypeBD.count({
        where: whereClause,
      });

      const vehicleTypes = await this.prisma.vehicleTypeBD.findMany({
        where: whereClause,
        select: {
          id: true,
          name: true,
        },
        skip: +skip || 0,
        take: +pageSize || 10,
      });

      const totalPages = Math.ceil(totalCount / pageSize);
      const hasNextPage = page < totalPages;
      const hasPrevPage = page > 1;

      return {
        message: 'Vehicle list fetched successfully',
        data: vehicleTypes,
        pagination: {
          totalItems: totalCount,
          totalPages,
          currentPage: +page,
          pageSize: +pageSize || 10,
          hasNextPage,
          hasPrevPage,
        },
      };
    } catch (error) {
      this.logger.logError(
        error instanceof Error ? error : new Error(String(error)),
        'AdminService',
      );
      throw error;
    }
  }
}
