# `src/modules/pilot/pilot.service.ts`

## Role

**Pilot (driver) lifecycle**: profile and wallet, phone change OTP, document uploads for India (DL, RC, PAN, Aadhaar) and Bangladesh (BD license, NID, RC, number plate, tax token) using `VerificationService` and Azure blob storage, manual confirmation DTOs, **go online** with GEO registration, transactions, coupons, onboarding offers, and **user status** transitions (onboarding → active).

## Major method groups

| Area | Methods (representative) |
|------|---------------------------|
| Profile | `getPilot`, `updatePhone`, `verifyPhone` |
| India KYC | `processDrivingLicense`, `processManualDrivingLicense`, `uploadLiveSelfie`, `processVehicleRC`, `processManualVehicleRC`, `processPancard`, `processManualPancard`, `processAadhaar`, `processAadhaarManual`, `verifyAadhaar` |
| Bangladesh KYC | `uploadBDLicense`, `processBDLicense`, `uploadBDNid`, `processBDNid`, `uploadBDRC`, `processBDRC`, `uploadNumberPlate`, `processNumberPlate`, `uploadTaxToken`, … |
| Operations | `onboardingOffer`, `availBonusRecharge`, `getVehicles`, `getTransactions`, `beOnline`, `updateDriverDetails`, `getCoupons` |
| Internal | OCR helpers, Azure delete helpers, `validateUserStatusTransition`, document completion checks |

## Dependencies

`PrismaService`, `RedisService`, `OTPService`, `VerificationService`, `AzureService`, `FareService` / pricing as needed, `GeofencingService`, etc. (see constructor in source).

## Notes

- Very large file; each `process*` method typically: load pilot, validate prerequisites, call verification AI/API, persist URLs and status fields.
