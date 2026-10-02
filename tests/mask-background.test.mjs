import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import presets from "../app/transition-presets.json" with { type: "json" };
import { validateMasks, validateSnapshot } from "../shared/mask-settings.mjs";

test("transparent fill survives JSON drafts and snapshot validation without becoming white", () => {
  const masks = structuredClone(presets);
  masks[0].matte = null;
  masks[1].matte = "#ffffff";
  delete masks[2].matte;
  const validated = validateMasks(masks);
  assert.equal(validated[0].matte, null);
  assert.equal(validated[1].matte, "#ffffff");
  assert.equal(validated[2].matte, null);
  const snapshot = validateSnapshot(JSON.parse(JSON.stringify({version: 1, updatedAt: null, transitions: validated})));
  assert.deepEqual(snapshot.transitions, validated);
});

test("existing authored colors and mask geometry remain unchanged", () => {
  const saved = validateMasks(presets);
  for (const [i, mask] of saved.entries()) {
    assert.equal(mask.matte, presets[i].matte);
    assert.deepEqual(mask.points, presets[i].points);
    assert.equal(mask.feather, presets[i].feather);
  }
  const transparent = structuredClone(presets);
  transparent[0].matte = null;
  const before = {...validateMasks(presets)[0]};
  const after = {...validateMasks(transparent)[0]};
  delete before.matte;
  delete after.matte;
  assert.deepEqual(after, before);
});

test("fill accepts only null or explicit hex colors", () => {
  for (const invalid of [false, true, 0, "", "transparent", "#fff", "red", {}, []]) {
    const masks = structuredClone(presets);
    masks[0].matte = invalid;
    assert.throws(() => validateMasks(masks), /Color de reborde inválido/);
  }
});

test("canvas, editor and fitting scripts do not introduce implicit white", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(page, /if \(parent && entry && entry\.matte\) \{/);
  assert.match(page, /if \(matteRect && entry\?\.matte\) \{\s*target\.fillStyle = entry\.matte;/);
  assert.match(page, /backgroundColor: transition\.matte \?\? "transparent"/);
  assert.doesNotMatch(page, /matte \?\? "#ffffff"/);
  assert.match(page, /Fondo de la máscara/);
  assert.match(page, /event\.target\.value === "none" \? null : event\.target\.value/);
  assert.match(page, /<option value="none">Sin relleno \(transparente\)<\/option>/);
  assert.match(page, /<option value="#ffffff">Blanco<\/option>/);
  for (const script of ["fit-masks.mjs", "preview-masks.mjs"]) {
    assert.doesNotMatch(await readFile(new URL(`../scripts/${script}`, import.meta.url), "utf8"), /matte \?\? "#ffffff"/);
  }
});
