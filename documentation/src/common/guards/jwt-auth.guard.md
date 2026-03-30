# `src/common/guards/jwt-auth.guard.ts`

## Role

HTTP **JWT authentication guard**. Expects `Authorization: Bearer <token>`, verifies JWT with configured secret, then ensures the token matches the value stored in Redis under `accessToken:{userId}`. Attaches decoded payload to `request.user`.

## Class: `JwtAuthGuard`

| Method | Description |
|--------|-------------|
| `constructor(configService, jwtService, redis)` | Reads and stores `jwt.secret`. |
| `canActivate(context)` | Extracts Bearer token; `verifyAsync`; compares to Redis; sets `request.user`; throws `UnauthorizedException` on failure. |

## Notes

- Invalidation of sessions is done by deleting/updating Redis keys (e.g. on logout).
- Contains a `console.log` of `request.user` — consider removing in production for noise/security.
