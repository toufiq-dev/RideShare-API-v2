import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class EmailSendOtpDto {
  @ApiProperty({ description: 'Email' })
  @IsString()
  @IsNotEmpty()
  email: string;
}

export class EmailVerifyEmailDto {
  @ApiProperty({ description: 'Email' })
  @IsString()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ description: 'OTP' })
  @IsString()
  @IsNotEmpty()
  otp: string;
}
