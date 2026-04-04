# `src/config/jwt.config.ts`

## Role

**Async factory** for `JwtModule.registerAsync`: builds `JwtModuleOptions` from `ConfigService`, ensuring `jwt.secret` is present.

## Functions

| Function | Description |
|----------|-------------|
| `getJwtConfig(configService: ConfigService): JwtModuleOptions` | Reads `jwt.secret`; throws if missing. Returns `{ secret, signOptions: { expiresIn: jwt.accessTokenExpiresIn } }`. Used for signing **access** tokens; refresh token expiry is separate (see auth service / Redis). |

## Notes

- HTTP `JwtAuthGuard` verifies tokens with the same secret and checks Redis for a matching stored access token.
