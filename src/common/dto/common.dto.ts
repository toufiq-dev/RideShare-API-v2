import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsPhoneNumber, Length } from 'class-validator';

export class UpdatePhoneDto {
  @ApiProperty({ description: 'Phone number' })
  @IsNotEmpty({ message: 'Phone number is required' })
  @IsPhoneNumber('IN')
  phone: string;
}

export class VerifyPhoneDto {
  @ApiProperty({ description: 'Phone number' })
  @IsNotEmpty({ message: 'Phone number is required' })
  @IsPhoneNumber('IN')
  phone: string;

  @ApiPropertyOptional({ description: 'OTP' })
  @IsString()
  @Length(4, 4)
  otp: string;
}
