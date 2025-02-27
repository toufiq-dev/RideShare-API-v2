import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { OTPService } from 'src/core/utils/otp.util';
import { RideModule } from '../ride/ride.module';

@Module({
  imports: [RideModule],
  providers: [AuthService, OTPService],
  controllers: [AuthController],
})
export class AuthModule {}
