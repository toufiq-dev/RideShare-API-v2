import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Injectable } from '@nestjs/common';
import { EmailService } from '../email.service';

@Processor('otp-email')
@Injectable()
export class OtpEmailProcessor extends WorkerHost {
  constructor(private readonly emailService: EmailService) {
    super();
  }

  async process(job: Job): Promise<any> {
    const { sendOtpDto, userId } = job.data;

    return this.emailService._sendOtpEmail(sendOtpDto, userId);
  }
}
