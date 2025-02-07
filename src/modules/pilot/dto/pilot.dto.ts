import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class DrivingLicenseDto {
  @ApiProperty({ description: 'Driving license number' })
  @IsNotEmpty({ message: 'Driving license number is required' })
  @IsString()
  drivingLicenseNumber: string;

  @ApiProperty({ description: 'Date of birth' })
  @IsNotEmpty({ message: 'Date of birth is required' })
  @IsString()
  dob: string;
}

export class VehicleRcDto {
  @ApiProperty({ description: 'Vehicle registration number' })
  @IsNotEmpty({ message: 'Vehicle registration number is required' })
  @IsString()
  registrationNumber: string;
}

export class PancardDto {
  @ApiProperty({ description: 'Pan card number' })
  @IsNotEmpty({ message: 'Pan card number is required' })
  @IsString()
  panNumber: string;
}
