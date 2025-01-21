import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class DrivingLicenseAndDboDto {
  @ApiProperty({ description: 'Driving license number' })
  @IsNotEmpty({ message: 'Driving license number is required' })
  @IsString()
  drivingLicenseNumber: string;

  @ApiProperty({ description: 'Date of birth' })
  @IsNotEmpty({ message: 'Date of birth is required' })
  @IsString()
  dob: string;
}
