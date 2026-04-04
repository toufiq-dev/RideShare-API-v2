# Data dictionary (non-obvious fields)

Abbreviations: **DL** = driving license, **RC** = registration certificate, **NID** = national ID, **BD** = Bangladesh product line.

## Cross-cutting

| Location | Field | Meaning |
|----------|--------|---------|
| `User` | `metadata` | Arbitrary JSON for app/account flags (not strictly typed in API) |
| `User` | `status` | Lifecycle: onboarding, active, suspended, etc. (`UserStatus`) |
| `User` | `role` | Discriminates which 1:1 profile exists (`UserRole`) |

## Customer

| Field | Meaning |
|-------|---------|
| `activeBookingId` | Optional pointer to the customer’s current in-app booking (named relation `CustomerActiveBooking`) |
| `isAlreadyRegistered` | Legacy / UX flag; not the same as `User.status === ACTIVE` |
| `isOnboardingCompleted` | Profile/setup completion vs document verification |
| `couponId` | Optional active marketing coupon applied to fare |

## Pilot

| Field | Meaning |
|-------|---------|
| `onlineStatus` | Operational state: available for dispatch, on trip, offline (`PilotStatus`) |
| `activeBookingId` | Optional pointer to current trip booking (`PilotActiveBooking`) |
| `pilotType` | Tier: regular / super / star pilot (`PilotType`); affects fare deduction rules in app logic |
| `primaryVehicleTypeId` | BD vehicle category for leaderboard / program normalization when vehicle row is missing |
| `currentRank` / `lastRankUpdate` | Cached leaderboard position (denormalized for quick reads) |
| `totalLifetimeEarnings` / `totalLifetimeRides` / `weeklyEarnings` / `monthlyEarnings` | Aggregates maintained by business logic |
| `currentLocation` | JSON snapshot of last known coordinates (also Redis geo used for dispatch) |
| `is*Verified` + `*RejectionReason` | Document pipeline state (`VerificationStatus`) per document type |
| `isFairCoinAvailed` | One-time or promotional wallet flag (product-specific) |
| `starPilotSince` / `superPilotSince` | When tier was granted |
| `superPilotVideoUrl` / `superPilotVideoUploadedAt` | Super pilot program evidence |

## Vehicle

| Field | Meaning |
|-------|---------|
| `vehicleTypeId` | **India** taxonomy (`VehicleType` / `VehicleTypeName`) |
| `vehicleTypeIdBD` | **Bangladesh** taxonomy (`VehicleTypeBD` / `VehicleTypeNameBD`) |
| `fitUpto`, `insuranceUpto`, `puccUpto`, `regUpto`, `permitUpto` | Compliance dates from RC / verification vendors |
| `distance` / `duration` (on **Booking**) | Optional actuals vs `estimatedDistance` / `estimatedDuration` |

## Booking

| Field | Meaning |
|-------|---------|
| `bookingCode` | Human-facing short code; not the primary key |
| `name` | For `RideType.OTHERS`, passenger name; for `SELF` often matches customer name |
| `pickupLocation` / `dropLocation` | JSON (typically lat/lng + address mirror); matches API `LocationDto` shape in code |
| `estimatedDistance` | Stored as **string** in DB (historical); `distance` may hold post-trip actual |
| `estimatedDuration` | Minutes (Int); `duration` may hold actual as string |
| `tripEndFare` | Final charged amount snapshot at trip end |
| `surgeMultiplier` | Pricing surge applied to base calculation |
| `pilotType` | Pilot tier **at accept time** (snapshot for billing / analytics) |

## Wallet and transactions

| Field | Meaning |
|-------|---------|
| `PilotWallet.minusLimit` | How far negative `balance` may go (FairCoin / subscription model) |
| `PilotWallet.todaysEarning` / `lastTripEarning` / `date` | Denormalized dashboard fields (Dhaka TZ in app logic) |
| `PilotWallet.autoRecharge*` | Cashfree / subscription auto top-up configuration |
| `Transaction.order_id` | Payment gateway order reference |
| `Transaction.metadata` | Gateway callbacks, reconciliation attempts, JSON blobs |
| `TransactionType.NO_TRIP_DEDUCTION` | Super-pilot / rank waiver of per-trip coin deduction |

## Programs and rankings

| Model | Field | Meaning |
|-------|--------|---------|
| `PilotProgram` | `criteria` | JSON rules (e.g. `maxSuperPilots`, thresholds); parsed in services |
| `PilotProgram` | `programType` | `SUPER_PILOT`, `STAR_PILOT`, etc. |
| `PilotProgramEnrollment` | `isCurrentlyActive` / `achievedAt` | Enrollment state vs completion time |
| `PilotRanking` | `calculatedAt` | Snapshot timestamp for a leaderboard run |
| `PilotRanking` | `totalPilots` | Cohort size when rank was computed |

## Admin / support

| `AdminDocumentSubmission` | `metadata` | Extra OCR / reviewer context |
| `AdminDocumentSubmission` | `reviewerRole` | Which role approved/rejected |
| `SupportTicket` | `notes` | JSON or structured internal notes |
| `CancellationReason` | `supportId` | Optional link if support cancelled |

## Config and platform

| `SystemConfig` | `key` / `value` | Key-value JSON config (cities, thresholds, feature flags) |
| `Platform` | `adDriverVersion` / `iosCustomerVersion` | Minimum or published app versions per store |
| `VehicleClassificationCache` | composite unique | Avoids duplicate LLM classification for same vehicle signature |

## Achievements and content

| `Achievement` | `criteria` | JSON unlock rules |
| `Announcement` | `audience` | Target segment for push/in-app |
| `AnnouncementDelivery` | `status` | Delivery pipeline state |
