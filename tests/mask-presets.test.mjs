import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import sharp from "sharp";
import { buildClosedPath, blurMaskAlpha, opaqueIntegral, opaqueRectangle, fitImageInsideMask } from "../app/mask-geometry.mjs";

const presets = JSON.parse(await readFile(new URL("../app/transition-presets.json", import.meta.url), "utf8"));
async function raster(p) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="288" viewBox="0 0 1 1" preserveAspectRatio="none"><path d="${buildClosedPath(p.points, p.smoothing, 1)}" fill="white"/></svg>`;
  const data = await sharp(Buffer.from(svg)).ensureAlpha().raw().toBuffer();
  blurMaskAlpha({ data }, 512, 288, Math.round(p.feather / 1000 * 512));
  return { data, integral: opaqueIntegral(data, 512, 288) };
}

test("25 authored portals stay in the central zone, with feather and no implicit fill", () => {
  assert.equal(presets.length, 25);
  for (const p of presets) {
    assert.ok(p.imageScale > 0.05 && p.imageScale <= 1);
    assert.equal(p.matte,null);
    assert.ok(p.portalX>=100/6 && p.portalX<=500/6);
    assert.ok(p.portalY>=100/6 && p.portalY<=500/6);
    assert.ok(p.feather > 0, "keep the authored feather");
    assert.ok(p.portalX / 100 - p.portalScale / 200 >= 0);
    assert.ok(p.portalY / 100 + p.portalScale / 200 <= 1);
  }
});

test("every pixel of the complete source rectangle is inside opaque mask pixels, with a safety border", async () => {
  for (const p of presets) {
    const { integral } = await raster(p);
    const left = (0.5 + p.imageX / 100 - p.imageScale / 2) * 512;
    const top = (0.5 + p.imageY / 100 - p.imageScale / 2) * 288;
    const right = left + p.imageScale * 512;
    const bottom = top + p.imageScale * 288;
    assert.ok(opaqueRectangle(integral, left - 1, top - 1, right + 1, bottom + 1), p.name);
    const fit = fitImageInsideMask(integral);
    assert.deepEqual(fit, { imageScale:p.imageScale, imageX:p.imageX, imageY:p.imageY });
  }
});

test("opacity containment never approves pixels outside the mask or its feather", () => {
  const data = new Uint8ClampedArray(8 * 8 * 4);
  for (let y=2;y<6;y++) for (let x=2;x<6;x++) data[(y*8+x)*4+3]=255;
  const integral = opaqueIntegral(data,8,8);
  assert.equal(opaqueRectangle(integral,2,2,6,6),true);
  assert.equal(opaqueRectangle(integral,1,2,6,6),false);
  assert.equal(opaqueRectangle(integral,-1,2,6,6),false);
  assert.equal(opaqueRectangle(integral,2,2,9,6),false);
  data[(3*8+3)*4+3]=254;
  assert.equal(opaqueRectangle(opaqueIntegral(data,8,8),2,2,6,6),false);
});

test("a mask without opaque space cannot silently crop the source to fit", () => {
  const empty = opaqueIntegral(new Uint8ClampedArray(16 * 9 * 4),16,9);
  assert.throws(() => fitImageInsideMask(empty), /espacio opaco/);
});

test("the app uses fixed masks for all ancestors and keeps guided selection unavailable", async () => {
  const page = await readFile(new URL("../app/page.tsx",import.meta.url),"utf8");
  assert.doesNotMatch(page,/maskOpeningScale|maskEdgeScale|getOpeningCanvasMask/);
  assert.match(page,/transitionLevel = 0; transitionLevel < layer/);
  assert.match(page,/const mask = getCanvasMask\(transition\)/);
  assert.doesNotMatch(page,/selectExperienceMode|setExperienceMode/);
  assert.match(page,/Encajar imagen completa/);
  assert.match(page,/const anchorLevel = developerMode \? editingTransition/);
  assert.match(page,/const rebaseBlend = developerMode \|\| experienceMode === "guided"/);
});
