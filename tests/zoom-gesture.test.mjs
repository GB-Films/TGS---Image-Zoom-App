import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createZoomScaleMapping, cameraForPinch } from "../app/zoom-gesture.mjs";

const presets = JSON.parse(await readFile(new URL("../app/transition-presets.json", import.meta.url), "utf8"));
const scales = [1];
for (const entry of presets) scales.push(scales.at(-1) / (entry.portalScale / 100 * entry.imageScale));
const mapping = createZoomScaleMapping(scales);
const close = (actual, expected, tolerance = 1e-8) =>
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected}`);

test("pinch scale follows finger distance throughout the scene curve, including crossings", () => {
  for (let depth = 0.1; depth < 6.9; depth += 0.07) {
    const start = mapping.scaleAtDepth(depth);
    for (const ratio of [0.8, 1, 1.2, 1.5, 2]) {
      const requested = start * ratio;
      const bounded = Math.min(scales.at(-1), Math.max(scales[0], requested));
      const result = mapping.scaleAtDepth(mapping.depthAtScale(requested));
      close(result / bounded, 1);
    }
  }
});

test("scale mapping keeps the renderer's existing curve and scene endpoint scales", () => {
  for (let level = 0; level < scales.length; level += 1) {
    close(mapping.scaleAtDepth(level) / scales[level], 1);
    close(mapping.depthAtScale(scales[level]), level);
  }
  close(mapping.depthAtScale(0.1), 0);
  close(mapping.depthAtScale(scales.at(-1) * 10), scales.length - 1);
  for (let level = 0; level < scales.length - 1; level += 1) {
    // Independent form of the renderer's original Hermite interpolation.
    const start = Math.log(scales[level]);
    const end = Math.log(scales[level + 1]);
    const previous = level ? Math.log(scales[level - 1]) : 2 * start - end;
    const following = level + 2 < scales.length ? Math.log(scales[level + 2]) : 2 * end - start;
    for (const t of [0.1, 0.5, 0.9]) {
      const expected = Math.exp((2*t**3 - 3*t**2 + 1)*start
        + (t**3 - 2*t**2 + t)*(end - previous)*0.18
        + (-2*t**3 + 3*t**2)*end
        + (t**3 - t**2)*(following - start)*0.18);
      close(mapping.scaleAtDepth(level + t) / expected, 1);
    }
  }
});

test("both image contact points follow the fingers during a pinch with midpoint movement", () => {
  for (const viewport of [{ width: 390, height: 844 }, { width: 1280, height: 720 }]) {
    const width = Math.max(viewport.width, viewport.height * 16 / 9);
    const artwork = { width, height: width * 9 / 16 };
    for (const depth of [0.2, 0.99, 1.99, 2.99, 3.99, 4.99, 5.99, 6.8]) {
      const fingers = [{ x: 120, y: 260 }, { x: 270, y: 480 }];
      const origin = { cameraX: 0.5, cameraY: 0.5,
        viewScale: mapping.scaleAtDepth(depth), focusX: 195, focusY: 370 };
      const ratio = 1.3;
      const focus = { x: origin.focusX + 23, y: origin.focusY - 17 };
      const nextScale = mapping.scaleAtDepth(mapping.depthAtScale(origin.viewScale * ratio));
      const camera = cameraForPinch(origin, focus, nextScale, viewport, artwork);
      for (const finger of fingers) {
        const point = {
          x: origin.cameraX + (finger.x - viewport.width / 2) / (width * origin.viewScale),
          y: origin.cameraY + (finger.y - viewport.height / 2) / (artwork.height * origin.viewScale),
        };
        const screen = {
          x: viewport.width / 2 + (point.x - camera.x) * width * nextScale,
          y: viewport.height / 2 + (point.y - camera.y) * artwork.height * nextScale,
        };
        close(screen.x, focus.x + (finger.x - origin.focusX) * ratio, 0.1);
        close(screen.y, focus.y + (finger.y - origin.focusY) * ratio, 0.1);
      }
    }
  }
});

test("repeated pinches accumulate physical scale without accelerating scene progress", () => {
  let depth = 0;
  let expected = 1;
  for (let gesture = 0; gesture < 40; gesture += 1) {
    depth = mapping.depthAtScale(mapping.scaleAtDepth(depth) * 1.2);
    expected *= 1.2;
    close(mapping.scaleAtDepth(depth) / expected, 1, 1e-7);
  }
});
