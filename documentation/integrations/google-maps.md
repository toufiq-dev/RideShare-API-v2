# Google Maps Platform

## Role in FairDrive

- **`MapsService`** (`src/modules/maps/maps.service.ts`): Directions, reverse geocoding, Places autocomplete, place details via HTTP to `maps.googleapis.com`.
- **`FareService`** (`src/modules/fare/fare.service.ts`): Distance/duration using `@googlemaps/google-maps-services-js` (Directions API).

## Environment variables

| Variable | Purpose |
|----------|---------|
| `GOOGLE_MAPS_API_KEY` | Server-side API key for REST and client library calls |

Config path: `googleMaps.apiKey` in `app.config.ts`.

## Sandbox vs production

Google Maps does not use a separate “sandbox” key by convention. Use:

- **Separate Google Cloud projects** (e.g. `fairdrive-dev`, `fairdrive-prod`) with API restrictions (HTTP referrer / IP) and **different keys**.
- **Billing** is per project; enable only needed APIs (Directions, Geocoding, Places).

## Dashboards and docs

- [Google Cloud Console](https://console.cloud.google.com/) — APIs & Services, credentials, quotas.
- [Maps Platform documentation](https://developers.google.com/maps/documentation)
- [Usage and billing](https://developers.google.com/maps/billing-and-pricing/pricing)

## Webhooks

None. All requests are **outbound** from FairDrive API to Google.

## Operational notes

- Restrict the key to **Directions API**, **Geocoding API**, **Places API** (only those you use).
- Monitor **quota** and enable alerts in Cloud Console.
