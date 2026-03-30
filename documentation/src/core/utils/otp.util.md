# `src/core/utils/otp.util.ts`

## Role

**Injectable OTP/SMS service** for Bangladesh (Khudebarta, SSL Wireless fallback), India (MSG91 generate/verify/resend), and shared message formatting.

## Class: `OTPService`

| Method | Description |
|--------|-------------|
| `getOTPMessage(otp)` | Private: SMS body text. |
| `sendOTPBD(mobile, otp)` | GET to Khudebarta with JSON content payload. |
| `sendOTPSSL(mobile, otp)` | POST to SSL Wireless SMS API. |
| `sendOTP(mobile)` | MSG91 OTP generation; returns `request_id`. |
| `verifyOTP(mobile, otp, requestId)` | MSG91 verify. |
| `resendOTP(mobile, requestId)` | MSG91 resend; returns new `requestId`. |

## Notes

- Strips leading `+` for some providers.
- Constructor reads `msg91`, `khudebarta`, `ssl` config blocks.
