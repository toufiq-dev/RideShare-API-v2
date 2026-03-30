# `src/common/decorators/user.decorator.ts`

## Role

**Parameter decorator** to read the authenticated user from `request.user` (set by JWT guards). Optional property name returns a single field (e.g. `userId`).

## Export: `CurrentUser`

| Usage | Returns |
|-------|---------|
| `@CurrentUser()` | Full `request.user` object. |
| `@CurrentUser('userId')` | `user.userId` (or throws if user missing). |

## Notes

- Throws if `user` is absent — routes must run after `JwtAuthGuard`.
