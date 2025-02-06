import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

@Injectable()
export class SignzyService {
  private readonly productionAccessToken: string;
  private readonly preproductionAccessToken: string;
  private readonly drivingLicenseEndPoint: string;
  private readonly drivingLicenseEndPointPreproduction: string;
  private readonly panVerifyEndPoint: string;
  private readonly rcVerifyEndPoint: string;
  private readonly rcVerifyEndPointPreproduction: string;
  private readonly rcToName: string;
  private readonly rcToNamePreproduction: string;

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
    this.drivingLicenseEndPointPreproduction = this.configService.get<string>(
      'signzy.drivingLicenseEndPointPreproduction',
    );
    this.panVerifyEndPoint = this.configService.get<string>(
      'signzy.panVerifyEndPoint',
    );
    this.rcVerifyEndPoint = this.configService.get<string>(
      'signzy.rcVerifyEndPoint',
    );
    this.rcVerifyEndPointPreproduction = this.configService.get<string>(
      'signzy.rcVerifyEndPointPreproduction',
    );
    this.rcToName = this.configService.get<string>('signzy.rcToName');
    this.rcToNamePreproduction = this.configService.get<string>(
      'signzy.rcToNamePreproduction',
    );
  }

  async verifyDrivingLicense(dlNumber: string, dob: string) {
    const url = this.drivingLicenseEndPointPreproduction;
    const data = {
      number: dlNumber,
      dob: dob.split('-').join('/'),
    };

    try {
      const response = await axios.post(url, data, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: this.preproductionAccessToken,
        },
      });

      const result = response.data.result;

      if (
        !result.dlValidity.transport.to ||
        !result.dlValidity.transport.from
      ) {
        throw new BadRequestException(
          'Driver does not have a valid transport license.',
        );
      }

      return response.data.result;
    } catch (error) {
      throw new BadRequestException(
        'Failed to verify driving license with Signzy API.',
      );
    }
  }

  async verifyPancard(pan: string, name: string, dob: string) {
    const url = this.panVerifyEndPoint;

    const data = {
      pan,
      name,
      dob: dob.split('-').join('/'),
    };

    try {
      const response = await axios.post(url, data, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: this.preproductionAccessToken,
        },
      });

      return response.data.result;
    } catch (error) {
      throw new BadRequestException(
        'Failed to verify driving license with Signzy API.',
      );
    }
  }

  async verifyVehicleRC(registrationNumber: string) {
    const url = this.rcVerifyEndPointPreproduction;
    const data = {
      vehicleNumber: registrationNumber,
    };

    try {
      const response = await axios.post(url, data, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: this.preproductionAccessToken,
        },
      });

      return response.data.result;
    } catch (error) {
      console.log(error);
      throw new BadRequestException(
        'Failed to verify vehicle rc number with Signzy API.',
      );
    }
  }

  async getRcToName(registrationNumber: string) {
    const url = this.rcToNamePreproduction;
    const data = {
      vehicleNumber: registrationNumber,
    };

    try {
      const response = await axios.post(url, data, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: this.preproductionAccessToken,
        },
      });

      return response.data.result;
    } catch (error) {
      throw new BadRequestException(
        'Failed to get vehicle name from Signzy API.',
      );
    }
  }
}
