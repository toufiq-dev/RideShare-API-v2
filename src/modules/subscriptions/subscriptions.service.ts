import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/core/database/prisma.service';

@Injectable()
export class SubscriptionsService {
  constructor(private readonly prisma: PrismaService) {}

  async create() {
    // return this.prisma.pilotSubscription.create({
    //   data: {
    //     name: 'Onboarding',
    //     coins: 4500,
    //     description: 'Free subscription for Pilot Onboarding',
    //   }
  }
}
