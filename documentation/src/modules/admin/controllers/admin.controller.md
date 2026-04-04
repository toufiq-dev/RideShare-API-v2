# `src/modules/admin/controllers/admin.controller.ts`

## Role

Primary **admin API** surface: login, staff, permissions, support roles, drivers, documents, app version, subscriptions, promoters — see grep/route list in README or source for full table.

## Notes

- Typically guarded by admin JWT (`JwtAuthGuard` + admin role) except `login`.
