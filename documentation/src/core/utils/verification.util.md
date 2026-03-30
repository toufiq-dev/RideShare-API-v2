# `src/core/utils/verification.util.ts`

## Role

**KYC / document verification** service: combines **Azure OpenAI vision** (JSON extraction from Bangladesh DL, NID, RC, number plate, tax token), **Signzy** APIs (DL, PAN, RC for India), **Cashfree** Aadhaar OTP flow, and **vehicle classification** via OpenAI + Prisma cache (`vehicleClassificationCache`).

## Class: `VerificationService`

### Private helpers

| Method | Description |
|--------|-------------|
| `extractDocumentData(buffer, systemPrompt, userPrompt)` | Base64 image to chat completion with `response_format: json_object`; validates non-empty JSON. |
| `classifyVehicleUsingOpenAI(vehicleData)` | Maps RC fields to `VehicleTypeName`; caches in `vehicleClassificationCache`. |
| `categoryExists(vehicleData)` | Looks up cached classification by composite key. |

### Bangladesh document AI extraction

| Method | Description |
|--------|-------------|
| `extractDLData` / `extractNidData` / `extractRCData` / `extractNumberPlateData` / `extractTaxTokenData` | Vision prompts with Bengali digit rules; field validation; throws `BadRequestException` if unreadable. |
| `mapVehicleType(vehicleType)` | Maps free-text to `VehicleTypeNameBD` enum via JSON chat completion. |

### Signzy / external verification

| Method | Description |
|--------|-------------|
| `verifyDrivingLicense(dlNumber, dob)` | POST preproduction DL endpoint; checks transport validity; expiry vs Asia/Kolkata. |
| `verifyPancard(panNumber)` | PAN verification. |
| `verifyVehicleRC(registrationNumber)` | RC + basic RC; active status; expiry checks; optional `category` from cache or OpenAI. |
| `sendOtpToverifyAadhaar` / `verifyAadhaar` | Cashfree Aadhaar OTP + verify with client id/secret headers. |

## Configuration

Reads `signzy.*`, `cashfreeAadhaar.*`, `azure.openai.*` (and `OPENAI_API_KEY` for standalone classification path).
