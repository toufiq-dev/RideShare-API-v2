# `src/modules/admin/dto/admin.dto.ts`

## Role

Large collection of **admin DTOs**: login, password reset, email verify, staff edit, menu permissions, support roles, driver verification, app version, subscription admin, promoter payloads, etc. Each class uses `class-validator` + `@ApiProperty` for Swagger.

## Notes

- Pair each DTO with the controller method that consumes it.
