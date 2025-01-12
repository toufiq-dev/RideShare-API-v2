import {
  IsString,
  IsNotEmpty,
  IsPhoneNumber,
  IsEmail,
  Length,
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
  // @Length(6, 6)
  otp: string;
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
