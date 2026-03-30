# SMS — MSG91 (India), Khudebarta & SSL Wireless (Bangladesh)

## Role in FairDrive

Implemented in **`OTPService`** (`src/core/utils/otp.util.ts`) and used by **`AuthService`** for phone OTP.

| Channel | Region | Usage in code |
|---------|--------|----------------|
| **MSG91** | India (`+91`) | `sendOTP`, `verifyOTP`, `resendOTP` — OTP APIs on `MSG91_BASE_URL` |
| **Khudebarta** | Bangladesh | `sendOTPBD` — primary BD SMS |
| **SSL Wireless** | Bangladesh fallback | `sendOTPSSL` — if Khudebarta fails |

## Environment variables

### MSG91 (India)

| Variable | Purpose |
|----------|---------|
| `MSG91_BASE_URL` | e.g. `https://control.msg91.com/api/v5` |
| `MSG91_AUTH_KEY` | Auth key |
| `MSG91_TEMPLATE_ID` | OTP template id |
| `MSG91_SENDER_ID` | Sender id |

Optional in env (not in `app.config.ts` by default—add if you wire them): `MSG91_TEST_MODE` for testing behavior in dashboards.

Config path: `msg91.*`.

### Khudebarta (Bangladesh)

| Variable | Purpose |
|----------|---------|
| `KHUDEBARTA_BASE_URL` | SMS gateway HTTP endpoint |
| `KHUDEBARTA_API_KEY` | API key |
| `KHUDEBARTA_SECRET_KEY` | Secret |
| `KHUDEBARTA_SENDER_ID` | Caller ID |

Config path: `khudebarta.*`.

### SSL Wireless (Bangladesh SMS fallback)

| Variable | Purpose |
|----------|---------|
| `SSL_BASE_URL` | Default `https://smsplus.sslwireless.com/api/v3/send-sms` |
| `SSL_API_TOKEN` | API token |
| `SSL_SENDER_ID` | Default `FAIRDRIVE` |

Config path: `ssl.*`.

## Sandbox vs production

- **MSG91:** Use [MSG91 dashboard](https://control.msg91.com/) test mode / dedicated template for dev; separate auth key for production.
- **Khudebarta / SSL Wireless:** Usually **one production endpoint** per account; use **separate accounts** or IP allowlisting for staging if the vendor supports it.

## Dashboards and docs

- [MSG91](https://msg91.com/) — Control panel, OTP API, templates.
- SSL Wireless — account portal provided by your SMS vendor.
- Khudebarta — vendor-specific dashboard (IP `118.x` style hosts are typical for private gateways—restrict access in firewall).

## Webhooks

None for basic OTP SMS. Delivery reports may be available via vendor-specific callbacks—check MSG91 / SSL documentation if you need DLR (delivery receipts).

## Operational notes

- Rate limits: align with **AuthService** Redis keys (`otpSent`, etc.) to avoid spam.
- Template registration: OTP content must match **approved templates** (especially for India DLT).
