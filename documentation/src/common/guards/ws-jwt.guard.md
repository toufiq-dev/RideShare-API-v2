# `src/common/guards/ws-jwt.guard.ts`

## Role

**WebSocket JWT guard** for Socket.IO. Reads token from `client.handshake.auth.token`, verifies with `JwtService`, and stores payload on `client.data.user`.

## Class: `WsJwtAuthGuard`

| Method | Description |
|--------|-------------|
| `canActivate(context)` | Gets `Socket` client; `verifyAsync(token)`; sets `client.data.user`; throws `WsException` on missing/invalid token. |

## Notes

- `MainGateway` also uses `@UseGuards(WsJwtAuthGuard)` at class level; `SocketService.handleConnection` performs additional Redis token checks.
