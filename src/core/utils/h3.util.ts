import * as h3 from 'h3-js';

export function h3Cell(lat: number, lng: number, res = 8): string {
  return h3.latLngToCell(lat, lng, res);
}

export function neighbors(h3Index: string): string[] {
  return h3.gridDisk(h3Index, 1).filter((x) => x !== h3Index);
}
