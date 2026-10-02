import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs/promises';
import sharp from 'sharp';
import scenes from '../app/scenes.json' with { type: 'json' };
import { PREVIEW_WIDTH, previewSource, startupSource, sceneLoadPlan, canReleaseScene } from '../app/scene-loading.mjs';

test('every scene has three successors prepared and the next readable scene in 4K', () => {
  for (let level = 0; level < scenes.length; level++) {
    const { desired, prioritized } = sceneLoadPlan(scenes, level);
    for (let i = Math.max(0, level - 2); i <= Math.min(25, level + 3); i++) {
      assert.ok(desired.has(previewSource(scenes[i].src)));
      assert.equal(desired.has(scenes[i].src), Math.abs(i - level) <= 1);
    }
    assert.deepEqual(new Set(prioritized), desired);
    assert.ok([...desired].filter(s => !s.includes('/previews/')).length <= 3);
    const decodedPixels = scenes.reduce((sum, scene) => sum
      + (desired.has(scene.src) ? scene.width * scene.height * 4 : 0)
      + (desired.has(previewSource(scene.src)) ? PREVIEW_WIDTH * Math.round(scene.height * PREVIEW_WIDTH / scene.width) * 4 : 0), 0);
    assert.ok(decodedPixels < 155 * 1024 * 1024);
  }
  assert.deepEqual(scenes.slice(0, 4).map((s, i) => startupSource(s.src, i)),
    [scenes[0].src, scenes[1].src, previewSource(scenes[2].src), previewSource(scenes[3].src)]);
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
