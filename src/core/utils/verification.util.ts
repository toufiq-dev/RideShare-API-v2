import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import formatDate from 'src/common/functions/formatDate';
import { VerificationResponseVehicle } from 'src/modules/pilot/interfaces/pilot.interface';
import moment from 'moment-timezone';
import OpenAI from 'openai';
import { PrismaService } from '../database/prisma.service';
import { VehicleTypeName } from '@prisma/client';

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

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
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
      'cashfreeAadhaar.sendOtpEndPoint',
    );
    this.verifyAadhaarEndPoint = this.configService.get<string>(
      'cashfreeAadhaar.verifyAadhaarEndPoint',
    );
    this.clientId = this.configService.get<string>('cashfreeAadhaar.clientId');
    this.clientSecret = this.configService.get<string>(
      'cashfreeAadhaar.clientSecret',
    );
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

      if (responseRc.data.result.status.toLowerCase() !== 'active') {
        throw new BadRequestException('Vehicle status is not active');
      }

      // Check if rc or permit is expired
      let isrcExpired = false;
      if (!responseRc.data.result.rcExpiryDate) {
        throw new BadRequestException(
          'Vehicle registration or permit is expired.',
        );
      }

      const rcexpiryDateUTC = moment.utc(
        formatDate(responseRc.data.result.rcExpiryDate),
      );
      const nowUTC = moment.utc();
      const rcexpiryDateIST = rcexpiryDateUTC.tz('Asia/Kolkata');
      const nowIST = nowUTC.tz('Asia/Kolkata');
      isrcExpired = rcexpiryDateIST.isBefore(nowIST);

      if (isrcExpired) {
        return {
          verificationFailed: true,
          regNo: responseRc.data.result.regNo,
          regUpto: formatDate(responseRc.data.result.rcExpiryDate),
          permitUpto: formatDate(responseRc.data.result.permitValidUpto),
          status: responseRc.data.result.status,
          manufacturer: responseRc.data.result.vehicleManufacturerName,
          model: responseRc.data.result.model,
          colour: responseRc.data.result.vehicleColour,
          seatCapacity: responseRc.data.result.vehicleSeatCapacity,
          state: responseBasic.data.result.stateCode,
          insuranceUpto: formatDate(
            responseRc.data.result.vehicleInsuranceUpto,
          ),
          fitUpto: formatDate(responseBasic.data.result.fitUpto),
          puccUpto: formatDate(responseRc.data.result.puccUpto),
        };
      }

      let category = await this.categoryExists(responseRc.data.result);
      if (!category) {
        category = await this.classifyVehicleUsingOpenAI(
          responseRc.data.result,
        );
      }

      return {
        verificationFailed: false,
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
        error.message || 'Failed to verify vehicle RC with Signzy API.',
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
      console.error(error);
      throw new BadRequestException(error?.response?.data?.message);
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
      console.error(error);
      throw new BadRequestException(error?.response?.data?.message);
    }
  }

  private async classifyVehicleUsingOpenAI(
    vehicleData: any,
  ): Promise<VehicleTypeName> {
    const openai = new OpenAI({
      apiKey: this.openAiApiKey,
    });
    const prompt = `
      You are an expert in vehicle classification for a Mumbai-based taxi booking application. 
      Based on the following vehicle details, categorize the following vehicle into one of these types:
      Hatch back, Sedan, SUV, Kali Peeli, or Auto-Rickshaw.

      Vehicle Details:
      - Class: ${vehicleData.class}
      - Manufacturer: ${vehicleData.vehicleManufacturerName}
      - Model: ${vehicleData.model}
      - Body Type: ${vehicleData.bodyType}
      - Category: ${vehicleData.vehicleCategory}
      - Seating Capacity: ${vehicleData.vehicleSeatCapacity}
      - Permit type: ${vehicleData.permitType}
      - Is Commercial: ${vehicleData.isCommercial}

      Reply with a **single word** like this (HATCHBACK, SEDAN, SUV, KALIPEELI, or AUTORICKSHAW).
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
        response.choices[0].message.content.trim() as VehicleTypeName;

      await this.prisma.vehicleClassificationCache.create({
        data: {
          class: vehicleData.class,
          manufacturer: vehicleData.vehicleManufacturerName,
          model: vehicleData.model,
          bodyType: vehicleData.bodyType,
          vehicleCategory: vehicleData.vehicleCategory,
          seatCapacity: vehicleData.vehicleSeatCapacity,
          permitType: vehicleData.permitType,
          isCommercial: vehicleData.isCommercial,
          category,
        },
      });

      return category;
    } catch (error) {
      console.error('Error calling OpenAI:', error);
      return VehicleTypeName.OTHER;
    }
  }

  private async categoryExists(vehicleData: any): Promise<VehicleTypeName> {
    const cached = await this.prisma.vehicleClassificationCache.findUnique({
      where: {
        class_manufacturer_model_bodyType_vehicleCategory_seatCapacity_permitType_isCommercial:
          {
            class: vehicleData.class,
            manufacturer: vehicleData.vehicleManufacturerName,
            model: vehicleData.model,
            bodyType: vehicleData.bodyType,
            vehicleCategory: vehicleData.vehicleCategory,
            seatCapacity: vehicleData.vehicleSeatCapacity,
            permitType: vehicleData.permitType,
            isCommercial: vehicleData.isCommercial,
          },
      },
    });

    if (cached) {
      return cached.category as VehicleTypeName;
    }

    return null;
  }
}
