# `src/common/guards/roles.guard.ts`

## Role

**Role-based access control** guard. Reads metadata key `'roles'` (set by `@Roles()` decorator) and ensures `request.user.role` is one of the allowed roles.

## Class: `RolesGuard`

| Method | Description |
|--------|-------------|
| `constructor(reflector)` | Injects Nest `Reflector`. |
| `canActivate(context)` | Gets `UserRole[]` from handler/class metadata; if none, allows; otherwise checks `requiredRoles.includes(user.role)`. |

## Usage

Combine with `@UseGuards(JwtAuthGuard, RolesGuard)` and `@Roles(UserRole.CUSTOMER)`.
