# `src/core/socket/socket.service.ts`

## Role

Manages **Socket.IO server reference**, authenticates connections using JWT + Redis access token parity, enforces **one active socket per user** via Redis `SET NX` / disconnect older socket, joins room named by `userId`, and cleans up Redis on disconnect.

## Class: `SocketService`

| Method | Description |
|--------|-------------|
| `setServer(server)` | Injects `Server` after gateway init. |
| `get server` | Getter; throws if not set. |
| `handleConnection(client)` | Verifies handshake token; checks Redis access token; atomic connection key; disconnects duplicate; `join(userId)`; sets `client.data.user`. |
| `handleDisconnect(client)` | Deletes `SOCKET_CONNECTION` key if this socket still owns it. |

## Constants

- `CONNECTION_KEY_TTL` — 86400 seconds for connection keys.
