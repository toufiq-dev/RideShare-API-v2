import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import axios from 'axios';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class OTPService {
  private readonly baseUrl: string;
  private readonly authKey: string;
  private readonly templateId: string;
  private readonly senderId: string;

  constructor(private configService: ConfigService) {
    this.baseUrl = this.configService.get<string>('msg91.baseUrl');
    this.authKey = this.configService.get<string>('msg91.authKey');
    this.templateId = this.configService.get<string>('msg91.templateId');
    this.senderId = this.configService.get<string>('msg91.senderId');
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
