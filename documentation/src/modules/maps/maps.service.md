# `src/modules/maps/maps.service.ts`

## Role

**Google Maps HTTP APIs** via `@nestjs/axios`: Directions, Geocoding (reverse), Places Autocomplete, Place Details — all keyed by `googleMaps.apiKey`.

## Methods

| Method | Description |
|--------|-------------|
| `getDirections` | `directions/json` with origin, destination, mode, optional waypoints. |
| `reverseGeocode` | `geocode/json` latlng → addresses. |
| `getAutocomplete` | Place autocomplete suggestions. |
| `getPlaceDetails` | Place details by place id. |

## Errors

Throws `BadRequestException` when Google returns non-OK status.
