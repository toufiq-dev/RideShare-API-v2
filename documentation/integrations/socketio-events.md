# Socket.IO — WebSocket events (Q42)

**Source:** `src/core/socket/main.gateway.ts`, `src/core/socket/socket.service.ts`, `src/core/socket/socket-events.ts`, `src/modules/ride/services/ride-notification.service.ts`, `src/modules/auth/auth.service.ts`.  
**Note:** `DEVELOPER_QUERY_SHEET.md` is not in this repository.

## Connection

| Item | Value |
|------|--------|
| Namespace | `/socket` |
| Client library | **`socket.io-client` v4.x** (match server `socket.io` **^4.8.1** in `package.json`) |
| Base URL example | `io('https://<API_HOST>/socket', options)` — same host/port as HTTP API unless you terminate WS elsewhere |
| Transports (server) | `['websocket', 'polling']` (`main.gateway.ts`, `socket.adapter.ts`) — clients should allow **both** (default Socket.IO behavior). |

## Authentication

- **Yes: `handshake.auth.token`.** Pass the same **access JWT** string the REST API uses in `Authorization: Bearer …`.
- `WsJwtAuthGuard` reads `client.handshake.auth.token` and verifies JWT.
- `SocketService.handleConnection` then checks Redis: `socketConnection:` / access-token key must still hold **this exact token** (invalidated on logout / refresh rotation per `RedisKeys.ACCESS_TOKEN`).
- After success, the socket **joins room** `userId` (string = JWT `userId`). Server emits to `to(userId)`.

**Client example:**

```javascript
import { io } from 'socket.io-client';

const socket = io('https://api.example.com/socket', {
  transports: ['websocket', 'polling'],
  auth: { token: accessJwtString },
});
```

## Heartbeat / ping

- **No custom app events** (`ping` / `pong` handlers) in this codebase.
- **Engine.IO** (inside Socket.IO) uses built-in **ping/pong** between client and server with library defaults unless you override `pingInterval` / `pingTimeout` in the adapter (not done here).

## Client → server (emit)

| Event name (string) | Body schema (JSON) | Ack / response |
|---------------------|-------------------|----------------|
| `rideSendMessage` | `{ "bookingId": string, "content": string }` — `content` non-empty (`SendMessageDto`) | Success: `{ "success": true }`. Errors: server emits `error` (see below); handler may not invoke ack on catch. |
| `updateDriverLocation` | `{ "lat": number, "lng": number, "angle"?: number }` | Success: `{ "status": "success", "message": "Location updated successfully" }`. On validation/auth failure: emits `error` or `error` (ride) (see below). |

**Guards:** Class-level `WsJwtAuthGuard`; handlers also check `client.data.user.userId`.

## Server → client (on)

Events are emitted to room = **user id** (UUID string), unless noted.

| Event name | Target audience | Payload schema (JSON) |
|------------|-----------------|------------------------|
| `rideRequest` | Pilot (`pilotUserId`) | `{ "bookingId", "vehicleTypeId", "pickupLocation", "dropLocation", "estimatedFare", "nearestPilotDistance", "distanceKm", "durationMin" }` — `pickupLocation` / `dropLocation` are API-shaped JSON (see booking/fare types); `estimatedFare` may be number or decimal-serialized. |
| `rideCancelled` | Customer or pilot (`recipientUserId`) | `{ "bookingId": string, "message": string }` |
| `driverNotFound` | Customer | `{ "bookingId", "bookingStatus", "message" }` — `bookingStatus` is `BookingStatus` enum string. |
| `rideRequestTimeout` | Pilot | `{ "bookingId", "reason": string }` |
| `rideStatusUpdate` | Customer | **`CustomerRidePayload`** — large object: `bookingCode`, `bookingId`, `bookingStatus`, `estimatedDuration`, `estimatedDistance`, `tripDuration`, `tripStart` (ISO date string over JSON), `vehicleType`, `vehicleTypeId`, `createdAt` (ISO), `cancelledBy`, `pilot` (object or null), `passenger`, `rating`, `pickupInMinutes`, `pickupLocation`, `dropLocation`, `fairDetails`, `otherPassengerInfo`. See `src/modules/ride/dto/ride.interface.ts`. |
| `reachedPickupPoint` | Customer | `{ "bookingId": string }` |
| `driverLiveLocation` | Customer | `{ "bookingId", "lat", "lng", "angle" }` — `angle` may be omitted if not sent by client. |
| `rideEditLocation` | Pilot | **`PilotRideResponse`**: `bookingStatus?`, `pilotType`, `customerName`, `customerPhone`, `averageRating`, `pickupLocation`, `dropLocation`, `rideStatus`, `bookingId`, `fare`, `otherPassengerInfo`. |
| `rideReceiveMessage` | Sender + recipient (both user rooms) | `{ "id", "bookingId", "senderId", "content", "createdAt" }` — `createdAt` ISO string in JSON. |
| `error` | Various | `{ "message": string, "error"?: string }` — used by gateway (`Failed to connect`, chat failures, etc.) and ride `RideEvents.ERROR` shape. |
| `error` (literal `'error'`) | Same | Some paths use plain `'error'` event with `{ message, error? }`. |
| `force_logout` | User being replaced | `{ "message": string, "reason": "MULTIPLE_DEVICE_LOGIN" }` (`auth.service.ts`) |

**`notifyError` (internal):** emits `error` with `{ message, error? }` to a user room.

## `BookingStatus` strings (JSON)

`PENDING` | `ACCEPTED` | `ARRIVED` | `ONGOING` | `COMPLETED` | `CANCELLED` | `NOT_FOUND`

## Not implemented in gateway

- `ChatEvents.TYPING` (`typing`) is defined in `socket-events.ts` but **no `@SubscribeMessage` handler** exists — clients should not rely on it unless you add server support.

## Operational notes

- **Multi-tab / new login:** Redis tracks one active socket per `userId`; a newer connection can disconnect the previous socket and emit `force_logout` on the old one when applicable (see `SocketService` / `auth.service.ts`).
- **Scaling:** `@socket.io/redis-adapter` is a dependency but **no adapter is wired** in `socket.adapter.ts` — multiple API instances would not share rooms unless you add it.
