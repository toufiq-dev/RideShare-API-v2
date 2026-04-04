# `src/modules/chat/chat.controller.ts`

## Role

`GET /chat` — paginated message history for a `bookingId` (JWT required). Sending messages is via WebSocket (`MainGateway`), not this controller.

## Route

| Method | Path | Description |
|--------|------|-------------|
| GET | `/chat?bookingId=&page=&pageSize=` | `JwtAuthGuard`; returns messages from `ChatService.getMessages`. |
