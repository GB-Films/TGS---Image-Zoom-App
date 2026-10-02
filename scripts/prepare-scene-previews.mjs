import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import scenes from '../app/scenes.json' with { type: 'json' };
import { PREVIEW_WIDTH, previewSource } from '../app/scene-loading.mjs';

// Derived delivery assets only. The approved 4K files and alpha masters stay intact.
let total = 0;
for (const scene of scenes) {
  const output = path.resolve('public', `.${previewSource(scene.src)}`);
  await fs.mkdir(path.dirname(output), { recursive: true });
  const { size } = await sharp(path.resolve('public', `.${scene.src}`))
    .resize({ width: PREVIEW_WIDTH, withoutEnlargement: true })
    .webp({ quality: 86, alphaQuality: 100, effort: 6, smartSubsample: true })
    .toFile(output);
  total += size;
  console.log(`${scene.id}: ${(size / 1024).toFixed(0)} KiB`);
}
console.log(`26 previews: ${(total / 1e6).toFixed(2)} MB`);
