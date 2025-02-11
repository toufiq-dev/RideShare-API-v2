import { Module } from '@nestjs/common';
import { BookingService } from './booking.service';
import { BookingGateway } from './booking.gateway';
import { JwtModule } from '@nestjs/jwt';
import { PrismaModule } from 'src/core/database/prisma.module';

@Module({
  imports: [PrismaModule, JwtModule],
  providers: [BookingGateway, BookingService],
})
export class BookingModule {}
