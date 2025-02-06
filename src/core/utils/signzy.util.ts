import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import formatDate from 'src/common/functions/formatDate';
import { VerificationResponseVehicle } from 'src/modules/pilot/interfaces/pilot.interface';

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
  private readonly rcVerifyBasic: string;

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
    this.rcVerifyBasic = this.configService.get<string>('signzy.rcVerifyBasic');
  }

  async verifyDrivingLicense(dlNumber: string, dob: string) {
    const data = {
      number: dlNumber,
      dob: dob.split('-').join('/'),
    };

    try {
      const response = await axios.post(
        this.drivingLicenseEndPointPreproduction,
        data,
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: this.preproductionAccessToken,
          },
        },
      );

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
    const data = {
      pan,
      name,
      dob: dob.split('-').join('/'),
    };

    try {
      const response = await axios.post(this.panVerifyEndPoint, data, {
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

  async verifyVehicleRC(
    registrationNumber: string,
  ): Promise<VerificationResponseVehicle> {
    const data = {
      vehicleNumber: registrationNumber,
    };

    try {
      const responseRc = await axios.post(
        this.rcVerifyEndPointPreproduction,
        data,
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: this.preproductionAccessToken,
          },
        },
      );

      const responseBasic = await axios.post(this.rcVerifyBasic, data, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: this.productionAccessToken,
        },
      });

      const responseRcToName = await axios.post(
        this.rcToNamePreproduction,
        data,
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: this.preproductionAccessToken,
          },
        },
      );

      return {
        regNo: responseRc.data.result.regNo,
        status: responseRc.data.result.status,
        insuranceUpto: formatDate(responseRc.data.result.vehicleInsuranceUpto),
        fitUpto: formatDate(responseBasic.data.result.fitUpto),
        puccUpto: formatDate(responseRc.data.result.puccUpto),
        rcExpiryDate: formatDate(responseRc.data.result.rcExpiryDate),
        permitUpto: formatDate(responseRc.data.result.permitValidUpto),
        manufacturer: responseRc.data.result.vehicleManufacturerName,
        makerModel: responseRc.data.result.makerModel,
        vehicleColour: responseRc.data.result.vehicleColour,
        vehicleState: responseRcToName.data.result.vehicleState,
        vehicleSeatingCapacity:
          responseRcToName.data.result.vehicleSeatingCapacity,
        vehicleClass: responseRcToName.data.result.vehicleClass,
      };
    } catch (error) {
      console.log(error);
      throw new BadRequestException(
        'Failed to verify vehicle rc number with Signzy API.',
      );
    }
  }
}
