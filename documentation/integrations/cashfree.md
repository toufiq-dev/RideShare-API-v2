# Cashfree (Aadhaar + Payment Gateway)

## Role in FairDrive

1. **Aadhaar (offline OTP)** — `VerificationService` (`src/core/utils/verification.util.ts`): `sendOtpToverifyAadhaar`, `verifyAadhaar` using Cashfree Verification API endpoints.
2. **Payment Gateway (orders)** — `PaymentService`: `createOrder`, `verifyPayment` against Cashfree PG (`PAYMENT_CREATE_ORDER_URL`, test client id/secret, API version), plus **`POST /payment/cashfree/webhook`** (public, HMAC-verified) on `CashfreeWebhookController`.

## Environment variables

### Aadhaar verification

| Variable | Purpose |
|----------|---------|
| `CASHFREE_GENERATE_OTP_ENDPOINT` | Generate OTP for offline Aadhaar |
| `CASHFREE_VERIFY_AADHAAR_ENDPOINT` | Verify OTP / complete verification |
| `CASHFREE_CLIENT_ID` | API client id |
| `CASHFREE_CLIENT_SECRET` | API client secret |

Config path: `cashfreeAadhaar.*` in `app.config.ts`.

### Payment gateway (orders)

| Variable | Purpose |
|----------|---------|
| `PAYMENT_CREATE_ORDER_URL` | e.g. Cashfree sandbox or live **orders** base URL |
| `PAYMENT_API_VERSION` | API version header/date (e.g. `2025-01-01`) |
| `PAYMENT_TEST_CLIENT_ID` | Sandbox / test app credentials |
| `PAYMENT_TEST_CLIENT_SECRET` | Sandbox / test secret |

Config path: `cashfreePayment.*` in `app.config.ts`.

## Sandbox vs production

- Cashfree provides **separate** credentials and base URLs for **sandbox** vs **production**.
- Point `PAYMENT_CREATE_ORDER_URL` and client id/secret to the same environment (do not mix sandbox URL with production keys).
- Aadhaar endpoints in env should match the **same** Cashfree account mode (test vs prod) as your compliance requirements.

## Dashboards and docs

- [Cashfree Developers](https://www.cashfree.com/docs) — Payments, Verification API, authentication.
- Cashfree merchant dashboard — API keys, webhooks (if configured).

## Webhooks / callbacks

- **PG webhook URL (configure in Cashfree):** `https://<your-api-host>/payment/cashfree/webhook` — subscribe to **PAYMENT_SUCCESS_WEBHOOK**, **PAYMENT_FAILED_WEBHOOK**, and **PAYMENT_USER_DROPPED_WEBHOOK** as needed. Signatures use **`PAYMENT_TEST_CLIENT_SECRET`** (same secret as `x-client-secret` on order APIs); see [Cashfree signature verification](https://www.cashfree.com/docs/payments/online/webhooks/signature-verification).
- **App-driven verify:** JWT-protected `POST /payment/verify/:orderId` remains available for the client; webhook fulfillment is **idempotent** with the same wallet credit logic.

## Operational notes

- Store `order_id` / `orderId` consistently between create and verify flows.
- Never log client secrets or full Aadhaar payloads in plain text.
