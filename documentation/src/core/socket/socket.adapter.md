# `src/core/socket/socket.adapter.ts`

## Role

Custom **Socket.IO adapter** extending Nest `IoAdapter` to set CORS origins (from `ALLOWED_ORIGINS` env or FairDrive defaults), allow credentials, and enable `websocket` + `polling` transports.

## Class: `SocketIOAdapter`

| Method | Description |
|--------|-------------|
| `createIOServer(port, options?)` | Merges CORS config; logs port, transports, origins; returns Socket.IO server. |
