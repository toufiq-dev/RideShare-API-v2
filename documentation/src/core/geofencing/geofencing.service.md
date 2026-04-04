# `src/core/geofencing/geofencing.service.ts`

## Role

Loads **GeoJSON** polygons from `static/geo/*.geojson` at startup and answers whether a lat/lng lies inside any known **city boundary** (Turf `booleanPointInPolygon`).

## Class: `GeofencingService`

| Method | Description |
|--------|-------------|
| `onModuleInit()` | Reads each `.geojson`; stores first feature per city name as boundary. |
| `isWithinBoundary(lat, lng)` | Returns `{ isInServiceArea, city? }`. |
