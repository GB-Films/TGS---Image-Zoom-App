import assert from "node:assert/strict";
import test from "node:test";
import { createRidePath, placeStation, trackClearance, TRACK_CLEARANCE } from "../app/recorrido/ride-geometry.mjs";
import { stopPosition, stopSide } from "../app/recorrido/ride-sequence.mjs";
import scenes from "../app/recorrido/ride-scenes.json" with { type: "json" };
import * as THREE from "three";

test("every complete station footprint clears the whole curved pipeline, including the starting sign", () => {
  const path = createRidePath(scenes.length);
  // Check more densely than the placement search to catch gaps between samples.
  const points = path.getSpacedPoints(Math.ceil(path.getLength() * 16));
  for (let index = 0; index < scenes.length; index++) {
    const u = stopPosition(index, scenes.length);
    const station = placeStation(path, u, stopSide(index));
    const distance = trackClearance(points, station);
    assert.ok(distance >= TRACK_CLEARANCE - .01, `station ${u}: only ${distance.toFixed(3)} units of clearance`);
  }
});

test("all 27 signs alternate right and left, with enough track between stops", () => {
  const path = createRidePath(scenes.length);
  const right = new THREE.Vector3();
  let previous;
  for (let index = 0; index < scenes.length; index++) {
    const u = stopPosition(index, scenes.length);
    const passenger = path.getPointAt(u);
    const station = placeStation(path, u, stopSide(index));
    right.crossVectors(path.getTangentAt(u), new THREE.Vector3(0, 1, 0)).normalize();
    assert.equal(Math.sign(station.position.clone().sub(passenger).dot(right)), index % 2 === 0 ? 1 : -1);
    if (previous) assert.ok(passenger.distanceTo(previous) > 35, `stops ${index - 1} and ${index} are too close`);
    previous = passenger;
  }
});
