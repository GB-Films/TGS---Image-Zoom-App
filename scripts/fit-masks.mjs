import { readFile, writeFile } from "node:fs/promises";
import sharp from "sharp";
import { buildClosedPath, blurMaskAlpha, opaqueIntegral, fitImageInsideMask } from "../app/mask-geometry.mjs";

const file = new URL("../app/transition-presets.json", import.meta.url);
const presets = JSON.parse(await readFile(file, "utf8"));
for (const p of presets) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="288" viewBox="0 0 1 1" preserveAspectRatio="none"><path d="${buildClosedPath(p.points, p.smoothing, 1)}" fill="white"/></svg>`;
  const data = await sharp(Buffer.from(svg)).ensureAlpha().raw().toBuffer();
  blurMaskAlpha({ data }, 512, 288, Math.round(p.feather / 1000 * 512));
  Object.assign(p, fitImageInsideMask(opaqueIntegral(data, 512, 288)), { matte: p.matte ?? "#ffffff" });
  console.log(p.name, p.imageScale.toFixed(4), p.imageX.toFixed(2), p.imageY.toFixed(2));
}
// Deterministic regeneration of fit values only. Portal locations and contours
// are deliberately kept unchanged; no original image pixels are rewritten.
await writeFile(file, JSON.stringify(presets, null, 2) + "\n");
