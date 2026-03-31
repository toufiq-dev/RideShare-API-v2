# End-to-end flows (Mermaid)

These diagrams are **approximate** and meant for onboarding. For exact branching and error paths, read the referenced services.

---

## 1. Phone auth (OTP → JWT)

Typical path: `AuthService.sendOtp` → `verifyOtp` → Redis session + Prisma user.

```mermaid
sequenceDiagram
  participant C as Client
  participant API as AuthController
  participant S as AuthService
  participant R as Redis
  participant SMS as SMS provider
  participant DB as PostgreSQL

  C->>API: POST /auth/send-otp
  API->>S: sendOtp
  S->>R: store otp / rate limits
  S->>SMS: send OTP (BD or IN)
  SMS-->>C: SMS delivered
  C->>API: POST /auth/verify-otp
  API->>S: verifyOtp
  S->>R: validate otp
  S->>DB: findOrCreate user / pilot / customer
  S->>R: store access + refresh tokens
  S-->>C: JWT + user payload
```

**Related code:** `src/modules/auth/auth.service.ts`, `src/core/utils/otp.util.ts`.

---

## 2. Ride request → driver search → accept

High-level only; `DriverSearchService` uses Redis pub/sub, GEO, and iteration config.

```mermaid
flowchart TD
  A[POST /ride/request] --> B[Create Booking PENDING]
  B --> C[DriverSearchService.searchDrivers]
  C --> D[Redis GEO + notify pilots]
  D --> E{Pilot accepts?}
  E -->|yes| F[Booking ACCEPTED + notify customer]
  E -->|timeout| G[Cancel / DRIVER_NOT_FOUND]
  F --> H[Socket + FCM updates]
```

**Related code:** `src/modules/ride/ride.service.ts`, `src/modules/ride/services/driver-search.service.ts`, `src/modules/ride/services/ride-notification.service.ts`.

---

## 3. SSLCommerz subscription payment (app-driven callbacks)

The mobile client completes checkout, then calls the API with the **same authenticated session** (Bearer JWT). Server validates with SSLCommerz validator APIs.

```mermaid
sequenceDiagram
  participant App as Pilot app
  participant API as PaymentController
  participant P as PaymentService
  participant SSL as SSLCommerz validator API
  participant DB as PostgreSQL

  App->>API: POST /payment/sslcommerz/init
  API->>P: initSslcommerzSubscription
  P->>DB: create Transaction PENDING
  P-->>App: session / redirect payload
  Note over App: User pays in SSLCommerz UI
  App->>API: GET /payment/sslcommerz/success?transactionId=
  API->>P: verifySslcommerzSuccess
  P->>SSL: validate transaction
  SSL-->>P: validation result
  P->>DB: update wallet / transaction SUCCESS
  P-->>App: result
```

**Related code:** `src/modules/payment/payment.service.ts`, `src/modules/payment/payment.controller.ts`.

---

## 4. Realtime: chat or live location

Both use the same Socket.IO server; JWT is validated on connect (`SocketService` + Redis token check).

```mermaid
flowchart LR
  subgraph socket[Namespace /socket]
    G[MainGateway]
  end
  C1[Customer] -->|JWT in handshake| G
  P1[Pilot] -->|JWT in handshake| G
  G --> Chat[ChatService sendMessage]
  G --> Ride[RideService location update]
  Chat --> DB[(messages)]
  Ride --> RD[(Redis GEO / cache)]
```

**Related code:** `src/core/socket/main.gateway.ts`, `src/core/socket/socket.service.ts`.
