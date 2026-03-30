# Signzy

## Role in FairDrive

**`VerificationService`** (`src/core/utils/verification.util.ts`) calls Signzy REST APIs for **India** KYC:

- Driving licence verification
- PAN verification
- Vehicle RC (detailed + basic search)
- DigiLocker / e-Aadhaar (endpoints present; primary Aadhaar OTP flow may use **Cashfree** instead—see [cashfree.md](cashfree.md))

Uses **production** vs **preproduction** base URLs and matching **Bearer tokens** per environment.

## Environment variables

| Variable | Purpose |
|----------|---------|
| `SIGNZY_ACCESS_TOKEN_PRODUCTION` | Bearer token for `api.signzy.app` |
| `SIGNZY_ACCESS_TOKEN_PREPRODUCTION` | Bearer token for `api-preproduction.signzy.app` |
| `SIGNZY_DL_ENDPOINT_PRODUCTION` / `SIGNZY_DL_ENDPOINT_TESTING` | DL lookup |
| `SIGNZY_PAN_VERIFY_ENDPOINT` / `SIGNZY_PAN_VERIFY_ENDPOINT_TESTING` | PAN |
| `SIGNZY_RC_VERIFY_ENDPOINT` / `SIGNZY_RC_VERIFY_ENDPOINT_PRE` | RC detailed |
| `SIGNZY_RC_VERIFY_BASIC` | RC basic search |
| `SIGNZY_GET_AADHAAR` / `SIGNZY_GET_AADHAAR_PRE` | DigiLocker / Aadhaar helpers |

Config path: `signzy.*` in `app.config.ts`.

## Sandbox vs production

- **Preproduction** host: `https://api-preproduction.signzy.app/...`
- **Production** host: `https://api.signzy.app/...`

Code paths must use the **same token type** as the host (preproduction token only on preproduction URLs). Pilot verification flows often use preproduction for testing.

## Dashboards and docs

- [Signzy](https://www.signzy.com/) — account and API documentation (contact support for portal URL).
- Store **API usage**, limits, and audit logs per compliance.

## Webhooks

Signzy may offer async webhooks for some products; current integration is **request/response** from FairDrive API. If you add webhooks, expose a **signed** HTTPS endpoint and verify per Signzy docs.

## Operational notes

- Do not log full PAN/Aadhaar/RC responses in production logs; redact PII.
- Rotate access tokens when staff leave or on schedule.
