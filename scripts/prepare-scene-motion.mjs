import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import scenes from '../app/scenes.json' with { type: 'json' };
import { MOTION_WIDTH, motionSource } from '../app/scene-loading.mjs';

// Offline derivatives: original artwork, aspect, text and transparency stay intact.
let total = 0;
for (const scene of scenes) {
  const output = path.resolve('public', `.${motionSource(scene.src)}`);
  await fs.mkdir(path.dirname(output), { recursive: true });
  const { size } = await sharp(path.resolve('public', `.${scene.src}`))
    .resize({ width: MOTION_WIDTH, withoutEnlargement: true })
    .webp({ quality: 90, alphaQuality: 100, effort: 6, smartSubsample: true })
    .toFile(output);
  total += size;
  console.log(`${scene.id}: ${(size / 1024).toFixed(0)} KiB`);
}
console.log(`26 motion sources: ${(total / 1e6).toFixed(2)} MB`);
