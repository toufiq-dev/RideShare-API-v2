import { Injectable, OnModuleInit } from '@nestjs/common';
import * as turf from '@turf/turf';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class GeofencingService implements OnModuleInit {
  private cityBoundaries: Record<string, any> = {};
  constructor() {}

  onModuleInit() {
    const geoFolderPath = path.resolve(process.cwd(), 'static/geo');
    const files = fs.readdirSync(geoFolderPath);

    files.forEach((file) => {
      if (file.endsWith('.geojson')) {
        const cityName = file.replace('.geojson', '');
        const data = fs.readFileSync(path.join(geoFolderPath, file), 'utf8');
        const geojson = JSON.parse(data);
        this.cityBoundaries[cityName] = geojson.features[0]; // assumes first feature is polygon
      }
    });
  }

  isWithinBoundary(
    lat: number,
    lng: number,
  ): { isInServiceArea: boolean; city?: string } {
    const point = turf.point([lng, lat]);

    for (const [city, boundary] of Object.entries(this.cityBoundaries)) {
      if (turf.booleanPointInPolygon(point, boundary)) {
        return { isInServiceArea: true, city };
      }
    }

    return { isInServiceArea: false };
  }
}
