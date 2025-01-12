import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { TwilioUtil } from 'src/core/utils/twilio.util';

@Module({
  providers: [AuthService, TwilioUtil],
  controllers: [AuthController],
})
export class AuthModule {}
