import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import axios from 'axios';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class Msg91Util {
  private readonly baseUrl = 'https://control.msg91.com/api/v5';
  private readonly authKey: string;
  private readonly templateId: string;
  private readonly senderId: string;

  constructor(private configService: ConfigService) {
    this.authKey = this.configService.get<string>('msg91.authKey');
    this.templateId = this.configService.get<string>('msg91.templateId');
    this.senderId = this.configService.get<string>('msg91.senderId');
  }

  async sendOTP(mobile: string): Promise<{ requestId: string }> {
    try {
      const response = await axios.get(`${this.baseUrl}/otp`, {
        params: {
          otp_expiry: 2, // OTP expiry in minutes
          template_id: this.templateId,
          mobile,
          authkey: this.authKey,
        },
      });

      if (response.data.type === 'success') {
        return {
          requestId: response.data.request_id,
        };
      }

      throw new HttpException('Failed to send OTP', HttpStatus.BAD_REQUEST);
    } catch (error) {
      throw new HttpException(
        error.response?.data?.message || 'Failed to send OTP',
        error.response?.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async verifyOTP(
    mobile: string,
    otp: string,
    requestId: string,
  ): Promise<boolean> {
    try {
      const response = await axios.get(`${this.baseUrl}/otp/verify`, {
        params: {
          mobile,
          otp,
          authkey: this.authKey,
          request_id: requestId,
        },
      });

      return response.data.type === 'success';
    } catch (error) {
      throw new HttpException(
        error.response?.data?.message || 'Failed to verify OTP',
        error.response?.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
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
      throw new HttpException(
        error.response?.data?.message || 'Failed to resend OTP',
        error.response?.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
