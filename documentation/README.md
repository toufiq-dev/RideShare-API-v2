# FairDrive API — documentation

This folder contains **narrative** and **diagrammatic** documentation. It complements—but does not replace—the **running API contract** and **source code**.

## Canonical sources of truth

| Concern | Source of truth | Notes |
|---------|-----------------|--------|
| **REST endpoints** (paths, methods, request bodies, auth) | **Swagger UI** at `/api-docs` on a running server | Generated from Nest decorators (`@ApiTags`, `@ApiBody`, controllers). **Prefer Swagger** when integrating a client. |
| **WebSocket events** | `src/core/socket/socket-events.ts` + `MainGateway` | Namespace `/socket`; auth via handshake. |
| **Database schema** | `prisma/schema.prisma` | Migrations apply the real DDL. |
| **Configuration keys** | `src/config/app.config.ts` + [`.env.example`](../.env.example) | Env var **names**; values are local/secret. |
| **Per-module behavior** | `documentation/src/**` mirrors `src/**` | Explains *why* and *how* at file level; may lag—verify against git if unsure. |

Markdown under `documentation/src/` is **descriptive**. If Swagger and a `.md` file disagree, **trust Swagger and the code**, then fix the doc.

---

## Where to read next

| Topic | Location |
|-------|----------|
| **Architecture & Mermaid flows** | [`architecture/README.md`](architecture/README.md), [`architecture/flows.md`](architecture/flows.md) |
| **ER-style data model** | [`prisma/data-model.md`](prisma/data-model.md) |
| **Run / deploy / observe** | [`operations/README.md`](operations/README.md) |
| **Third-party vendors** | [`integrations/README.md`](integrations/README.md) |
| **Per-source-file notes** | [`src/`](src/main.md) (tree mirrors `src/`) |

---

## Third-party integrations

Vendor setup (env var **names**, dashboards, sandbox vs live, callback routes): **[`integrations/README.md`](integrations/README.md)**.

---

## How to navigate per-file docs

| Area | Path | What it covers |
|------|------|----------------|
| Bootstrap | [`src/main.md`](src/main.md) | Process entry: NestFactory, CORS, Swagger, global middleware |
| Composition | [`src/app.module.md`](src/app.module.md) | Root module: imports all feature modules, JWT, Bull, middleware |
| Config | [`src/config/`](src/config/) | `app.config.ts` (env → structured config), `jwt.config.ts` |
| Cross-cutting | [`src/common/`](src/common/) | Guards, interceptors, filters, middleware, shared DTOs/types |
| Infrastructure | [`src/core/`](src/core/) | Prisma, Redis, logging, metrics, WebSockets, Firebase, geofencing, Bull |
| Features | [`src/modules/`](src/modules/) | Auth, customer, ride, pilot, admin, payment, email, fare, maps, pricing, program, subscriptions, languages, chat, health |
| Database | [`prisma/`](prisma/) | Schema notes; seeds — see also [`prisma/data-model.md`](prisma/data-model.md) |

---

## Architecture (short)

- **Framework:** NestJS 11, TypeScript.
- **API:** REST + Swagger at `/api-docs`; WebSocket namespace `/socket` for chat and live location.
- **Data:** PostgreSQL via Prisma 7 (`PrismaService` uses `@prisma/adapter-pg`).
- **Cache / realtime:** Redis (sessions, geo, pub/sub, token store); Socket.IO with JWT validation.
- **Jobs:** BullMQ backed by Redis (`core/queue/bull.config.ts`).
- **Observability:** Prometheus metrics at `/metrics`; Winston logs (files + optional Loki).

Diagrams: [`architecture/flows.md`](architecture/flows.md).

---

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
| **health** | `@nestjs/terminus` probes (`/health`, `/health/detailed`) |

---

## Per-file pages

Open the `.md` file that matches the path of the source (e.g. `src/modules/ride/ride.service.ts` → `documentation/src/modules/ride/ride.service.md`). Typical contents:

1. **Role** — what the file does in the system.
2. **Exports / routes** — classes, DTOs, HTTP routes where relevant.
3. **Functions / methods** — summaries (large services are overview-style).

---

*When in doubt, the TypeScript source and Swagger remain the source of truth.*
