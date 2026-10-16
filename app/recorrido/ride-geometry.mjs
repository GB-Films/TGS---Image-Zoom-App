import * as THREE from "three";

export const ARTWORK_WIDTH = 14 * 1.15;
export const FRAME_THICKNESS = .3;
export const FRAME_DEPTH = .4;
export const HORIZONTAL_FRAME_Z = .08;
// Actual frame and post footprint, including the enlarged artwork.
export const STATION_HALF_WIDTH = ARTWORK_WIDTH / 2 + FRAME_THICKNESS;
export const STATION_HALF_DEPTH = .45;
// Includes the pipe, collars, trackside markers and room for the car.
export const TRACK_CLEARANCE = 4.2;
const sampledPaths = new WeakMap();

export function createRidePath(stopCount = 27) {
  const points = Array.from({ length: stopCount * 2 + 3 }, (_, index) => new THREE.Vector3(
    Math.sin(index * .62) * 13 + Math.sin(index * .29) * 4,
    3.5 + Math.sin(index * .7) * 1.2,
    18 - index * 24,
  ));
  const path = new THREE.CatmullRomCurve3(points, false, "centripetal");
  path.arcLengthDivisions = stopCount * 100;
  return path;
}

export function trackClearance(pathPoints, station) {
  station.updateMatrixWorld(true);
  const inverse = station.matrixWorld.clone().invert();
  const local = new THREE.Vector3();
  let minimum = Infinity;
  for (const point of pathPoints) {
    local.copy(point).applyMatrix4(inverse);
    // Conservatively reserve the whole horizontal footprint, at every height.
    const dx = Math.max(0, Math.abs(local.x) - STATION_HALF_WIDTH);
    const dz = Math.max(0, Math.abs(local.z) - STATION_HALF_DEPTH);
    minimum = Math.min(minimum, Math.hypot(dx, dz));
  }
  return minimum;
}

export function placeStation(path, u, direction = 1) {
  const passenger = path.getPointAt(u);
  const forward = path.getTangentAt(u).setY(0).normalize();
  const side = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0));
  const station = new THREE.Group();
  if (!sampledPaths.has(path)) sampledPaths.set(path, path.getSpacedPoints(Math.ceil(path.getLength() * 8)));
  const points = sampledPaths.get(path);
  for (let offset = 14; offset <= 80; offset += .5) {
    station.position.copy(passenger).addScaledVector(forward, 15).addScaledVector(side, offset * direction);
    station.position.y = passenger.y - 3;
    station.lookAt(new THREE.Vector3(passenger.x, station.position.y, passenger.z));
    if (trackClearance(points, station) >= TRACK_CLEARANCE + .15) return station;
  }
  throw new Error("No se encontró una posición libre para la estación");
}
