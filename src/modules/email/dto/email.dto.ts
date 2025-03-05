import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class sendOtpDto {
  @ApiProperty({ description: 'Email' })
  @IsString()
  @IsNotEmpty()
  email: string;
}

export class VerifyEmailDto {
  @ApiProperty({ description: 'Email' })
  @IsString()
  @IsNotEmpty()
  otp: string;
}
