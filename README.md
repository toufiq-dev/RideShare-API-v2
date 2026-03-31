# FairDrive API – Technical Documentation

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Getting Started](#getting-started)
   - [Prerequisites](#prerequisites)
   - [Installation](#installation)
   - [Configuration](#configuration)
   - [Running the Server](#running-the-server)
4. [Project Structure](#project-structure)
5. [Core Modules](#core-modules)
6. [Common Utilities & Middleware](#common-utilities--middleware)
7. [Database & ORM](#database--orm)
8. [Testing](#testing)
9. [Deployment](#deployment)
10. [API Reference](#api-reference)
11. [Contributing](#contributing)
12. [License](#license)
13. [Contact](#contact)

---

## Overview

**FairDrive API** is a modular, scalable backend server built with [NestJS](https://nestjs.com/), designed to power ride-sharing and related services. It features robust authentication, real-time communication, payment processing, geofencing, and more. The project leverages Prisma ORM for database management and is structured for maintainability and extensibility.

**Extended docs (diagrams, integrations, `.env` template):** see the [`documentation/`](documentation/README.md) folder — **REST contract** is still Swagger at `/api-docs` on a running server.

---

## Architecture

- **Framework:** [NestJS](https://nestjs.com/) (TypeScript)
- **Database:** Managed via [Prisma ORM](https://www.prisma.io/)
- **Authentication:** JWT-based, with role-based access control
- **Real-time:** WebSocket gateways for chat and ride updates
- **Queueing:** Bull for background jobs
- **Caching:** Redis integration
- **Deployment:** Docker-ready, PM2 ecosystem config

---

## Getting Started

### Prerequisites

- Node.js (v16+ recommended)
- pnpm
- Docker
- PostgreSQL
- Redis

### Installation

```bash
git clone <repo-url>
cd fairdrive-api
pnpm install
```

### Configuration

- Copy.
- Main configuration files are in `src/config/`:
  - `app.config.ts`
  - `jwt.config.ts`

### Running the Server

**First Run Docker command**
```bash
docker-compose up --d
```

**Development:**
```bash
pnpm run start:dev
```

**Production:**
```bash
pnpm run build
pnpm run start:prod
```


---

## Project Structure

```plaintext
fairdrive-api/
│
├── src/
│   ├── main.ts                # Entry point
│   ├── app.module.ts          # Root module
│   ├── config/                # App and JWT config
│   ├── modules/               # Feature modules (auth, customer, ride, etc.)
│   ├── core/                  # Core services (utils, cache, socket, etc.)
│   ├── common/                # Shared code (filters, guards, DTOs, etc.)
│
├── prisma/                    # Prisma schema, migrations, seed scripts
├── test/                      # End-to-end and integration tests
├── static/                    # Static assets (geojson, etc.)
├── uploads/                   # Uploaded files
├── package.json
├── docker-compose.yml
├── README.md
└── ...
```

---

## Core Modules

### 1. Authentication (`src/modules/auth/`)
- **Files:** `auth.service.ts`, `auth.controller.ts`, `auth.module.ts`, `dto/`, `validator/`
- **Features:** JWT authentication, phone number validation, multi-country support, role-based guards.

### 2. Customer (`src/modules/customer/`)
- **Files:** `customer.service.ts`, `customer.controller.ts`, `customer.module.ts`, `dto/`
- **Features:** Customer registration, profile management, ride history.

### 3. Ride (`src/modules/ride/`)
- **Files:** `ride.service.ts`, `ride.controller.ts`, `ride.gateway.ts`, `ride-notification.service.ts`, `dto/`, `processor/`
- **Features:** Ride booking, status updates, real-time ride tracking, notifications.

### 4. Pilot (`src/modules/pilot/`)
- **Files:** `pilot.service.ts`, `pilot.controller.ts`, `pilot.module.ts`, `dto/`, `interfaces/`
- **Features:** Pilot (driver) onboarding, verification, trip management.

### 5. Admin (`src/modules/admin/`)
- **Files:** `admin.service.ts`, `admin.controller.ts`, `admin.module.ts`, `dto/`
- **Features:** Admin operations, user management, reporting.

### 6. Subscriptions, Payment, Email, Chat, Languages
- **Directories:** `subscriptions/`, `payment/`, `email/`, `chat/`, `languages/`
- **Features:** Subscription management, payment processing, email notifications, chat (WebSocket), language support.

---

## Common Utilities & Middleware

- **Guards:** JWT, role-based, WebSocket token guards (`src/common/guards/`)
- **Filters:** Exception handling (`src/common/filters/`)
- **Interceptors:** Response transformation, file handling (`src/common/interceptors/`)
- **Decorators:** Custom decorators for roles and user extraction (`src/common/decorators/`)
- **Middleware:** Error logging (`src/common/middleware/`)
- **DTOs & Types:** Shared data transfer objects and type definitions (`src/common/dto/`, `src/common/types/`)

---

## Database & ORM

- **Prisma Schema:** `prisma/schema.prisma`
- **Migrations:** `prisma/migrations/`
- **Seeding:** `prisma/seed.ts`
- **Services:** `src/core/database/prisma.service.ts`

---

## Testing

- **Test Directory:** `test/`
- **Framework:** Jest (NestJS default)
- **Sample Test:** `app.e2e-spec.ts`
- **Config:** `jest-e2e.json`

---

## Deployment

- **Docker Compose:** `docker-compose.yml` for multi-service orchestration
- **PM2:** `ecosystem.config.js` for process management
- **Static Assets:** Served from `static/`
- **Uploads:** Handled in `uploads/`

---

## API Reference

> **Canonical reference:** Open **Swagger** at `/api-docs` when the server is running (generated from Nest decorators).  
> **Narrative + diagrams:** [`documentation/README.md`](documentation/README.md) (per-file notes under `documentation/src/`, flows in `documentation/architecture/`).  
> Endpoints are RESTful and follow standard HTTP conventions.

### Example Endpoints

- `POST /auth/login` – Authenticate user
- `POST /ride/book` – Book a ride
- `GET /customer/profile` – Get customer profile
- `POST /pilot/onboard` – Onboard a new pilot
- `POST /payment/charge` – Process a payment

**WebSocket Gateways:**
- `/ride` – Real-time ride updates
- `/chat` – Real-time chat

**Swagger/OpenAPI:**  
If enabled, API docs are available at `/api` (see `main.ts` for Swagger setup).

---

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/your-feature`)
3. Commit your changes
4. Push to your branch
5. Open a Pull Request

**Coding Standards:**  
- Follow the existing code style (see `.eslintrc.js`, `.prettierrc`)
- Write/extend tests for new features
- Document your code

---

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

---

## Contact

For questions, issues, or contributions, please open an issue or contact the maintainers via the repository.

---

### Appendix: Additional Resources

- [NestJS Documentation](https://docs.nestjs.com/)
- [Prisma Documentation](https://www.prisma.io/docs/)
- [Docker Documentation](https://docs.docker.com/)

---

If you need a more detailed API reference, module-specific documentation, or code-level comments, let me know!
