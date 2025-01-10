import { IsString, IsNotEmpty, Matches } from 'class-validator';

export class RegisterPilotDto {
  @IsString()
  @IsNotEmpty()
  phone: string;

  @IsString()
  @IsNotEmpty()
  language: string;
}
