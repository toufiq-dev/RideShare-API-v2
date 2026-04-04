# Pilot onboarding — India vs Bangladesh (Q27)

**Source of truth:** `src/modules/pilot/pilot.service.ts`, `src/modules/pilot/pilot.controller.ts`, `src/modules/admin/services/admin.service.ts` (`verifyDriver`), `prisma/schema.prisma`.  
**Note:** `DEVELOPER_QUERY_SHEET.md` is **not** present in this repo; this file replaces that reference for Q27.

## Shared concepts

### `VerificationStatus` (per document field on `Pilot`)

`PENDING` → `IN_PROGRESS` → `APPROVED` or `REJECTED` (see `prisma/schema.prisma`).

### `User.status` (high level)

Updated mainly by `PilotService.updateUserStatusAfterDocumentUpload` → `determineUserStatus`:

| Condition | `User.status` |
|-----------|----------------|
| Not all BD-style document **URLs** present (see list below) | `ONBOARDING` |
| All those URLs present **and** every listed verification is `APPROVED` | `ACTIVE` |
| All URLs present **and** any is `PENDING` or `IN_PROGRESS` | `IN_REVIEW` |
| All URLs present **and** none in review (e.g. all `REJECTED`) | `ONBOARDING` (resubmission path) |

**Documents included in this gate:** selfie, DL front/back, RC front/back, pilot NID front/back, tax token, number plate, vehicle-owner NID front/back — **not** `isPanCardVerified` / `isAadhaarVerified`. India-only KYC fields are **outside** this aggregation (see gaps below).

### Admin review

`PATCH …/admin/verify-driver/:driverId?documentType=…` → `AdminService.verifyDriver` sets the mapped `Pilot` flag to `APPROVED` / `REJECTED` (+ optional `*RejectionReason`). It also forces `User.status` to `ONBOARDING` if any **mapped** doc is `REJECTED`, and to `ACTIVE` when **all seven** mapped docs are `APPROVED`.

`DocumentType` enum **only** covers BD documents: `SELFIE`, `DRIVING_LICENSE`, `NID`, `REGISTRATION_CERTIFICATE`, `NUMBER_PLATE`, `TAX_TOKEN`, `VEHICLE_OWNERS_NID`. There is **no** `PAN` / `AADHAAR` document type for admin.

---

## Bangladesh flow (API order is not fully enforced; dependencies below)

| Step | Endpoint(s) | What happens | Verification flag | Auto vs admin |
|------|-------------|--------------|-------------------|---------------|
| 1 | Auth / pilot profile | User created; pilot row exists | — | — |
| 2 | `POST /pilot/live-selfie` | Stores `selfieUrl` | `isSelfieVerified` → **`IN_PROGRESS`** | **Auto** (awaiting review) |
| 3a | `POST /pilot/bd-license` (multipart) | OCR extract; stores DL image URLs | *(unchanged until confirmation)* | — |
| 3b | `POST /pilot/bd-license/confirmation` | Saves `DrivingLicense` row + name | `isDLVerified` → **`IN_PROGRESS`** | **Auto** → admin **APPROVED/REJECTED** |
| 4a | `POST /pilot/bd-nid?type=PILOT` | OCR extract; stores pilot NID URLs | URLs only; flag often **`PENDING`** until confirmation | — |
| 4b | `POST /pilot/bd-nid/confirmation?type=PILOT` | Upserts pilot `Nid` | `isNidVerified` → **`IN_PROGRESS`** | Admin |
| 5a | `POST /pilot/bd-nid?type=VEHICLE_OWNER` | OCR; stores owner NID URLs | URLs only | — |
| 5b | `POST /pilot/bd-nid/confirmation?type=VEHICLE_OWNER` | Upserts owner NID fields on same `Nid` row | `isVehicleOwnersNidVerified` → **`IN_PROGRESS`** | Admin |
| 6a | `POST /pilot/bd-rc` | OCR extract RC; stores RC URLs | *(until confirmation)* | — |
| 6b | `POST /pilot/bd-rc/confirmation` | Upserts `Vehicle` + `primaryVehicleTypeId` | `isRCVerified` → **`IN_PROGRESS`** | Admin |
| 7a | `POST /pilot/number-plate` | OCR; stores `numberPlateUrl` | *(until confirmation)* | — |
| 7b | `POST /pilot/number-plate/confirmation` | Confirms plate | `isNumberPlateVerified` → **`IN_PROGRESS`** | Admin |
| 8 | `POST /pilot/tax-token` | OCR + store URL | `isTaxTokenVerified` → **`IN_PROGRESS`** immediately | Admin |

**Wallet:** `GET /pilot/onboarding-offer` requires **`isDLVerified`** and **`isRCVerified`** both **`APPROVED`** (FairCoin onboarding).

### BD: re-upload after rejection?

Upload/confirm handlers generally **block only when** the relevant flag is already **`APPROVED`**. If admin sets **`REJECTED`**, the pilot can call upload/confirm again **unless** the specific method forbids it (e.g. live selfie is restricted when **`selfieUrl` exists and** status is **`APPROVED`** — rejected pilots with a stored selfie URL may still be able to replace; verify in QA).

### BD: strict upload order in code?

**No single pipeline:** steps can be started in different orders **except** where URLs must exist for `determineUserStatus` to move to `IN_REVIEW`. **Tax token** sets `IN_PROGRESS` on upload without a separate “confirmation” endpoint (unlike DL/RC/NID/plate).

---

## India flow

| Step | Endpoint(s) | Preconditions | Verification flag | Auto vs admin |
|------|-------------|-----------------|-------------------|---------------|
| 1 | `POST /pilot/driving-license` or `…/driving-license/manual` | — | `isDLVerified` → **`APPROVED`** on success | **Auto** (Signzy + OCR path) |
| 2 | `POST /pilot/live-selfie` | — | `isSelfieVerified` → **`IN_PROGRESS`** | Admin (same as BD) |
| 3 | `POST /pilot/vehicle-rc` or `…/manual` | **`selfieUrl` required** | Creates `Vehicle`; `isRCVerified` → **`APPROVED`** | **Auto** (Signzy) |
| 4 | `POST /pilot/pancard` or `…/manual` | **`isRCVerified === APPROVED`** | `isPanCardVerified` → **`APPROVED`** | **Auto** (Signzy PAN) |
| 5a | `POST /pilot/aadhaar` or `…/aadhaar/manual` | **`isPanCardVerified === APPROVED`** | Sends Cashfree OTP; returns `ref_id` | — |
| 5b | `POST /pilot/aadhaar/verify` | Valid OTP | `isAadhaarVerified` → **`APPROVED`** | **Auto** (Cashfree verify) |

**Optional:** `GET /pilot/onboarding-offer` uses the same DL+RC **APPROVED** check as BD (India pilots satisfy this via **auto** DL/RC).

### India: admin approval?

**DL + RC + PAN + Aadhaar:** **No** `verifyDriver` document types for PAN/Aadhaar; those flags are set by **vendor** flows only. **Selfie** can still be **`IN_PROGRESS`** until staff use `DocumentType.SELFIE` in admin.

### India: re-upload?

PAN/Aadhaar flows **do not** mirror BD’s “reject then re-upload” pattern in `verifyDriver`. Re-runs depend on whether Prisma **create** calls (e.g. `DrivingLicense.create`) would **fail** on duplicate — **risk of errors** on second attempt; treat as **not first-class** in code.

### India: `User.status` gap

`determineUserStatus` **ignores** PAN/Aadhaar. An India pilot can have **both auto-approved** while `User.status` still reflects only the **BD-shaped** URL checklist (often **incomplete** if BD URLs are empty). **`beOnline`** requires `User.status === ACTIVE`, so India onboarding may **depend** on admin setting user active or on product-specific flows **not** fully modeled in this helper — **verify operationally**.

---

## Summary answers (audit style)

| Question | Answer |
|----------|--------|
| What status on each step? | See tables: mostly **`IN_PROGRESS`** after pilot submit (BD) or vendor success (India auto paths); **`APPROVED`/`REJECTED`** via **admin** for BD docs in `DocumentType` enum. |
| Admin vs auto? | **India:** Signzy/Cashfree **auto-**`APPROVED` for DL, RC, PAN, Aadhaar; selfie **admin**. **Bangladesh:** confirmation sets **`IN_PROGRESS`**; **admin** approves/rejects via `verifyDriver`. **Tax token (BD):** **`IN_PROGRESS`** on upload, then admin. |
| Re-upload on rejection? | **BD:** Yes in principle (**not** `APPROVED`). **India:** Vendor paths; duplicates may break — **not robustly designed** for repeat. |
| Required order? | **India:** **DL (any order vs selfie)** → **selfie** → **RC** (needs selfie) → **PAN** (needs RC) → **Aadhaar** (needs PAN). **Bangladesh:** **No strict API order**; all listed assets must exist for “all documents uploaded”; practical order matches product (selfie → DL → NIDs → RC → plate → tax). |
