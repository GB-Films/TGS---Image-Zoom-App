import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs/promises';
import sharp from 'sharp';
import scenes from '../app/scenes.json' with { type: 'json' };
import { PREVIEW_WIDTH, MAX_RETAINED_FULL_SCENES, MAX_DECODED_BYTES,
  previewSource, startupSource, startupSceneSources, sceneLoadPlan, canReleaseScene } from '../app/scene-loading.mjs';

test('all previews stay prepared and current/next/previous scenes have 4K', () => {
  for (let level = 0; level < scenes.length; level++) {
    const { desired, prioritized } = sceneLoadPlan(scenes, level);
    for (let i = 0; i < scenes.length; i++) {
      assert.ok(desired.has(previewSource(scenes[i].src)));
      assert.equal(desired.has(scenes[i].src), Math.abs(i - level) <= 1);
    }
    assert.deepEqual(new Set(prioritized), desired);
    assert.ok([...desired].filter(s => !s.includes('/previews/')).length <= 3);
    const decodedPixels = scenes.reduce((sum, scene) => sum
      + (desired.has(scene.src) ? scene.width * scene.height * 4 : 0)
      + (desired.has(previewSource(scene.src)) ? PREVIEW_WIDTH * Math.round(scene.height * PREVIEW_WIDTH / scene.width) * 4 : 0), 0);
    assert.ok(decodedPixels < MAX_DECODED_BYTES);
  }
  assert.deepEqual(scenes.slice(0, 4).map((s, i) => startupSource(s.src, i)),
    [scenes[0].src, scenes[1].src, previewSource(scenes[2].src), previewSource(scenes[3].src)]);
});

test('startup waits for every preview but only the first two full images', () => {
  const sources = startupSceneSources(scenes);
  assert.equal(sources.length, scenes.length + 2);
  assert.deepEqual(sources.slice(0, 4), [scenes[0].src, scenes[1].src,
    previewSource(scenes[2].src), previewSource(scenes[3].src)]);
  for (const scene of scenes) assert.ok(sources.includes(previewSource(scene.src)));
  assert.deepEqual(sources.filter(src => !src.includes('/previews/')), [scenes[0].src, scenes[1].src]);
});

test('repeated in/out crossings reuse 4Ks instead of releasing and decoding them again', () => {
  for (let boundary = 1; boundary < scenes.length; boundary++) {
    let retained = [], decoded = new Map(), created = new Map();
    for (const level of [boundary - 1, boundary, boundary - 1, boundary, boundary - 1, boundary]) {
      const plan = sceneLoadPlan(scenes, level, 2, 3, retained);
      retained = plan.fullSources;
      for (const src of plan.prioritized) if (!decoded.has(src)) {
        decoded.set(src, {}); created.set(src, (created.get(src) ?? 0) + 1);
      }
      for (const src of decoded.keys()) if (canReleaseScene(src, plan.desired, decoded)) decoded.delete(src);
      assert.ok(plan.fullSources.length <= MAX_RETAINED_FULL_SCENES);
      for (const scene of scenes) assert.ok(decoded.has(previewSource(scene.src)));
    }
    for (const [src, count] of created) assert.equal(count, 1, `source recreated at ${boundary}: ${src}`);
  }
});

test('forward, backward and restart retention remain local and within the decoded pixel budget', () => {
  let retained = [];
  const levels = [...scenes.keys(), ...[...scenes.keys()].reverse(), 25, 0, 12, 4, 24, 1];
  for (const level of levels) {
    const plan = sceneLoadPlan(scenes, level, 2, 3, retained);
    retained = plan.fullSources;
    assert.ok(retained.length <= MAX_RETAINED_FULL_SCENES);
    assert.deepEqual(new Set(plan.prioritized), plan.desired);
    const bytes = scenes.reduce((sum, scene, index) => {
      if (plan.desired.has(scene.src)) assert.ok(Math.abs(index - level) <= 2);
      return sum + PREVIEW_WIDTH * Math.round(scene.height * PREVIEW_WIDTH / scene.width) * 4
        + (plan.desired.has(scene.src) ? scene.width * scene.height * 4 : 0);
    }, 0);
    assert.ok(bytes <= MAX_DECODED_BYTES, `${bytes} bytes at level ${level}`);
  }
});

test('a full image survives eviction until its small replacement is available', () => {
  const source = scenes[1].src, preview = previewSource(source);
  const desired = new Set([preview]), decoded = new Map([[source, {}]]);
  assert.equal(canReleaseScene(source, desired, decoded), false);
  decoded.set(preview, {});
  assert.equal(canReleaseScene(source, desired, decoded), true);
  assert.equal(canReleaseScene(preview, desired, decoded), false);
  assert.equal(canReleaseScene(source, new Set([source]), decoded), false);
  assert.equal(canReleaseScene(source, new Set(), decoded), true);
});

test('all lightweight sources preserve the original aspect and transparent alpha', async () => {
  let total = 0;
  for (const scene of scenes) {
    const data = await fs.readFile(new URL(`../public${previewSource(scene.src)}`, import.meta.url));
    const meta = await sharp(data).metadata();
    assert.equal(meta.width, PREVIEW_WIDTH);
    assert.equal(meta.height, Math.round(scene.height * PREVIEW_WIDTH / scene.width));
    assert.equal(meta.hasAlpha, true);
    assert.equal(meta.format, 'webp');
    const originalAlpha = await sharp(await fs.readFile(new URL(`../public${scene.src}`, import.meta.url)))
      .resize(PREVIEW_WIDTH).extractChannel('alpha').raw().toBuffer();
    const previewAlpha = await sharp(data).extractChannel('alpha').raw().toBuffer();
    assert.deepEqual(previewAlpha, originalAlpha, `alpha changed: ${scene.id}`);
    total += data.length;
  }
  assert.ok(total < 6 * 1024 * 1024);
});
