import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";
import sharp from "sharp";
import scenes from "../app/scenes.json" with { type: "json" };
import { containedArtwork } from "../app/scene-geometry.mjs";

test("26 ordered transparent UHD scenes preserve proportions within the download budget", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const layout = await readFile(new URL("../app/layout.tsx", import.meta.url), "utf8");
  const sources = scenes.map(s=>s.src);
  assert.equal(sources.length, 26);
  assert.equal(new Set(sources).size, 26);
  assert.match(layout,/scenes.slice\(0, 4\)/);
  assert.match(page,/STARTUP_DECODE_LEVELS = 4/);
  assert.match(page,/DECODE_AHEAD_LEVELS = 3/);
  assert.doesNotMatch(page,/warmEncodedFiles|MAX_SUPPORTED_IMAGES = 15/);
  let totalBytes = 0;
  for (const [index, source] of sources.entries()) {
    assert.ok(source.startsWith(`/scenes/tgs-${String(index + 1).padStart(2, "0")}-`));
    const bytes = await readFile(new URL(`../public${source}`, import.meta.url));
    const metadata = await sharp(bytes).metadata();
    assert.equal(metadata.format, "webp", source);
    assert.equal(metadata.width, 3840, source);
    assert.equal(metadata.height, scenes[index].height, source);
    assert.equal(metadata.hasAlpha, true, source);
    const alpha=await sharp(bytes).resize(100).extractChannel('alpha').stats();
    assert.equal(alpha.channels[0].min,0); assert.ok(alpha.channels[0].max>=250);
    const r=containedArtwork(metadata.width,metadata.height);
    assert.ok(Math.abs((r.width*16/9)/r.height-metadata.width/metadata.height)<1e-10);
    assert.ok(bytes.length < 2.5 * 1024 * 1024, `${source} exceeds its download budget`);
    totalBytes += bytes.length;
  }
  assert.ok(totalBytes < 50 * 1024 * 1024, "Complete sequence exceeds 50 MiB");
  const files=(await readdir(new URL('../public/scenes/',import.meta.url))).filter(f=>f.endsWith('.webp'));
  assert.deepEqual(files.sort(),sources.map(s=>s.split('/').at(-1)).sort());
  for (const match of layout.matchAll(/href=\{publicAsset\("(\/scenes\/[^"\n]+)"\)\}/g)) {
    assert.ok(sources.includes(match[1]), `Preload points outside the active sequence: ${match[1]}`);
  }
});
