# ER diagrams (from Prisma schema)

Source: `prisma/schema.prisma`. Diagrams are **simplified views** (not every column). All models use a UUID `id` primary key unless noted.

---

## 1. Identity and roles

One `User` row per login identity; role-specific profile is 1:1.

```mermaid
erDiagram
  User ||--o| Customer : "userId"
  User ||--o| Pilot : "userId"
  User ||--o| Admin : "userId"
  User ||--o| SuperAdmin : "userId"
  User ||--o| Support : "userId"
  User ||--o| Promoter : "userId"
  User ||--o| DeviceToken : "userId PK"
  Customer }o--|| Languages : "languageId"
  Pilot }o--|| Languages : "languageId"
  Customer }o--o| Coupon : "couponId"
  Promoter ||--o{ Pilot : "promoterId"
```

---

## 2. Pilot onboarding and vehicle

```mermaid
erDiagram
  Pilot ||--o| DrivingLicense : "pilotId unique"
  Pilot ||--o| Nid : "pilotId PK"
  Pilot ||--o| Vehicle : "pilotId unique"
  Pilot ||--o| NumberPlate : "pilotId PK"
  Pilot ||--o| TaxToken : "pilotId PK"
  Pilot ||--o| PilotWallet : "pilotId unique"
  Pilot }o--o| VehicleTypeBD : "primaryVehicleTypeId"
  Pilot }o--o| PilotProgram : "pilotProgramId"
  Pilot }o--o| PilotCoupon : "pilotCouponId"
  Vehicle }o--o| VehicleTypeBD : "vehicleTypeIdBD"
  Vehicle }o--o| VehicleType : "vehicleTypeId"
  Pilot ||--o{ AdminDocumentSubmission : "pilotId"
```

---

## 3. Bookings and ride lifecycle

```mermaid
erDiagram
  Customer ||--o{ Booking : "customerId"
  Pilot ||--o{ Booking : "pilotId"
  Vehicle ||--o{ Booking : "vehicleId"
  VehicleTypeBD ||--o{ Booking : "vehicleTypeIdBD"
  Customer }o--o| Booking : "activeBookingId CustomerActiveBooking"
  Pilot }o--o| Booking : "activeBookingId PilotActiveBooking"
  Booking ||--o| CancellationReason : "bookingId unique"
  Booking ||--o| CustomerRating : "bookingId unique"
  Booking ||--o| PilotRating : "bookingId unique"
  Booking ||--o{ Message : "bookingId"
  Booking ||--o{ SupportTicket : "bookingId"
```

---

## 4. Wallet, trips, and subscriptions

```mermaid
erDiagram
  Pilot ||--o| PilotWallet : "pilotId unique"
  Subscription ||--o{ PilotWallet : "subscriptionId"
  Pilot ||--o{ Transaction : "pilotId"
  PilotWallet ||--o{ Transaction : "walletId"
  Subscription ||--o{ Transaction : "subscriptionId"
  Pilot ||--o{ PilotTrips : "pilotId"
  Subscription ||--o{ PilotCoupon : "subscriptionId"
```

---

## 5. Programs, rankings, achievements

```mermaid
erDiagram
  PilotProgram ||--o{ Pilot : "pilotProgramId"
  PilotProgram ||--o{ PilotProgramEnrollment : "programId"
  Pilot ||--o{ PilotProgramEnrollment : "pilotId"
  Pilot ||--o{ PilotRanking : "pilotId"
  VehicleTypeBD ||--o{ PilotRanking : "vehicleTypeId"
  Achievement ||--o{ PilotAchievement : "achievementId"
  Pilot ||--o{ PilotAchievement : "pilotId"
```

---

## 6. Tariffs, i18n, and misc

```mermaid
erDiagram
  VehicleTypeBD ||--o{ Tariff : "vehicleTypeBDId"
  Languages ||--o{ Translation : "languageId"
  VideoTutorial ||--o{ VideoProgress : "videoId"
  Pilot ||--o| VideoProgress : "pilotId unique"
  Announcement ||--o{ AnnouncementDelivery : "announcementId"
  User ||--o{ AnnouncementDelivery : "userId"
  Support ||--o{ SupportTicket : "supportId"
  User ||--o{ SupportTicket : "userId"
  SupportRole ||--o{ Support : "supportRoleId"
  SupportRole }o--o{ SupportPermission : "M N"
```

---

## 7. Caching / auxiliary

```mermaid
erDiagram
  VehicleClassificationCache {
    string id PK
    string category
  }
  SystemConfig {
    string id PK
    string key UK
    json value
  }
  Platform {
    string id PK
    string appDescription UK
  }
  Policy {
    string id PK
  }
  SavedPlace {
    string id PK
    string customerId FK
  }
  Customer ||--o{ SavedPlace : "customerId"
```
