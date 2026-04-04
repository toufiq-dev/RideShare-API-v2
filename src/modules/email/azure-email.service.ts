import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EmailClient } from '@azure/communication-email';

@Injectable()
export class AzureEmailService {
  private emailClient: EmailClient;
  private senderAddress: string;
  private connectionString: string;

  constructor(private configService: ConfigService) {
    this.connectionString = this.configService.get<string>(
      'azure.communication.connectionString',
    );
    this.senderAddress = this.configService.get<string>(
      'azure.communication.senderAddress',
    );

    this.emailClient = new EmailClient(this.connectionString);
  }

  async sendOtpEmail(email: string, otp: string): Promise<boolean> {
    try {
      const emailMessage = {
        senderAddress: this.senderAddress,
        content: {
          subject: 'Fairdrive OTP',
          plainText: `Your OTP is: ${otp}`,
          html: `
            <div style="font-family: Arial, sans-serif; padding: 20px;">
              <h2>Fairdrive Email Verification</h2>
              <p>Your One-Time Password (OTP) is:</p>
              <h3 style="color: #2c3e50;">${otp}</h3>
              <p>This OTP is valid for 1 minute.</p>
              <p>If you didn't request this, please ignore this email.</p>
            </div>
          `,
        },
        recipients: {
          to: [{ address: email }],
        },
      };

      const poller = await this.emailClient.beginSend(emailMessage);
      const result = await poller.pollUntilDone();
      if (result.status === 'Succeeded') {
        return true;
      } else {
        return false;
      }
    } catch (error) {
      console.error('Azure Email Error:', error);
      throw error;
    }
  }
}
