import { ApiProperty } from '@nestjs/swagger';
import { VehicleTypeNameBD } from '@prisma/client';
import { IsEnum, IsNotEmpty } from 'class-validator';

export class GetLeaderboardDto {
  @ApiProperty({
    description: 'Vehicle type for segmented leaderboard',
    enum: VehicleTypeNameBD,
    required: true,
  })
  @IsNotEmpty()
  @IsEnum(VehicleTypeNameBD)
  vehicleType: VehicleTypeNameBD;
}

export enum EligibilityStatus {
  ELIGIBLE = 'ELIGIBLE',
  NOT_ELIGIBLE = 'NOT_ELIGIBLE',
}
