# `prisma/seed.ts`

## Role

**Database seed** script run via `pnpm seed` / `ts-node prisma/seed.ts`: inserts baseline languages, vehicle types, subscriptions, admin users, or test data needed for local/staging.

## How to run

```bash
pnpm seed
```

## Notes

- Keep idempotent where possible; check for existing rows before insert.
