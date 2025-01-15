import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as https from 'https';

@Injectable()
export class Msg91Util {
  private readonly authKey: string;
  private readonly templateId: string;

  constructor(private readonly configService: ConfigService) {
    this.authKey = this.configService.get<string>('MSG91_AUTH_KEY');
    this.templateId = this.configService.get<string>('MSG91_TEMPLATE_ID');
  }

  private async makeRequest(
    options: https.RequestOptions,
    payload?: string,
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      const req = https.request(options, (res) => {
        const chunks: Buffer[] = [];

        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => {
          const response = Buffer.concat(chunks).toString();
          try {
            const parsedResponse = JSON.parse(response);
            resolve(parsedResponse);
          } catch (err) {
            reject(new Error(`Failed to parse response: ${response}`));
          }
        });
      });

      req.on('error', (err) => {
        reject(err);
      });

      if (payload) {
        req.write(payload);
      }

      req.end();
    });
  }

  async sendOtp(phone: string, otpExpiry = 5): Promise<void> {
    const options = {
      method: 'POST',
      hostname: 'control.msg91.com',
      path: `/api/v5/otp?otp_expiry=${otpExpiry}&template_id=${this.templateId}&mobile=${phone}&authkey=${this.authKey}`,
      headers: {
        'Content-Type': 'application/JSON',
      },
    };

    console.log('Sending OTP to phone:', phone);
    const response = await this.makeRequest(options);
    if (response.type !== 'success') {
      console.error('Failed to send OTP:', response);
      throw new Error(response.message || 'Failed to send OTP');
    }
    console.log('OTP sent successfully:', response);
  }

  async verifyOtp(phone: string, otp: string): Promise<boolean> {
    const options = {
      method: 'GET',
      hostname: 'control.msg91.com',
      path: `/api/v5/otp/verify?otp=${otp}&mobile=${phone}`,
      headers: {
        authkey: this.authKey,
      },
    };

    console.log('Verifying OTP for phone:', phone);
    const response = await this.makeRequest(options);
    if (response.type === 'success') {
      console.log('OTP verified successfully:', response);
      return true;
    } else {
      console.error('OTP verification failed:', response);
      throw new Error(response.message || 'OTP verification failed');
    }
  }
}
