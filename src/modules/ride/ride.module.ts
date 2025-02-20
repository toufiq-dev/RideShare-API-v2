import { Module } from '@nestjs/common';
import { RideService } from './ride.service';
import { RideGateway } from './ride.gateway';
import { JwtModule } from '@nestjs/jwt';
import { PrismaModule } from 'src/core/database/prisma.module';

@Module({
  imports: [PrismaModule, JwtModule],
  providers: [RideGateway, RideService],
})
export class RideModule {}
