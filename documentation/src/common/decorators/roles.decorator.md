# `src/common/decorators/roles.decorator.ts`

## Role

Declares **metadata** for which `UserRole` values may access a route handler or controller. Consumed by `RolesGuard`.

## Exports

| Export | Description |
|--------|-------------|
| `ROLES_KEY` | Metadata key string `'roles'`. |
| `Roles(...roles: UserRole[])` | `SetMetadata(ROLES_KEY, roles)` helper. |
