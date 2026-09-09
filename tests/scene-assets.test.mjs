import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import sharp from "sharp";

test("the experience references eight ordered, opaque UHD WebP scenes within the download budget", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const layout = await readFile(new URL("../app/layout.tsx", import.meta.url), "utf8");
  const sources = [...page.matchAll(/src: publicAsset\("(\/scenes\/[^"\n]+)"\)/g)]
    .map((match) => match[1]);
  assert.equal(sources.length, 8);
  assert.equal(new Set(sources).size, 8);
  let totalBytes = 0;
  for (const [index, source] of sources.entries()) {
    assert.ok(source.startsWith(`/scenes/tgs-${String(index + 1).padStart(2, "0")}-`));
    const bytes = await readFile(new URL(`../public${source}`, import.meta.url));
    const metadata = await sharp(bytes).metadata();
    assert.equal(metadata.format, "webp", source);
    assert.equal(metadata.width, 3840, source);
    assert.equal(metadata.height, 2160, source);
    assert.equal(metadata.hasAlpha, false, source);
    assert.ok(bytes.length < 1.5 * 1024 * 1024, `${source} exceeds its download budget`);
    totalBytes += bytes.length;
  }
  assert.ok(totalBytes < 6 * 1024 * 1024, "Complete sequence exceeds 6 MiB");
  for (const match of layout.matchAll(/href=\{publicAsset\("(\/scenes\/[^"\n]+)"\)\}/g)) {
    assert.ok(sources.includes(match[1]), `Preload points outside the active sequence: ${match[1]}`);
  }
});
