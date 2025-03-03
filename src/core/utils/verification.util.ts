import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import formatDate from 'src/common/functions/formatDate';
import { VerificationResponseVehicle } from 'src/modules/pilot/interfaces/pilot.interface';
import * as moment from 'moment-timezone';
import OpenAI from 'openai';

type VehicleCategory =
  | 'Hatchback'
  | 'Sedan'
  | 'SUV'
  | 'Kali Peeli'
  | 'Auto-Rickshaw';

@Injectable()
export class VerificationService {
  private readonly productionAccessToken: string;
  private readonly preproductionAccessToken: string;
  private readonly drivingLicenseEndPoint: string;
  private readonly drivingLicenseEndPointPreproduction: string;
  private readonly panVerifyEndPoint: string;
  private readonly panVerifyEndPointPreproduction: string;
  private readonly rcVerifyEndPoint: string;
  private readonly rcVerifyEndPointPreproduction: string;
  private readonly rcToName: string;
  private readonly rcVerifyBasic: string;
  private readonly getAadhaar: string;
  private readonly getAadhaarPreproduction: string;
  private readonly sendOtpEndPoint: string;
  private readonly verifyAadhaarEndPoint: string;
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly openAiApiKey: string;

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
    this.panVerifyEndPointPreproduction = this.configService.get<string>(
      'signzy.panVerifyEndPointPreproduction',
    );
    this.rcVerifyEndPoint = this.configService.get<string>(
      'signzy.rcVerifyEndPoint',
    );
    this.rcVerifyEndPointPreproduction = this.configService.get<string>(
      'signzy.rcVerifyEndPointPreproduction',
    );
    this.rcVerifyBasic = this.configService.get<string>('signzy.rcVerifyBasic');
    this.getAadhaar = this.configService.get<string>('signzy.getAadhaar');
    this.getAadhaarPreproduction = this.configService.get<string>(
      'signzy.getAadhaarPreproduction',
    );
    this.sendOtpEndPoint = this.configService.get<string>(
      'cashfree.sendOtpEndPoint',
    );
    this.verifyAadhaarEndPoint = this.configService.get<string>(
      'cashfree.verifyAadhaarEndPoint',
    );
    this.clientId = this.configService.get<string>('cashfree.clientId');
    this.clientSecret = this.configService.get<string>('cashfree.clientSecret');
    this.openAiApiKey = this.configService.get<string>('OPENAI_API_KEY');
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
        !result.dlValidity.transport.to &&
        !result.dlValidity.transport.from
      ) {
        throw new BadRequestException(
          'Driver does not have a valid transport license.',
        );
      }

      let isExpired = false;
      if (result.dlValidity.transport.to) {
        const expiryDateUTC = moment.utc(
          formatDate(result.dlValidity.transport.to),
        );
        const nowUTC = moment.utc();
        const expiryDateIST = expiryDateUTC.tz('Asia/Kolkata');
        const nowIST = nowUTC.tz('Asia/Kolkata');
        isExpired = expiryDateIST.isBefore(nowIST);
      }

      return {
        ...response.data.result,
        isExpired,
      };
    } catch (error) {
      console.error(error);
      throw new BadRequestException(
        'Failed to verify driving license with Signzy API.',
      );
    }
  }

  async verifyPancard(panNumber: string) {
    const data = {
      number: panNumber,
    };

    try {
      const response = await axios.post(
        this.panVerifyEndPointPreproduction,
        data,
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: this.preproductionAccessToken,
          },
        },
      );

      return response.data.result;
    } catch (error) {
      throw new BadRequestException(
        'Failed to verify Pancard with Signzy API.',
      );
    }
  }

  async verifyVehicleRC(
    registrationNumber: string,
  ): Promise<VerificationResponseVehicle | any> {
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

      console.log(responseRc.data.result.status.toLowerCase())      
      if (responseRc.data.result.status.toLowerCase() !== 'active') {
        throw new BadRequestException(
          'vehicle registration number is not active.',
        );
      }

      const responseBasic = await axios.post(this.rcVerifyBasic, data, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: this.productionAccessToken,
        },
      });

      // Check if rc or permit is expired
      let isrcExpired = false;
      let ispermitExpired = false;
      if (responseRc.data.result.rcExpiryDate) {
        const rcexpiryDateUTC = moment.utc(
          formatDate(responseRc.data.result.rcExpiryDate),
        );
        const permitexpiryDateUTC = moment.utc(
          formatDate(responseRc.data.result.permitValidUpto),
        );
        const nowUTC = moment.utc();
        const rcexpiryDateIST = rcexpiryDateUTC.tz('Asia/Kolkata');
        const pemitexpiryDateIST = permitexpiryDateUTC.tz('Asia/Kolkata');
        const nowIST = nowUTC.tz('Asia/Kolkata');
        isrcExpired = rcexpiryDateIST.isBefore(nowIST);
        ispermitExpired = pemitexpiryDateIST.isBefore(nowIST);
      }

      console.log(isrcExpired)
      console.log(ispermitExpired)
      
      if (isrcExpired) {
        return {
          message: 'Vehicle registration or permit is expired.',
          data: {
            id: null,
            pilotId: null,
            regNo: null,
            vehicleTypeId: null,
            createdAt: null,
            updatedAt: null,
          },
        };
      }

      const category = await this.classifyVehicleUsingOpenAI(responseRc);
      
      return {
        category,
        regNo: responseRc.data.result.regNo,
        regUpto: formatDate(responseRc.data.result.rcExpiryDate),
        permitUpto: formatDate(responseRc.data.result.permitValidUpto),
        status: responseRc.data.result.status,
        manufacturer: responseRc.data.result.vehicleManufacturerName,
        model: responseRc.data.result.model,
        colour: responseRc.data.result.vehicleColour,
        seatCapacity: responseRc.data.result.vehicleSeatCapacity,
        state: responseBasic.data.result.stateCode,
        insuranceUpto: formatDate(responseRc.data.result.vehicleInsuranceUpto),
        fitUpto: formatDate(responseBasic.data.result.fitUpto),
        puccUpto: formatDate(responseRc.data.result.puccUpto),
      };
    } catch (error) {
      console.log(error);
      throw new BadRequestException(
        'Failed to verify vehicle rc number with Signzy API.',
      );
    }
  }

  // Signzy
  // async verifyAadhaar(requestId: string) {
  //   try {
  //     const response = await axios.post(
  //       this.getAadhaarPreproduction,
  //       requestId,
  //       {
  //         headers: {
  //           'Content-Type': 'application/json',
  //           Authorization: this.preproductionAccessToken,
  //         },
  //       },
  //     );

  //     console.log(response.data.result);

  //     return response.data.result;
  //   } catch (error) {
  //     throw new BadRequestException(
  //       'Failed to verify aadhaar with Signzy API.',
  //     );
  //   }
  // }

  async sendOtpToverifyAadhaar(aadhaar_number: string) {
    const data = {
      aadhaar_number,
    };

    try {
      const response = await axios.post(this.sendOtpEndPoint, data, {
        headers: {
          'Content-Type': 'application/json',
          'x-client-id': this.clientId,
          'x-client-secret': this.clientSecret,
        },
      });

      return response.data;
    } catch (error) {
      throw new BadRequestException(
        'Failed to verify aadhaar with Cashfree API.',
      );
    }
  }

  async verifyAadhaar(ref_id: string, otp: string) {
    const data = {
      ref_id,
      otp,
    };

    try {
      const response = await axios.post(this.verifyAadhaarEndPoint, data, {
        headers: {
          'Content-Type': 'application/json',
          'x-client-id': this.clientId,
          'x-client-secret': this.clientSecret,
        },
      });

      return response.data;
    } catch (error) {
      throw new BadRequestException(
        'Failed to verify aadhaar with Cashfree API.',
      );
    }
  }

  private async classifyVehicleUsingOpenAI(
    vehicleDetails: any,
  ): Promise<VehicleCategory> {
    const openai = new OpenAI({
      apiKey: this.openAiApiKey,
    });

    const prompt = `
      You are an expert in vehicle classification for a Mumbai-based taxi booking application. 
      Based on the following vehicle details, categorize the vehicle into one of these types: 
      Hatchback, Sedan, SUV, Kali Peeli, or Auto-Rickshaw. You must categorize the car into one
      of these types.

      Vehicle Details:
      ${vehicleDetails}

      Provide the category as a single word (e.g., "Hatchback", "Sedan", "SUV", "Kali Peeli" or "Auto-Rickshaw").
    `;

    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: 'You are a vehicle classification expert.',
          },
          { role: 'user', content: prompt },
        ],
        max_tokens: 10, // Limit response to a single category
        temperature: 0.3, // Lower temperature for more deterministic output
      });

      const category =
        response.choices[0].message.content.trim() as VehicleCategory;


      console.log(response.choices[0].message)

      return category;
    } catch (error) {
      console.error('Error calling OpenAI:', error);
    }
  }
}
