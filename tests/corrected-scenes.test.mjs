import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import scenes from '../app/scenes.json' with {type:'json'};
import {SCENE_COLLECTION,TRANSITION_COUNT} from '../shared/mask-settings.mjs';

test('PowerPoint corrections replace the approved scenes without changing mask geometry or collection',async()=>{
  for(const id of [2,3,4,5,8,9,11,12,13,14,15,17,19]) assert.match(scenes[id-1].src,/-corregida\.webp$/);
  assert.equal(SCENE_COLLECTION,'tgs-2026-10-01');
  assert.equal(TRANSITION_COUNT,25);
  const masks=await readFile(new URL('../app/transition-presets.json',import.meta.url));
  assert.equal(createHash('sha256').update(masks).digest('hex'),'badf986e58341c7eaca9f33e4386f3bd608e359885b288d61535884f1a4be4a4');
});
