# `src/modules/maps/maps.controller.ts`

## Role

Exposes maps proxy endpoints to the client (directions, geocode, autocomplete, place details) — reduces direct Google key exposure in mobile apps if routed through API (still requires auth per route in source).
