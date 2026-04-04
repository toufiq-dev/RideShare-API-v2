# `src/common/guards/query-token.guard.ts`

## Role

Authenticates requests using a **JWT passed as a query parameter** (`?token=`) instead of the `Authorization` header. Verifies with `JwtService` default options and sets `request.user`.

## Class: `QueryTokenGuard`

| Method | Description |
|--------|-------------|
| `canActivate(context)` | Reads `request.query.token`; throws if missing; `verifyAsync(token)`; assigns `request.user`; `UnauthorizedException` on invalid token. |

## Notes

- `PrismaService` is injected but unused in the shown snippet — may be legacy; safe to remove if confirmed.
