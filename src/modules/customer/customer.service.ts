import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/core/database/prisma.service';

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
}
