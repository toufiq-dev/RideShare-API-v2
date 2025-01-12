import {
  IsString,
  IsNotEmpty,
  IsPhoneNumber,
  IsEmail,
  Length,
  IsEnum,
} from 'class-validator';

export class SendOtpDto {
  @IsString()
  @IsNotEmpty()
  languageId: string;

  @IsPhoneNumber()
  @IsNotEmpty()
  phone: string;
}

export class VerifyOtpDto {
  @IsPhoneNumber()
  @IsNotEmpty()
  phone: string;

  @IsString()
  @Length(6, 6)
  otp: string;

  @IsEnum(['CUSTOMER', 'PILOT'], {
    message: 'Role must be either CUSTOMER or PILOT',
  })
  role: 'CUSTOMER' | 'PILOT';
}

export class CompleteCustomerOnboardingDto {
  @IsPhoneNumber()
  @IsNotEmpty()
  phone: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsEmail()
  @IsNotEmpty()
  email: string;
}
