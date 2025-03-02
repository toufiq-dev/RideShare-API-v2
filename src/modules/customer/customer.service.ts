import { Injectable, NotFoundException } from '@nestjs/common';
import { instanceToPlain } from 'class-transformer';
import { PrismaService } from 'src/core/database/prisma.service';
import {
  CreateSavedPlaceDto,
  UpdateSavedPlaceDto,
  CompleteCustomerOnboardingDto,
} from './dto/customer.dto';
import { RideGateway } from '../ride/ride.gateway';

@Injectable()
export class CustomerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rideGateway: RideGateway,
  ) {}

  async getCustomer(userId: string) {
    const customer = await this.prisma.customer.findUnique({
      where: {
        userId,
      },
      include: {
        user: true,
        language: true,
      },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found.');
    }

    const data = {
      ...customer,
      user: {
        name: customer.name,
        email: customer.email,
        avatar: customer.avatar,
       ...customer.user
      },
      ...customer.language,
    }

    return {
      message: 'Customer fetched successfully.',
      data,
    };
  }

  async completeOnboarding(
    userId: string,
    customerOnboardingDto: CompleteCustomerOnboardingDto,
  ) {
    const { name, email } = customerOnboardingDto;

    try {
      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      console.log(user);
      if (!user) {
        throw new NotFoundException('User not found.');
      }

      const updatedUser = await this.prisma.customer.update({
        where: { userId: user.id },
        data: {
          name,
          email,
        },
      });

      return {
        message: 'Onboarding completed successfully.',
        data: updatedUser,
      };
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  async createSavedPlace(
    userId: string,
    createSavedPlacesDto: CreateSavedPlaceDto,
  ) {
    const { name, address, location, type } = createSavedPlacesDto;

    const customer = await this.prisma.customer.findUnique({
      where: {
        userId,
      },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found.');
    }

    const data = await this.prisma.savedPlace.create({
      data: {
        customerId: customer.id,
        name,
        address,
        type,
        location: location ? instanceToPlain(location) : null,
      },
    });

    return {
      message: 'Saved address created successfully.',
      data,
    };
  }

  async getSavedPlaces(userId: string) {
    const customer = await this.prisma.customer.findUnique({
      where: {
        userId,
      },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found.');
    }

    const data = await this.prisma.savedPlace.findMany({
      where: {
        customerId: customer.id,
      },
    });

    if (!data) {
      throw new NotFoundException('Saved places not found.');
    }

    this.rideGateway.server.emit('savedPlaces', {
      message: 'Saved places fetched successfully.',
      data,
    });

    return {
      message: 'Saved places fetched successfully.',
      data,
    };
  }

  async updateSavedPlace(
    id: string,
    userId: string,
    updateSavedPlaceDto: UpdateSavedPlaceDto,
  ) {
    const { name, address, location, type } = updateSavedPlaceDto;
    const customer = await this.prisma.customer.findUnique({
      where: {
        userId,
      },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found.');
    }

    const savedPlace = await this.prisma.savedPlace.findUnique({
      where: {
        id,
      },
    });

    if (!savedPlace) {
      throw new NotFoundException('Saved place not found.');
    } else {
      const data = await this.prisma.savedPlace.update({
        where: {
          id,
        },
        data: {
          name,
          address,
          type,
          location: location ? instanceToPlain(location) : null,
        },
      });
      return {
        message: 'Saved place updated successfully.',
        data,
      };
    }
  }

  async deleteSavedPlace(id: string, userId: string) {
    const customer = await this.prisma.customer.findUnique({
      where: {
        userId,
      },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found.');
    }

    const savedPlace = await this.prisma.savedPlace.findUnique({
      where: {
        id,
      },
    });

    if (!savedPlace) {
      throw new NotFoundException('Saved place not found.');
    }

    await this.prisma.savedPlace.delete({
      where: {
        id,
      },
    });

    return {
      message: 'Saved place deleted successfully.',
    };
  }

  async getVehicleCategories() {
    const data = await this.prisma.vehicleType.findMany();

    return {
      message: 'Vehicle categories fetched successfully.',
      data,
    };
  }
}
