import axios from 'axios';
import { ConfigService } from '@nestjs/config';
import { Injectable, HttpException, HttpStatus } from '@nestjs/common';

@Injectable()
export class OTPService {
  private readonly baseUrl: string;
  private readonly authKey: string;
  private readonly templateId: string;
  private readonly senderId: string;
  private readonly khudebartaBaseUrl: string;
  private readonly khudebartaAPIKey: string;
  private readonly khudebartaSecretKey: string;
  private readonly khudebartaSenderId: string;

  constructor(private configService: ConfigService) {
    this.baseUrl = this.configService.get<string>('msg91.baseUrl');
    this.authKey = this.configService.get<string>('msg91.authKey');
    this.templateId = this.configService.get<string>('msg91.templateId');
    this.senderId = this.configService.get<string>('msg91.senderId');

    this.khudebartaBaseUrl =
      this.configService.get<string>('khudebarta.baseUrl');
    this.khudebartaAPIKey = this.configService.get<string>('khudebarta.apiKey');
    this.khudebartaSecretKey = this.configService.get<string>(
      'khudebarta.secretKey',
    );
    this.khudebartaSenderId = this.configService.get<string>(
      'khudebarta.senderId',
    );
  }

  async sendOTPBD(mobile: string, otp: string) {
    mobile = mobile.replace('+', '');

    const message = `OTP for FairDrive is ${otp} and valid till 2 minutes. Do not share this OTP to anyone for security reasons.`;

    const requestBody = [
      {
        callerID: this.khudebartaSenderId,
        toUser: mobile,
        messageContent: message,
      },
    ];

    try {
      const response = await axios.get(`${this.khudebartaBaseUrl}`, {
        params: {
          apikey: this.khudebartaAPIKey,
          secretkey: this.khudebartaSecretKey,
          content: JSON.stringify(requestBody),
        },
      });

      const responseData = response.data;

      if (responseData.Status === '0') {
        return true;
      }

      return false;
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  async sendOTP(mobile: string) {
    mobile = mobile.replace('+', '');

    try {
      const response = await axios.get(`${this.baseUrl}/otp`, {
        params: {
          otp_expiry: 2, // OTP expiry in minutes
          template_id: this.templateId,
          mobile,
          authkey: this.authKey,
        },
      });

      // const response = await axios.get(`https://control.msg91.com/api/v5/otp?otp_expiry=2&template_id=${this.templateId}&mobile=${mobile}&authkey=${this.authKey}`);

      return response.data.request_id;
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  async verifyOTP(mobile: string, otp: string, requestId: string) {
    try {
      const response = await axios.get(`${this.baseUrl}/otp/verify`, {
        params: {
          mobile,
          otp,
          authkey: this.authKey,
          request_id: requestId,
        },
      });

      console.log(response.data);

      return response.data.type === 'success';
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  async resendOTP(
    mobile: string,
    requestId: string,
  ): Promise<{ requestId: string }> {
    try {
      const response = await axios.get(`${this.baseUrl}/otp/resend`, {
        params: {
          mobile,
          authkey: this.authKey,
          request_id: requestId,
        },
      });

      if (response.data.type === 'success') {
        return {
          requestId: response.data.request_id,
        };
      }

      throw new HttpException('Failed to resend OTP', HttpStatus.BAD_REQUEST);
    } catch (error) {
      console.error(error);
      throw error;
    }
  }
}
