# `src/core/socket/main.gateway.ts`

## Role

**WebSocket gateway** on namespace `/socket`, guarded by `WsJwtAuthGuard`. Delegates connection lifecycle to `SocketService`; handles chat send and pilot live location updates (delegating to `RideService` and `RideNotificationService`).

## Class: `MainGateway`

| Member | Description |
|--------|-------------|
| `onModuleInit()` | `socketService.setServer(this.server)`. |
| `handleConnection(client)` | Logs; calls `socketService.handleConnection`; error handling + disconnect. |
| `handleDisconnect(client)` | `socketService.handleDisconnect`. |

### Message handlers

| Event | Handler | Description |
|-------|---------|-------------|
| `ChatEvents.SEND_MESSAGE` | `handleSendMessage` | Validates user; `chatService.sendMessage`; emits `RECEIVE_MESSAGE` to sender and recipient rooms. |
| `RideEvents.UPDATE_PILOT_LOCATION` | `updateLocation` | Validates lat/lng; `rideService.handleUpdateLocation`; if accepted ride, notifies customer live location. |

## Decorators

- `@WebSocketGateway({ namespace: '/socket', cors, transports })`
- `@UseGuards(WsJwtAuthGuard)` at class level
