# `src/modules/admin/services/admin-driver.service.ts`

## Role

**Driver-specific admin operations** split from `AdminService` for maintainability: filters, lists, or actions focused on pilots (exact methods in source).

## Notes

- Used by `AdminDriverController` or `AdminController` depending on module wiring.
