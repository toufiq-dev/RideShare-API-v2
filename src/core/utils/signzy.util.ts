import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

@Injectable()
export class SignzyService {
  private readonly productionAccessToken: string;
  private readonly preproductionAccessToken: string;
  private readonly drivingLicenseEndPoint: string;

  constructor(private readonly configService: ConfigService) {
    this.productionAccessToken = this.configService.get<string>(
      'signzy.productionAccessToken',
    );
    this.preproductionAccessToken = this.configService.get<string>(
      'signzy.preproductionAccessToken',
    );
    this.drivingLicenseEndPoint = this.configService.get<string>(
      'signzy.drivingLicenseEndPoint',
    );
  }

  async verifyDrivingLicense(dlNumber: string, dob: string) {
    const url = this.drivingLicenseEndPoint;
    const data = {
      number: dlNumber,
      dob: dob.split('-').join('/'),
    };

    try {
      const response = await axios.post(url, data, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: this.productionAccessToken,
        },
      });

      return response.data.result;
    } catch (error) {
      throw new BadRequestException(
        'Failed to verify driving license with Signzy API.',
      );
    }
  }
}
