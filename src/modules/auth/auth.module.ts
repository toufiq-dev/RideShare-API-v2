import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { OTPService } from 'src/core/utils/otp.util';
import { RideModule } from '../ride/ride.module';
import { GeofencingModule } from 'src/core/geofencing/geofencing.module';

@Module({
  imports: [RideModule, GeofencingModule],
  providers: [AuthService, OTPService],
  controllers: [AuthController],
})
export class AuthModule {}
