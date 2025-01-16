import { Injectable, NotFoundException } from '@nestjs/common';
import { instanceToPlain } from 'class-transformer';
import { PrismaService } from 'src/core/database/prisma.service';
import { CreateSavedPlaceDto } from './dto/customer.dto';

@Injectable()
export class CustomerService {
  constructor(private readonly prisma: PrismaService) {}

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
    console.log('customer service from vscode');
    return {
      message: 'Customer fetched successfully',
      data: customer,
    };
  }

  async createSavedPlace(
    userId: string,
    createSavedPlacesDto: CreateSavedPlaceDto,
  ) {
    const { name, address, location } = createSavedPlacesDto;

    const customer = await this.prisma.customer.findUnique({
      where: {
        userId,
      },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    const locationPlain = location ? instanceToPlain(location) : null;

    const savedAddress = await this.prisma.savedPlace.create({
      data: {
        customerId: customer.id,
        name,
        address,
        location: locationPlain,
      },
    });

    return {
      message: 'Saved address created successfully',
      data: savedAddress,
    };
  }
}
