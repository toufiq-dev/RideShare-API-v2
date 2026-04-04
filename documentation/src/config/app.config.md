# `src/config/app.config.ts`

## Role

**Default configuration factory** for `ConfigModule` (`load: [configuration]`). Exports a function that reads `process.env` and returns a nested object consumed via `ConfigService.get('app.port')`, `ConfigService.get('redis.url')`, etc.

## Exported shape (top-level keys)

| Key | Contents |
|-----|----------|
| `app` | `port`, `version` (`API_VERSION`), `environment` (`NODE_ENV`). |
| `database` | `url` (`DATABASE_URL`). |
| `logging` | `level`, `enableFileLogging`, `enableLoki`, `lokiUrl`. |
| `redis` | `url`, `accessTokenTTL`, `refreshTokenTTL`. |
| `pricing` | `city`, `MU_MIN`, `MU_MAX` (fare multipliers). |
| `msg91` | India SMS OTP (MSG91). |
| `khudebarta` | Bangladesh SMS (OTP). |
| `ssl` | SSL Wireless SMS. |
| `sslcommerz` | Payment gateway store and validator URLs. |
| `jwt` | `secret`, token expiry strings. |
| `azure` | Blob storage, Cognitive Services OCR, OpenAI, Communication Email. |
| `file` | Allowed MIME types, max sizes, temp upload dir. |
| `signzy` | KYC API endpoints and tokens (DL, PAN, RC, Aadhaar). |
| `cashfreeAadhaar` | Aadhaar OTP/verify. |
| `cashfreePayment` | Order API for payments. |
| `subscription` | Human-readable pack names. |
| `openai` | Standalone OpenAI API key. |
| `googleMaps` | API key. |
| `firebase` | FCM credentials. |
| `systemConfig` | Key names for dynamic config (e.g. bonus threshold). |

## Notes

- There is commented legacy `pricing` math; active pricing uses `pricing.city` / `MU_*` and module-level tariff logic.
- Secrets must be supplied via environment variables in production.
