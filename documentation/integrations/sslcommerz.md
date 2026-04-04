# SSLCommerz

## Role in FairDrive

- **`PaymentService`** (`src/modules/payment/payment.service.ts`): Initiates subscription payments, validates transactions via SSLCommerz **validator** APIs, handles success/failure/reconcile flows.
- Gateway identifier in code includes `SSLCOMMERZ` / `SSLCOMMERZ_SDK_TYPE` where applicable.

## Environment variables

| Variable | Purpose |
|----------|---------|
| `SSLCOMMERZ_STORE_ID` | Merchant store ID |
| `SSLCOMMERZ_STORE_PASSWORD` | Store password / API credential |
| `SSLCOMMERZ_VALIDATOR_BASE_URL` | Validator API base (see sandbox vs live below) |
| `SSLCOMMERZ_VALIDATOR_VERSION` | Default `3` |
| `SSLCOMMERZ_VALIDATOR_FORMAT` | Default `json` |

Config path: `sslcommerz.*` in `app.config.ts`.

## Sandbox vs production

| Environment | Validator base URL (typical) |
|-------------|--------------------------------|
| **Sandbox / testing** | `https://sandbox.sslcommerz.com/validator/api` |
| **Live** | `https://securepay.sslcommerz.com/validator/api` (confirm in [SSLCommerz docs](https://developer.sslcommerz.com/)) |

Your **store ID and password** must match the same environment (sandbox store for sandbox validator, live store for live validator). Misconfiguration causes validation failures after payment.

## Dashboards and docs

- [SSLCommerz Developer](https://developer.sslcommerz.com/) — integration guides, IPN, validation API.
- Merchant / store dashboard (URL provided by SSLCommerz for your account) — transactions, credentials.

## “Webhook” / callback URLs (this API)

SSLCommerz is integrated as **mobile/client-driven callbacks** hitting **your** API with the user session, not as a server-to-server POST from SSLCommerz to a static webhook URL (unless you add IPN separately).

Documented **Payment** routes (`@Controller('payment')`, pilot JWT):

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/payment/sslcommerz/init` | Start payment / get session data |
| GET | `/payment/sslcommerz/success?transactionId=` | Success path; server validates with SSLCommerz APIs (`tran_id` / internal transaction id) |
| GET | `/payment/sslcommerz/fail?transactionId=` | Failure path |
| POST | `/payment/sslcommerz/verify` | Manual reconciliation after network issues |

**App deep links** (success/fail URLs configured in SSLCommerz / mobile app) should open the client, which then calls these endpoints with `Authorization: Bearer <token>`.

Exact query/body fields: see Swagger `/api-docs` and `payment.dto.ts`.

## Operational notes

- Log validation responses (without storing full card data); align `transactionId` mapping with `tran_id` from SSLCommerz.
- If you enable **IPN** in merchant panel, implement a **separate** public route and verify signatures per SSLCommerz documentation (not necessarily present in current codebase—verify).
