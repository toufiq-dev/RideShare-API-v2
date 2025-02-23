import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { Msg91Util } from 'src/core/utils/msg91.util';
import { RideModule } from '../ride/ride.module';

@Module({
  imports: [RideModule],
  providers: [AuthService, Msg91Util],
  controllers: [AuthController],
})
export class AuthModule {}
