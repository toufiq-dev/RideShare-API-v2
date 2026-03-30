# FairDrive API — Code documentation

This directory mirrors the repository layout: each `documentation/**/*.md` file documents the corresponding `src/**/*.ts` (or `prisma/*`) source file.

## Third-party integrations

Vendor-specific setup (env var **names**, dashboards, sandbox vs live, callback routes): **[`integrations/README.md`](integrations/README.md)** (Google Maps, SSLCommerz, Cashfree, SMS, Signzy, Firebase, Azure).

## How to navigate

| Area | Path | What it covers |
|------|------|----------------|
| Bootstrap | [`src/main.md`](src/main.md) | Process entry: NestFactory, CORS, Swagger, global middleware |
| Composition | [`src/app.module.md`](src/app.module.md) | Root module: imports all feature modules, JWT, Bull, middleware |
| Config | [`src/config/`](src/config/) | `app.config.ts` (env → structured config), `jwt.config.ts` |
| Cross-cutting | [`src/common/`](src/common/) | Guards, interceptors, filters, middleware, shared DTOs/types |
| Infrastructure | [`src/core/`](src/core/) | Prisma, Redis, logging, metrics, WebSockets, Firebase, geofencing, Bull |
| Features | [`src/modules/`](src/modules/) | Auth, customer, ride, pilot, admin, payment, email, fare, maps, pricing, program, subscriptions, languages, chat, health |
| Database | [`prisma/`](prisma/) | Schema models; seed scripts |

## Architecture

- **Framework:** NestJS 11, TypeScript.
- **API:** REST + Swagger at `/api-docs`; WebSocket namespace `/socket` for chat and live location.
- **Data:** PostgreSQL via Prisma 7 (`PrismaService` uses `@prisma/adapter-pg`).
- **Cache / realtime:** Redis (sessions, geo, pub/sub, token store); Socket.IO with JWT validation.
- **Jobs:** BullMQ backed by Redis (`core/queue/bull.config.ts`).
- **Observability:** Prometheus metrics at `/metrics`; Winston logs (files + optional Loki).

## Module responsibilities

| Module | Responsibility |
|--------|----------------|
| **auth** | Phone OTP (BD/IN), JWT access/refresh stored in Redis, geofence check, logout, account deletion |
| **customer** | Profile, saved places, fare preview, coupons, onboarding |
| **ride** | Booking, multi-iteration driver search, accept/start/end/cancel, ratings, history |
| **pilot** | KYC documents (BD/IN), vehicles, wallet, go online, subscriptions integration |
| **admin** | Dashboard auth, staff/support roles, driver verification, promoters, vehicle types |
| **payment** | SSLCommerz and Cashfree-related payment flows for subscriptions/wallet |
| **email** | Email OTP queue (Bull) + Azure Communication / SMTP fallback |
| **fare** | Admin fare CRUD for `VehicleTypeBD`; distance/duration via Google |
| **maps** | Google Maps Directions, Geocoding, Places autocomplete/details |
| **pricing** | Tariff artifacts, multipliers, telemetry for pricing experiments |
| **program** | Pilot programs, leaderboards, scheduled ranking |
| **subscriptions** | Pilot subscription products and purchase helpers |
| **languages** | CRUD/list languages for apps |
| **chat** | Persisted messages; realtime via `MainGateway` |
| **health** | `@nestjs/terminus` probes |

## Per-file pages

Open the `.md` file that matches the path of the source you are reading (e.g. `src/modules/ride/ride.service.ts` → `documentation/src/modules/ride/ride.service.md`). Each page includes:

1. **Role** — what the file does in the system.
2. **Exports** — classes, decorators, DTOs, constants.
3. **Functions / methods** — descriptions of public behaviors.

---

*Generated and curated for the FairDrive API repository. When in doubt, the TypeScript source remains the source of truth.*
