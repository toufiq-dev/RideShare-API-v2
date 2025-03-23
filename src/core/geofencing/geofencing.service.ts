import { Injectable, OnModuleInit } from '@nestjs/common';
import * as turf from '@turf/turf';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class GeofencingService implements OnModuleInit {
  private dhakaBoundary;

  onModuleInit() {
    const filePath = path.resolve(process.cwd(), 'static/geo/export.geojson');
    const geojsonData = fs.readFileSync(filePath, 'utf8');
    const geojson = JSON.parse(geojsonData);
    this.dhakaBoundary = geojson.features[0];
  }

  isWithinDhaka(lat: number, lng: number): boolean {
    const point = turf.point([lng, lat]);
    return turf.booleanPointInPolygon(point, this.dhakaBoundary);
  }
}
