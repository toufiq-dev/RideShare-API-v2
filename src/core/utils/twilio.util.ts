import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Twilio from 'twilio';

@Injectable()
export class TwilioUtil {
  private client: Twilio.Twilio;
  private readonly messagingServiceSid: string;
  private readonly fromPhoneNumber: string;

  constructor(private readonly configService: ConfigService) {
    const accountSid = this.configService.get<string>('twilio.accountSid');
    const authToken = this.configService.get<string>('twilio.authToken');
    this.messagingServiceSid = this.configService.get<string>(
      'twilio.messagingServiceSid',
    );
    this.fromPhoneNumber = this.configService.get<string>('twilio.fromNumber');

    this.client = Twilio(accountSid, authToken);
  }

  async sendOtp(phone: string, otp: string): Promise<void> {
    const response = await this.client.messages.create({
      body: `Your verification code for FairDrive Onboarding is ${otp}`,
      to: phone,
      messagingServiceSid: this.messagingServiceSid,
      // from: this.fromPhoneNumber,
    });

    console.log('From Twilio:');
    console.log(response);
  }

  async verifyOtp(
    phone: string,
    serviceSid: string,
    code: string,
  ): Promise<boolean> {
    const result = await this.client.verify.v2
      .services(serviceSid)
      .verificationChecks.create({ to: phone, code });
    return result.status === 'approved';
  }
}
