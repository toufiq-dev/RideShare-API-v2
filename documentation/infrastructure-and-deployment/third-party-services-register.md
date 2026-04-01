# Third-party services register (governance)

This repository is **private**. This page is an **internal register template** for audits and handover. It lists **where credentials enter the system** (environment variable names aligned with `src/config/app.config.ts`). It does **not** contain secret values, API keys, passwords, or connection strings.

## How credentials are handled

Third-party API keys and connection strings are **not** embedded in application source code. They are supplied at **runtime** via **environment configuration** maintained on **company-controlled hardware** used for development and deployment preparation. As part of our **office transition**, that equipment is **packed and awaiting shipment** to the company office address, with access limited to **authorized personnel**. Production follows the same principle: secrets live on the **deployment host** and/or **CI secret store** (e.g. GitHub Actions encrypted secrets), not in public artifacts.

We are **completing** the columns **Account owner (email)** and **Plan / tier** with finance and vendor owners; until then they read **TBD**.

## Development env file (reference)

Local developers use a **gitignored** file such as `.env.development` on company machines. Values must **never** be committed. The following **names** are typical for current FairDrive API configuration (subset may be present per environment):

| Area | Environment variable names (no values) |
|------|----------------------------------------|
| Runtime | `NODE_ENV`, `PORT`, `INDICATOR` |
| PostgreSQL | `DATABASE_URL` |
| Redis | `REDIS_URL`, `REDIS_ACCESS_TOKEN_TTL`, `REDIS_REFRESH_TOKEN_TTL` |
| JWT | `JWT_SECRET`, `JWT_ACCESS_TOKEN_EXPIRES_IN`, `JWT_REFRESH_TOKEN_EXPIRES_IN` |
| MSG91 (India SMS) | `MSG91_BASE_URL`, `MSG91_AUTH_KEY`, `MSG91_TEMPLATE_ID`, `MSG91_SENDER_ID`, `MSG91_TEST_MODE` (optional) |
| Azure Storage | `AZURE_STORAGE_CONNECTION_STRING`, `AZURE_STORAGE_CONTAINER_NAME`, `AZURE_STORAGE_CONTAINER_DB` |
| Azure Cognitive Services | `AZURE_COGNITIVE_SERVICES_ENDPOINT`, `AZURE_COGNITIVE_SERVICES_API_KEY` |
| Signzy | `SIGNZY_ACCESS_TOKEN_PRODUCTION`, `SIGNZY_ACCESS_TOKEN_PREPRODUCTION`, `SIGNZY_DL_ENDPOINT_PRODUCTION`, `SIGNZY_DL_ENDPOINT_TESTING`, `SIGNZY_PAN_VERIFY_ENDPOINT`, `SIGNZY_PAN_VERIFY_ENDPOINT_TESTING`, `SIGNZY_RC_VERIFY_ENDPOINT`, `SIGNZY_RC_VERIFY_ENDPOINT_PRE`, `SIGNZY_RC_VERIFY_BASIC`, `SIGNZY_GET_AADHAAR`, `SIGNZY_GET_AADHAAR_PRE` |
| Product copy | `ONBOARDING_OFFER` (non-secret) |

Other integrations are **wired in code** and expect env vars when those features are enabled—see the register rows below and `src/config/app.config.ts`.

---

## Register (11 services)

Fill **Account owner** and **Plan / tier** when confirmed with each vendor. **Credential storage** describes where FairDrive keeps secrets operationally (not the literal values).

| # | Service | Account owner (email) | Dashboard / console URL | Plan / tier | Credential storage (FairDrive) |
|---|---------|------------------------|-------------------------|-------------|--------------------------------|
| 1 | **Azure** (VM, Storage, Cognitive Services; Communication & OpenAI if used) | TBD | [Azure Portal](https://portal.azure.com) | TBD | Env: `AZURE_STORAGE_CONNECTION_STRING`, `AZURE_STORAGE_CONTAINER_NAME`, `AZURE_STORAGE_CONTAINER_DB`, `AZURE_COGNITIVE_SERVICES_*`, `AZURE_COMMUNICATION_*`, `AZURE_OPENAI_*` on deploy host / company machine `.env`; VM/SSH not in repo — see [compute-and-access.md](compute-and-access.md), [github-actions-secrets.md](github-actions-secrets.md). |
| 2 | **Cashfree (payments)** | TBD | [Cashfree merchant](https://merchant.cashfree.com) | TBD | Env: `PAYMENT_CREATE_ORDER_URL`, `PAYMENT_API_VERSION`, `PAYMENT_TEST_CLIENT_ID`, `PAYMENT_TEST_CLIENT_SECRET` (and production equivalents when not in test mode). |
| 3 | **Cashfree (Aadhaar verification)** | TBD | Same Cashfree / product console as contracted | TBD | Env: `CASHFREE_GENERATE_OTP_ENDPOINT`, `CASHFREE_VERIFY_AADHAAR_ENDPOINT`, `CASHFREE_CLIENT_ID`, `CASHFREE_CLIENT_SECRET`. |
| 4 | **Signzy** (DL, PAN, RC, DigiLocker/Aadhaar flows) | TBD | Vendor portal per Signzy contract | TBD (prod vs preprod tokens) | Env: `SIGNZY_*` as listed above. |
| 5 | **MSG91** (India SMS) | TBD | [MSG91 control panel](https://control.msg91.com) | TBD | Env: `MSG91_*`. |
| 6 | **Khudebarta** (Bangladesh SMS) | TBD | Vendor portal (URL from Khudebarta) | TBD | Env: `KHUDEBARTA_BASE_URL`, `KHUDEBARTA_API_KEY`, `KHUDEBARTA_SECRET_KEY`, `KHUDEBARTA_SENDER_ID`. |
| 7 | **Firebase** (FCM) | TBD | [Firebase Console](https://console.firebase.google.com) | TBD | Env: `FIREBASE_PROJECT_ID`, `FIREBASE_PRIVATE_KEY`, `FIREBASE_CLIENT_EMAIL`. |
| 8 | **Google Maps Platform** | TBD | [Google Cloud Console](https://console.cloud.google.com) | TBD | Env: `GOOGLE_MAPS_API_KEY`. |
| 9 | **OpenAI** | TBD | [OpenAI Platform](https://platform.openai.com) and/or Azure OpenAI | TBD | Env: `OPENAI_API_KEY`; Azure-hosted: `AZURE_OPENAI_ENDPOINT`, `AZURE_OPENAI_KEY`, `AZURE_MODEL_NAME`, `AZURE_API_VERSION`. |
| 10 | **GitHub** (repository + Actions; GHCR if used) | TBD | [GitHub](https://github.com) | TBD | Repo access: org/team permissions. CI: encrypted secrets in repository/org settings — see [github-actions-secrets.md](github-actions-secrets.md). **Not** stored in application `.env` in git. |
| 11 | **Domain registrar** (e.g. fairdrivebd.com, fairdriveindia.com) | TBD | Registrar’s own portal | TBD | **Registrar account / IT password manager** — not application env vars. DNS/TLS context: [dns-and-tls.md](dns-and-tls.md). |

---

## Related documentation

- Env key names: **`src/config/app.config.ts`** (canonical map from env → config); see also `documentation/operations/README.md`
- Integration notes: `documentation/integrations/README.md`
- Azure subscription snapshot: [azure-subscription.md](azure-subscription.md)
