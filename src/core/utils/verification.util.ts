import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import formatDate from 'src/common/functions/formatDate';
import { VerificationResponseVehicle } from 'src/modules/pilot/interfaces/pilot.interface';
import moment from 'moment-timezone';
import { AzureOpenAI } from 'openai';
import { PrismaService } from '../database/prisma.service';
import { VehicleTypeName, VehicleTypeNameBD } from '@prisma/client';

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
  private readonly openai: AzureOpenAI;
  private readonly model: string;

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
    const endpoint = this.configService.get<string>('azure.openai.endpoint');
    const apiKey = this.configService.get<string>('azure.openai.apiKey');
    const modelName = this.configService.get<string>('azure.openai.model');
    const apiVersion = this.configService.get<string>(
      'azure.openai.apiVersion',
    );
    this.openai = new AzureOpenAI({
      endpoint,
      apiKey,
      deployment: modelName,
      apiVersion,
    });
    this.model = modelName;
  }

  private async extractDocumentData(
    buffer: Buffer,
    systemPrompt: string,
    userPrompt: string,
  ) {
    const base64Image = buffer.toString('base64');
    try {
      const response = await this.openai.chat.completions.create({
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: [
              { type: 'text', text: userPrompt },
              {
                type: 'image_url',
                image_url: { url: `data:image/jpeg;base64,${base64Image}` },
              },
            ],
          },
        ],
        max_tokens: 1000,
        temperature: 0.2,
        model: this.model,
        response_format: { type: 'json_object' },
      });

      const content = response.choices[0].message.content;
      if (!content) {
        throw new BadRequestException('Document is not valid or not readable.');
      }
      return JSON.parse(content);
    } catch (error) {
      console.error(error);
      throw new BadRequestException('Failed to verify document.');
    }
  }

  // async extractDLData(buffer: Buffer) {
  //   try {
  //     const base64Image = buffer.toString('base64');

  //     const response = await this.openai.chat.completions.create({
  //       model: 'gpt-4o',
  //       messages: [
  //         {
  //           role: 'system',
  //           content:
  //             'You are an expert in driving license verification. Extract relevant information from the driving license image.',
  //         },
  //         {
  //           role: 'user',
  //           content: [
  //             {
  //               type: 'text',
  //               text: `Extract the Name, Date of Birth, License Number, License Expiry Date from this Bangladeshi driving license and return it as a valid JSON object.
  //               Do not include any markdown formatting or backticks in your response.
  //               The keys should be: name, dateOfBirth, licenseNumber, licenseExpiryDate.
  //               If the driving license is not valid or not readable, return null.`,
  //             },
  //             {
  //               type: 'image_url',
  //               image_url: {
  //                 url: `data:image/jpeg;base64,${base64Image}`,
  //               },
  //             },
  //           ],
  //         },
  //       ],
  //       max_tokens: 1000,
  //       response_format: { type: 'json_object' },
  //     });

  //     const content = response.choices[0].message.content;

  //     if (!content) {
  //       throw new BadRequestException(
  //         'Driving license is not valid or not readable.',
  //       );
  //     }

  //     return JSON.parse(content);
  //   } catch (error) {
  //     console.error(error);
  //     throw new BadRequestException('Failed to verify driving license.');
  //   }
  // }
  // Driving License

  async extractDLData(buffer: Buffer) {
    const systemPrompt =
      'You are an expert in driving license verification and translation.';
    const userPrompt = `
      Extract the Name, Date of Birth, License Number, and License Expiry Date from this Bangladeshi driving license and return it as a valid JSON object.
      The keys should be: name, dateOfBirth, licenseNumber, licenseExpiryDate.
      If any field is in Bengali, translate it to English before returning the JSON.
      If the driving license is not valid or not readable, return null.
      Do not include any markdown formatting or backticks in your response.
    `;
    return this.extractDocumentData(buffer, systemPrompt, userPrompt);
  }

  // async extractNidData(buffer: Buffer) {
  //   try {
  //     const base64Image = buffer.toString('base64');

  //     const response = await this.openai.chat.completions.create({
  //       model: 'gpt-4o',
  //       messages: [
  //         {
  //           role: 'system',
  //           content:
  //             'You are an expert in extracting NID card data. Extract relevant information from the NID image.',
  //         },
  //         {
  //           role: 'user',
  //           content: [
  //             {
  //               type: 'text',
  //               text: `Extract the NID Number, Name and Date of Birth from this Bangladeshi NID card and return it as a valid JSON object.
  //               Do not include any markdown formatting or backticks in your response.
  //               The keys should be: nidNumber, name, dateOfBirth.
  //               If the NID card is not valid or not readable, return null.`,
  //             },
  //             {
  //               type: 'image_url',
  //               image_url: {
  //                 url: `data:image/jpeg;base64,${base64Image}`,
  //               },
  //             },
  //           ],
  //         },
  //       ],
  //       max_tokens: 1000,
  //       response_format: { type: 'json_object' },
  //     });

  //     const content = response.choices[0].message.content;

  //     if (!content) {
  //       throw new BadRequestException('NID card is not valid or not readable.');
  //     }

  //     return JSON.parse(content);
  //   } catch (error) {
  //     console.error(error);
  //     throw new BadRequestException('Failed to verify NID card.');
  //   }
  // }

  // NID Card
  async extractNidData(buffer: Buffer) {
    const systemPrompt =
      'You are an expert in extracting NID card data and translation.';
    const userPrompt = `
      Extract the NID Number, Name and Date of Birth from this Bangladeshi NID card and return it as a valid JSON object.
      The keys should be: nidNumber, name, dateOfBirth.
      If any field is in Bengali, translate it to English before returning the JSON.
      If the NID card is not valid or not readable, return null.
      Do not include any markdown formatting or backticks in your response.
  `;
    return this.extractDocumentData(buffer, systemPrompt, userPrompt);
  }

  // async extractRCData(buffer: Buffer) {
  //   try {
  //     const base64Image = buffer.toString('base64');

  //     const response = await this.openai.chat.completions.create({
  //       model: 'gpt-4o',
  //       messages: [
  //         {
  //           role: 'system',
  //           content: `You are an expert in extracting Bangladeshi RC (Registration Certificate) data.

  //             IMPORTANT: Bangladeshi RC numbers follow this format: [Registration Point] [Bengali Series] [Numbers],

  //             REGISTRATION POINT MAPPING (use these exact codes):
  //             - Dhaka Metro → "DHK METRO"
  //             - Chittagong Metro → "CTG METRO"
  //             - Sylhet Metro → "SYL METRO"
  //             - Khulna Metro → "KHL Metro"
  //             - Rajshahi Metro → "RAJ METRO"
  //             - Bagerhat → "BH"
  //             - Barguna → "BN"
  //             - Barisal → "BR"
  //             - Bhola → "BA"
  //             - Bogra → "BO"
  //             - Bandarban → "BB"
  //             - Chandpur → "CH"
  //             - Chapainawabganj → "CN"
  //             - Chuadanga → "CD"
  //             - Comilla → "CM"
  //             - Cox's Bazar → "CB"
  //             - Dhaka → "DH"
  //             - Dinajpur → "DP"
  //             - Feni → "FP"
  //             - Faridpur → "FN"
  //             - Gaibandha → "GB"
  //             - Gazipur → "GP"
  //             - Gopalganj → "GO"
  //             - Habiganj → "HB"
  //             - Jamalpur → "JM"
  //             - Jessore → "JS"
  //             - Jhenaidah → "JK"
  //             - Joypurhat → "JD"
  //             - Jhalokati → "JP"
  //             - Kishoreganj → "KG"
  //             - Khulna → "KH"
  //             - Kushtia → "KS"
  //             - Kurigram → "KT"
  //             - Lakshmipur → "LP"
  //             - Lalmonirhat → "LH"
  //             - Madaripur → "MP"
  //             - Magura → "MG"
  //             - Manikganj → "MN"
  //             - Mymensingh → "MH"
  //             - Munshiganj → "MB"
  //             - Meherpur → "MS"
  //             - Moulvibazar → "MY"
  //             - Narayanganj → "NG"
  //             - Narsingdi → "NR"
  //             - Narail → "NA"
  //             - Netrokona → "ND"
  //             - Natore → "NT"
  //             - Naogaon → "NK"
  //             - Nilphamari → "NL"
  //             - Noakhali → "NO"
  //             - Pabna → "PB"
  //             - Patuakhali → "PA"
  //             - Pirojpur → "PT"
  //             - Panchagarh → "PJ"
  //             - Rajbari → "RB"
  //             - Rajshahi → "RM"
  //             - Rangpur → "RP"
  //             - Satkhira → "SK"
  //             - Sirajganj → "SP"
  //             - Sunamganj → "SH"
  //             - Shariatpur → "SG"
  //             - Sylhet → "SU"
  //             - Tangail → "TG"
  //             - Thakurgaon → "Tk"

  //             BENGALI SERIES CODES:
  //             - ক (KA) - Private cars
  //             - খ (KHA) - Private cars
  //             - গ (GA) - Private cars
  //             - ঘ (GHA) - Jeep
  //             - চ (CHA) - Microbus
  //             - ছ (CHHA) - Rented microbuses
  //             - প (PA) - Taxi cabs
  //             - ভ (BHA) - Private cars
  //             - ম (MA) - Commercial pick-up
  //             - ধ (DHA) - Private CNG
  //             - থ (THA) - Rented CNG
  //             - হ (HA) - Motorcycle
  //             - ল (LA) - Motorcycle`,
  //         },
  //         {
  //           role: 'user',
  //           content: [
  //             {
  //               type: 'text',
  //               text: `Extract the RC number from this Bangladeshi RC card image and parse it into the following JSON format:
  //               {
  //                 "registrationPoint": "The exact registration point code from the mapping above (e.g., 'DHK METRO', 'CTG METRO', 'BH', 'BR')",
  //                 "series": "The Bengali series code (e.g., 'ক', 'খ', 'গ')",
  //                 "seriesEnglish": "The English equivalent of the series (e.g., 'KA', 'KHA', 'GA')",
  //                 "number": "The numeric part (e.g., '1234', '5678'), might be in Bengali script, you must translate it to English and return the English version in the number field.",
  //                 "vehicleType": "The vehicle type based on the series",
  //                 "vehicleColour": "Vehicle color if visible",
  //                 "registrationDate": "Registration date if visible",
  //               }

  //               CRITICAL RULES:
  //               1. The RC number can be in Bengali, you must translate it to English and return the English version in the seriesEnglish field.
  //               2. Look for the RC number in the format: [Registration Point] [Bengali Series] [Numbers]
  //               3. The registration point MUST be mapped to the exact codes provided above
  //               4. The Bengali series is usually 1-2 characters in Bengali script
  //               5. The number part is typically 3-6 digits
  //               6. If the image is unclear or the RC number is not readable, return null
  //               7. Do not include any markdown formatting or backticks in your response
  //               8. Ensure the JSON is valid and properly formatted
  //               9. For registration points, use the exact codes like "DHK METRO", "CTG METRO", "BH", etc.

  //               Examples:
  //               - Dhaka Metro ক 1234 → registrationPoint: "DHK METRO", series: "ক", number: "1234"
  //               - Chittagong Metro খ 5678 → registrationPoint: "CTG METRO", series: "খ", number: "5678"
  //               - Sylhet গ 9012 → registrationPoint: "SYL METRO", series: "গ", number: "9012"
  //               - Khulna ঘ 3456 → registrationPoint: "KHL Metro", series: "ঘ", number: "3456"
  //               - Rajshahi চ 7890 → registrationPoint: "RAJ METRO", series: "চ", number: "7890"

  //               Focus primarily on extracting the RC number components accurately with the correct registration point mapping.`,
  //             },
  //             {
  //               type: 'image_url',
  //               image_url: {
  //                 url: `data:image/jpeg;base64,${base64Image}`,
  //               },
  //             },
  //           ],
  //         },
  //       ],
  //       max_tokens: 1000,
  //       response_format: { type: 'json_object' },
  //       temperature: 0.1,
  //     });

  //     const content = response.choices[0].message.content;

  //     if (!content) {
  //       throw new BadRequestException('RC card is not valid or not readable.');
  //     }

  //     return JSON.parse(content);
  //   } catch (error) {
  //     console.error(error);
  //     throw new BadRequestException('Failed to verify RC card.');
  //   }
  // }

  // Vehicle RC
  async extractRCData(buffer: Buffer) {
    const systemPrompt =
      'You are an expert in extracting Bangladeshi RC (Registration Certificate) data and translation.';
    const userPrompt = `
      Extract the RC number from this Bangladeshi RC card image and parse it into the following JSON format:
      {
        "registrationPoint": "...",
        "series": "...",
        "seriesEnglish": "...",
        "number": "...",
        "vehicleType": "...",
        "vehicleColour": "...",
        "registrationDate": "..."
      }
        
      REGISTRATION POINT MAPPING:
      - Dhaka Metro → "DHK METRO"
      - Chittagong Metro → "CTG METRO"
      - Sylhet Metro → "SYL METRO"
      - Khulna Metro → "KHL Metro"
      - Rajshahi Metro → "RAJ METRO"
      - Bagerhat → "BH"
      - Barguna → "BN"
      - Barisal → "BR"
      - Bhola → "BA"
      - Bogra → "BO"
      - Bandarban → "BB"
      - Chandpur → "CH"
      - Chapainawabganj → "CN"
      - Chuadanga → "CD"
      - Comilla → "CM"
      - Cox's Bazar → "CB"
      - Dhaka → "DH"
      - Dinajpur → "DP"
      - Feni → "FP"
      - Faridpur → "FN"
      - Gaibandha → "GB"
      - Gazipur → "GP"
      - Gopalganj → "GO"
      - Habiganj → "HB"
      - Jamalpur → "JM"
      - Jessore → "JS"
      - Jhenaidah → "JK"
      - Joypurhat → "JD"
      - Jhalokati → "JP"
      - Kishoreganj → "KG"
      - Khulna → "KH"
      - Kushtia → "KS"
      - Kurigram → "KT"
      - Lakshmipur → "LP"
      - Lalmonirhat → "LH"
      - Madaripur → "MP"
      - Magura → "MG"
      - Manikganj → "MN"
      - Mymensingh → "MH"
      - Munshiganj → "MB"
      - Meherpur → "MS"
      - Moulvibazar → "MY"
      - Narayanganj → "NG"
      - Narsingdi → "NR"
      - Narail → "NA"
      - Netrokona → "ND"
      - Natore → "NT"
      - Naogaon → "NK"
      - Nilphamari → "NL"
      - Noakhali → "NO"
      - Pabna → "PB"
      - Patuakhali → "PA"
      - Pirojpur → "PT"
      - Panchagarh → "PJ"
      - Rajbari → "RB"
      - Rajshahi → "RM"
      - Rangpur → "RP"
      - Satkhira → "SK"
      - Sirajganj → "SP"
      - Sunamganj → "SH"
      - Shariatpur → "SG"
      - Sylhet → "SU"
      - Tangail → "TG"
      - Thakurgaon → "Tk"
  
      BENGALI SERIES CODES:
      - ক (KA) - Private cars 800cc
      - খ (KHA) - Private cars 1000-1300cc
      - গ (GA) - Private cars 1500-1800cc
      - ঘ (GHA) - Jeep
      - চ (CHA) - Microbus
      - ছ (CHHA) - Rented microbuses
      - প (PA) - Taxi cabs
      - ভ (BHA) - Private cars 2000+cc
      - ম (MA) - Commercial pick-up
      - ধ (DHA) - Private CNG 
      - থ (THA) - Rented CNG
      - হ (HA) - Motorcycle 80-125cc
      - ল (LA) - Motorcycle 135-200cc

      If any field is in Bengali, translate it to English before returning the JSON.
      If the RC card is not valid or not readable, return null.
      Do not include any markdown formatting or backticks in your response.
    `;
    return this.extractDocumentData(buffer, systemPrompt, userPrompt);
  }

  async mapVehicleType(vehicleType: string): Promise<VehicleTypeNameBD> {
    try {
      const systemPrompt = 'You are an expert in mapping vehicle types.';
      const userPrompt = `Map the vehicle type "${vehicleType}" to a valid vehicle type of our system: FAIR_BIKE, FAIR_PRIME, FAIR_PLUS, FAIR_MAX, FAIR_CNG.
      The vehicle types FAIR_PRIME, FAIR_PLUS, FAIR_MAX are for cars, FAIR_BIKE for motorcycles, and FAIR_CNG for CNG vehicles.
      Return the result as a JSON object with a single key "vehicleType" (e.g., { "vehicleType": "FAIR_BIKE" }).
      If the vehicle type is not valid or not readable, return { "vehicleType": null } as a JSON object.
      Do not include any markdown formatting or backticks in your response. The response must be valid JSON.
      If the vehicle type is not valid, return { "vehicleType": null } as a JSON object.`;

      const response = await this.openai.chat.completions.create({
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: [{ type: 'text', text: userPrompt }],
          },
        ],
        max_tokens: 1000,
        temperature: 0.2,
        model: this.model,
        response_format: { type: 'json_object' },
      });

      const content = response.choices[0].message.content;
      const vehicleTypeBD = JSON.parse(content).vehicleType;
      if (!vehicleTypeBD) {
        throw new BadRequestException('Failed to map vehicle type.');
      }

      return vehicleTypeBD as VehicleTypeNameBD;
    } catch (error) {
      console.error(error);
      throw new BadRequestException('Failed to map vehicle type.');
    }
  }

  // async extractNumberPlateData(buffer: Buffer) {
  //   try {
  //     const base64Image = buffer.toString('base64');

  //     const response = await this.openai.chat.completions.create({
  //       model: 'gpt-4o',
  //       messages: [
  //         {
  //           role: 'system',
  //           content: `You are an expert in extracting Bangladeshi number plate data. You have to translate and rearrange numberplate data.

  //           IMPORTANT: Bangladeshi number plates follow this format: [Registration Point] [Bengali Series] [Numbers]

  //           Examples:
  //           - ঢাকা মেট্রো - ল ৬৩ - ৫৫৭৩ → registrationPoint: "DHK METRO", series: "LA", number: "635573"

  //           REGISTRATION POINT MAPPING (use these exact codes):
  //           - Dhaka Metro → "DHK METRO"
  //           - Chittagong Metro → "CTG METRO"
  //           - Sylhet Metro → "SYL METRO"
  //           - Khulna Metro → "KHL Metro"
  //           - Rajshahi Metro → "RAJ METRO"
  //           - Bagerhat → "BH"
  //           - Barguna → "BN"
  //           - Barisal → "BR"
  //           - Bhola → "BA"
  //           - Bogra → "BO"
  //           - Bandarban → "BB"
  //           - Chandpur → "CH"
  //           - Chapainawabganj → "CN"
  //           - Chuadanga → "CD"
  //           - Comilla → "CM"
  //           - Cox's Bazar → "CB"
  //           - Dhaka → "DH"
  //           - Dinajpur → "DP"
  //           - Feni → "FP"
  //           - Faridpur → "FN"
  //           - Gaibandha → "GB"
  //           - Gazipur → "GP"
  //           - Gopalganj → "GO"
  //           - Habiganj → "HB"
  //           - Jamalpur → "JM"
  //           - Jessore → "JS"
  //           - Jhenaidah → "JK"
  //           - Joypurhat → "JD"
  //           - Jhalokati → "JP"
  //           - Kishoreganj → "KG"
  //           - Khulna → "KH"
  //           - Kushtia → "KS"
  //           - Kurigram → "KT"
  //           - Lakshmipur → "LP"
  //           - Lalmonirhat → "LH"
  //           - Madaripur → "MP"
  //           - Magura → "MG"
  //           - Manikganj → "MN"
  //           - Mymensingh → "MH"
  //           - Munshiganj → "MB"
  //           - Meherpur → "MS"
  //           - Moulvibazar → "MY"
  //           - Narayanganj → "NG"
  //           - Narsingdi → "NR"
  //           - Narail → "NA"
  //           - Netrokona → "ND"
  //           - Natore → "NT"
  //           - Naogaon → "NK"
  //           - Nilphamari → "NL"
  //           - Noakhali → "NO"
  //           - Pabna → "PB"
  //           - Patuakhali → "PA"
  //           - Pirojpur → "PT"
  //           - Panchagarh → "PJ"
  //           - Rajbari → "RB"
  //           - Rajshahi → "RM"
  //           - Rangpur → "RP"
  //           - Satkhira → "SK"
  //           - Sirajganj → "SP"
  //           - Sunamganj → "SH"
  //           - Shariatpur → "SG"
  //           - Sylhet → "SU"
  //           - Tangail → "TG"
  //           - Thakurgaon → "Tk"

  //           BENGALI SERIES CODES:
  //           - ক (KA) - Private cars 800cc
  //           - খ (KHA) - Private cars 1000-1300cc
  //           - গ (GA) - Private cars 1500-1800cc
  //           - ঘ (GHA) - Jeep
  //           - চ (CHA) - Microbus
  //           - ছ (CHHA) - Rented microbuses
  //           - প (PA) - Taxi cabs
  //           - ভ (BHA) - Private cars 2000+cc
  //           - ম (MA) - Commercial pick-up
  //           - ধ (DHA) - Private CNG
  //           - থ (THA) - Rented CNG
  //           - হ (HA) - Motorcycle 80-125cc
  //           - ল (LA) - Motorcycle 135-200cc

  //           Your task is to extract and parse the number plate into its three components using the exact registration point codes above.`,
  //         },
  //         {
  //           role: 'user',
  //           content: [
  //             {
  //               type: 'text',
  //               text: `Extract the number plate from this Bangladeshi number plate image, Translate it to English and parse it into the following JSON format:

  //               {
  //                 "registrationPoint": "The exact registration point code from the mapping above (e.g., 'DHK METRO', 'CTG METRO', 'BH', 'BR')",
  //                 "series": "The Bengali series code (e.g., 'ক', 'খ', 'গ')",
  //                 "seriesEnglish": "The English equivalent of the series (e.g., 'KA', 'KHA', 'GA')",
  //                 "number": "The numeric part (e.g., ৬৩ - ৫৫৭৩)",
  //                 "numberPlate": "The complete number plate in the format [Registration Point] [Bengali Series] [Numbers]"
  //               }

  //               CRITICAL RULES:
  //               1. Look for the number plate in the format: [Registration Point] [Bengali Series] [Numbers]
  //               2. The registration point MUST be mapped to the exact codes provided above
  //               3. The Bengali series is usually 1-2 characters in Bengali script
  //               4. The number part is typically 3-6 digits and it should be translated to English.
  //               5. If you see Bengali text, translate it to English for the seriesEnglish field
  //               6. If the image is unclear or the number plate is not readable, return null
  //               7. Do not include any markdown formatting or backticks in your response
  //               8. Ensure the JSON is valid and properly formatted
  //               9. For registration points, use the exact codes like "DHK METRO", "CTG METRO", "BH", etc.
  //               10. The numberPlate field should contain the complete number plate as it appears on the vehicle

  //               Focus primarily on extracting the number plate components accurately with the correct registration point mapping.`,
  //             },
  //             {
  //               type: 'image_url',
  //               image_url: {
  //                 url: `data:image/jpeg;base64,${base64Image}`,
  //               },
  //             },
  //           ],
  //         },
  //       ],
  //       max_tokens: 1000,
  //       response_format: { type: 'json_object' }
  //     });

  //     const content = response.choices[0].message.content;

  //     if (!content) {
  //       throw new BadRequestException(
  //         'Number plate is not valid or not readable.',
  //       );
  //     }

  //     return JSON.parse(content);
  //   } catch (error) {
  //     console.error(error);
  //     throw new BadRequestException(
  //       'Failed to verify number plate with OpenAI.',
  //     );
  //   }
  // }

  async extractNumberPlateData(buffer: Buffer) {
    const systemPrompt =
      'You are an expert in extracting and translating Bangladeshi vehicle number plate data.';

    const userPrompt = `
    Extract the number plate from this Bangladeshi number plate image and parse it into the following JSON format:
    {
      "registrationPoint": "The exact registration point code from the mapping below (e.g., 'DHK METRO', 'CTG METRO', 'BH', 'BR')",
      "series": "The Bengali series code (e.g., 'ক', 'খ', 'গ')",
      "seriesEnglish": "The English equivalent of the series (e.g., 'KA', 'KHA', 'GA')",
      "number": "The numeric part (e.g., '635573'), translate Bengali digits to English",
      "numberPlate": "The complete number plate as it appears on the vehicle, but with Bengali translated to English"
    }
    
    REGISTRATION POINT MAPPING:
    - Dhaka Metro → "DHK METRO"
    - Chittagong Metro → "CTG METRO"
    - Sylhet Metro → "SYL METRO"
    - Khulna Metro → "KHL Metro"
    - Rajshahi Metro → "RAJ METRO"
    - Bagerhat → "BH"
    - Barguna → "BN"
    - Barisal → "BR"
    - Bhola → "BA"
    - Bogra → "BO"
    - Bandarban → "BB"
    - Chandpur → "CH"
    - Chapainawabganj → "CN"
    - Chuadanga → "CD"
    - Comilla → "CM"
    - Cox's Bazar → "CB"
    - Dhaka → "DH"
    - Dinajpur → "DP"
    - Feni → "FP"
    - Faridpur → "FN"
    - Gaibandha → "GB"
    - Gazipur → "GP"
    - Gopalganj → "GO"
    - Habiganj → "HB"
    - Jamalpur → "JM"
    - Jessore → "JS"
    - Jhenaidah → "JK"
    - Joypurhat → "JD"
    - Jhalokati → "JP"
    - Kishoreganj → "KG"
    - Khulna → "KH"
    - Kushtia → "KS"
    - Kurigram → "KT"
    - Lakshmipur → "LP"
    - Lalmonirhat → "LH"
    - Madaripur → "MP"
    - Magura → "MG"
    - Manikganj → "MN"
    - Mymensingh → "MH"
    - Munshiganj → "MB"
    - Meherpur → "MS"
    - Moulvibazar → "MY"
    - Narayanganj → "NG"
    - Narsingdi → "NR"
    - Narail → "NA"
    - Netrokona → "ND"
    - Natore → "NT"
    - Naogaon → "NK"
    - Nilphamari → "NL"
    - Noakhali → "NO"
    - Pabna → "PB"
    - Patuakhali → "PA"
    - Pirojpur → "PT"
    - Panchagarh → "PJ"
    - Rajbari → "RB"
    - Rajshahi → "RM"
    - Rangpur → "RP"
    - Satkhira → "SK"
    - Sirajganj → "SP"
    - Sunamganj → "SH"
    - Shariatpur → "SG"
    - Sylhet → "SU"
    - Tangail → "TG"
    - Thakurgaon → "Tk"
    
    BENGALI SERIES CODES:
    - ক (KA) - Private cars 800cc
    - খ (KHA) - Private cars 1000-1300cc
    - গ (GA) - Private cars 1500-1800cc
    - ঘ (GHA) - Jeep
    - চ (CHA) - Microbus
    - ছ (CHHA) - Rented microbuses
    - প (PA) - Taxi cabs
    - ভ (BHA) - Private cars 2000+cc
    - ম (MA) - Commercial pick-up
    - ধ (DHA) - Private CNG 
    - থ (THA) - Rented CNG
    - হ (HA) - Motorcycle 80-125cc
    - ল (LA) - Motorcycle 135-200cc
    
    CRITICAL RULES:
    1. The registration point MUST be mapped to the exact codes provided above.
    2. The Bengali series is usually 1-2 characters in Bengali script; map to the English code.
    3. The number part is typically 3-6 digits; translate Bengali digits to English.
    4. The numberPlate field should contain the complete number plate as it appears, but with all Bengali translated to English.
    5. If the image is unclear or the number plate is not readable, return null.
    6. Do not include any markdown formatting or backticks in your response.
    7. Ensure the JSON is valid and properly formatted.
    8. For registration points, use the exact codes like "DHK METRO", "CTG METRO", "BH", etc.
    9. If the number plate is not readable, return null.
  `;

    console.log('NEW LOGIC ********');
    return this.extractDocumentData(buffer, systemPrompt, userPrompt);
  }

  async extractTaxTokenData(buffer: Buffer) {
    const systemPrompt =
      'You are an expert in extracting and translating Bangladeshi tax token data.';

    const userPrompt = `
  Extract the name of the tax token owner from this Bangladeshi tax token image and parse it into the following JSON format:
  {
    "name": "The name of the tax token owner",
  }
  `;

    return this.extractDocumentData(buffer, systemPrompt, userPrompt);
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
    const openai = new AzureOpenAI({
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
