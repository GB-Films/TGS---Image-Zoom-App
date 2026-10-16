import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import { fileURLToPath } from "node:url";
import scenes from "../app/recorrido/ride-scenes.json" with { type: "json" };
import { rideTextureWindow } from "../app/recorrido/ride-loading.mjs";
import { initialJourney, startJourney, advanceJourney } from "../app/recorrido/ride-journey.mjs";

test("the logo and all 26 ordered production images have opaque, bounded ride exports", async () => {
  assert.equal(scenes.length, 27);
  for (let index = 0; index < scenes.length; index++) {
    const scene = scenes[index];
    assert.equal(scene.id, index);
    const [full, preview] = await Promise.all([scene.src, scene.preview].map(src => sharp(fileURLToPath(new URL(`../public${src}`, import.meta.url))).metadata()));
    assert.equal(full.hasAlpha, false);
    assert.equal(preview.hasAlpha, false);
    assert.ok(full.width <= 1600 && preview.width <= 384);
    assert.equal(full.width, scene.width);
    assert.equal(full.height, scene.height);
    assert.ok(Math.abs(full.width / full.height - preview.width / preview.height) < .015);
    const window = rideTextureWindow(index, scenes.length);
    assert.ok(window.length <= 3);
    assert.ok(window.includes(index));
    assert.equal(new Set(window).size, window.length);
  }
});

test("the complete collection keeps every stop and every four-second leg", () => {
  let state = initialJourney();
  for (let index = 1; index < scenes.length; index++) {
    state = startJourney(state, scenes.length);
    state = advanceJourney(state, 3.99);
    assert.equal(state.phase, "riding");
    state = advanceJourney(state, .011);
    assert.equal(state.phase, "arrived");
    assert.equal(state.stop, index);
    assert.deepEqual(advanceJourney(state, 30), state);
  }
  assert.deepEqual(startJourney(state, scenes.length), state);
});
