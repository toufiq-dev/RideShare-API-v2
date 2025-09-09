import { cellToChildren, gridDisk, latLngToCell } from 'h3-js';

export const H3_RES = parseInt(process.env.H3_RES || '8', 10);

export function h3Cell(lat: number, lng: number, res = H3_RES): string {
  return latLngToCell(lat, lng, res);
}

export function neighbors(cell: string): string[] {
  // ring-1 neighbors, excluding center
  return gridDisk(cell, 1).filter((c) => c !== cell);
}
