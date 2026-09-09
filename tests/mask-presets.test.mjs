import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { maskEdgeScale, maskOpeningScale, maskViewWeight } from "../app/mask-opening.mjs";

const presets = JSON.parse(await readFile(new URL("../app/transition-presets.json", import.meta.url), "utf8"));
const inside = (x, y, polygon) => {
  let hit = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i], b = polygon[j];
    if ((a.y > y) !== (b.y > y) && x < (b.x - a.x) * (y - a.y) / (b.y - a.y) + a.x) hit = !hit;
  }
  return hit;
};

test("seven distinct production contours stay within their artwork and editor limits", () => {
  assert.equal(presets.length, 7);
  assert.equal(new Set(presets.map((p) => JSON.stringify(p.points))).size, 7);
  for (const p of presets) {
    assert.ok(p.name.length > 10);
    assert.ok(p.portalScale >= 2 && p.portalScale <= 35);
    assert.ok(p.feather > 0 && p.feather <= 80);
    assert.ok(p.smoothing >= 0 && p.smoothing <= 1);
    assert.equal(p.imageScale, 1, "production checkpoints use the full child image");
    assert.equal(p.imageX, 0);
    assert.equal(p.imageY, 0);
    assert.ok(p.points.length >= 4 && p.points.length <= 12);
    for (const point of p.points) {
      for (const [axis, centre] of [["x", p.portalX], ["y", p.portalY]]) {
        assert.ok(Number.isFinite(point[axis]) && point[axis] >= 0 && point[axis] <= 1);
        const source = centre / 100 + p.portalScale / 100 * (point[axis] - 0.5);
        assert.ok(source > 0 && source < 1, `${p.name}: ${axis} contour outside artwork`);
      }
    }
  }
});

test("mask opening is late, monotonic, reversible, and complete at every checkpoint", () => {
  for (let level = 0; level < 7; level++) {
    assert.equal(maskOpeningScale(level - 1, level), 1);
    assert.equal(maskOpeningScale(level + 0.87, level), 1);
    const samples = Array.from({ length: 1001 }, (_, i) => maskOpeningScale(level + i / 1000, level));
    for (let i = 1; i < samples.length; i++) {
      assert.ok(samples[i] >= samples[i - 1] - 1e-10);
      assert.ok(samples[i] - samples[i - 1] < 0.24, "no discrete aperture jump");
    }
    assert.ok(Math.abs(samples.at(-1) - 16) < 1e-10);
    assert.equal(maskOpeningScale(level + 1.1, level), 16);
    for (let i = 1000; i >= 0; i--) assert.equal(maskOpeningScale(level + i / 1000, level), samples[i]);
    assert.equal(maskEdgeScale(level + 0.95, level), 1);
    assert.ok(Math.abs(maskEdgeScale(level + 1, level) - 1.6) < 1e-10);
  }
});

test("the final mask sample has an opaque central support region including blur margin", () => {
  // The runtime blur is three box passes at 512×288. A support rectangle
  // including all three radii must remain inside each authored contour.
  for (const p of presets) {
    const radius = Math.round(p.feather / 1000 * 512);
    const marginX = 1 / 32 + 3 * radius / 512;
    const marginY = 1 / 32 + 3 * radius / 288;
    for (const dx of [-marginX, 0, marginX]) {
      for (const dy of [-marginY, 0, marginY]) {
        assert.ok(inside(0.5 + dx, 0.5 + dy, p.points), `${p.name}: insufficient opaque support`);
      }
    }
  }
});

test("free zoom opens only inside the image and restores its contour when panned away", () => {
  assert.equal(maskViewWeight(0, 300, 1000, 700, 390, 844), 0);
  assert.equal(maskViewWeight(0, 0, 390, 844, 390, 844), 0);
  assert.equal(maskViewWeight(-200, -200, 790, 1244, 390, 844), 1);
  assert.equal(maskViewWeight(0, 0, 0, 0, 390, 844), 0);
  const partial = maskViewWeight(-20, -50, 430, 944, 390, 844);
  assert.ok(partial > 0 && partial < 1);
  assert.equal(maskOpeningScale(3, 0, 0), 1);
  assert.equal(maskEdgeScale(3, 0, 0), 1);
  assert.ok(maskOpeningScale(3, 0, partial) > 1 && maskOpeningScale(3, 0, partial) < 16);
});

test("authored contour bounds avoid the main captions and TGS logos", () => {
  // Manually annotated source-space rectangles (x1,y1,x2,y2).
  const protectedAreas = [
    [[0.45, 0.10, 0.94, 0.65]],
    [[0.51, 0.20, 0.89, 0.85], [0.225, 0.47, 0.31, 0.53], [0.18, 0.86, 0.36, 0.98]],
    [[0.12, 0.04, 0.90, 0.27], [0.44, 0.37, 0.55, 0.52], [0.74, 0.77, 0.88, 0.92]],
    [[0.05, 0.02, 0.95, 0.14], [0.64, 0.57, 0.98, 0.95]],
    [[0.13, 0.07, 0.88, 0.24]],
    [[0.26, 0.24, 0.76, 0.38]],
    [[0.24, 0.01, 0.77, 0.14], [0.65, 0.53, 0.97, 0.81]],
  ];
  for (const [index, p] of presets.entries()) {
    const xs = p.points.map(({ x }) => p.portalX / 100 + p.portalScale / 100 * (x - 0.5));
    const ys = p.points.map(({ y }) => p.portalY / 100 + p.portalScale / 100 * (y - 0.5));
    for (const [x1, y1, x2, y2] of protectedAreas[index]) {
      assert.ok(Math.max(...xs) < x1 || Math.min(...xs) > x2 || Math.max(...ys) < y1 || Math.min(...ys) > y2, p.name);
    }
  }
});
