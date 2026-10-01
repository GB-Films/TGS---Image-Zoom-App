import test from 'node:test';
import assert from 'node:assert/strict';
import { rebaseCamera, containedArtwork } from '../app/scene-geometry.mjs';
import {createZoomScaleMapping,cameraForPinch} from '../app/zoom-gesture.mjs';
import presets from '../app/transition-presets.json' with {type:'json'};
import legacy from '../service/legacy-transition-presets.json' with {type:'json'};
const scales=[1];
for(const t of presets) scales.push(scales.at(-1)/(t.portalScale/100*t.imageScale));
const mapping=createZoomScaleMapping(scales);
const close=(a,b,tol=1e-7)=>assert.ok(Math.abs(a-b)<tol,`${a} != ${b}`);
test('all 25 local coordinate changes preserve screen positions in both directions',()=>{
  for(let anchor=0;anchor<25;anchor++) {
    const t=presets[anchor],p=t.portalScale/100,s=p*t.imageScale;
    const point={x:.47,y:.53,anchorLevel:anchor+1};
    const parent=rebaseCamera(point,anchor,presets);
    const camera={x:t.portalX/100+p*t.imageX/100,y:t.portalY/100+p*t.imageY/100,anchorLevel:anchor};
    const child=rebaseCamera(camera,anchor+1,presets);
    close((parent.x-camera.x)*100/s,(point.x-child.x)*100);
    close((parent.y-camera.y)*100/s,(point.y-child.y)*100);
    const restored=rebaseCamera(child,anchor,presets);
    close(restored.x,camera.x);close(restored.y,camera.y);
  }
});
test('pinch is 1:1 at every crossing including the last, with locally bounded precision',()=>{
  const viewport={width:390,height:844},artwork={width:844*16/9,height:844};
  for(let i=0;i<25;i++) {
    const depth=i+.99,start=mapping.scaleAtDepth(depth),next=mapping.depthAtScale(start*1.2);
    const t=presets[i],p=t.portalScale/100;
    const origin={cameraX:t.portalX/100+p*t.imageX/100,cameraY:t.portalY/100+p*t.imageY/100,
      viewScale:start/scales[i],focusX:195,focusY:400};
    const view=mapping.scaleAtDepth(next)/scales[i];
    const camera=cameraForPinch(origin,{x:195,y:400},view,viewport,artwork);
    const point={x:origin.cameraX+30/(artwork.width*origin.viewScale),y:origin.cameraY,anchorLevel:i};
    const nc=rebaseCamera({...camera,anchorLevel:i},Math.floor(next),presets);
    const np=rebaseCamera(point,Math.floor(next),presets);
    const ns=mapping.scaleAtDepth(next)/scales[Math.floor(next)];
    const ratio=Math.min(start*1.2,scales.at(-1))/start;
    close((np.x-nc.x)*artwork.width*ns,30*ratio,.001);
    close(mapping.scaleAtDepth(next)/start,ratio);
  }
});
test('aspect fit supports landscape, portrait and square without clipping',()=>{
  for(const [w,h] of [[3840,2880],[3840,3620],[3840,2161],[1000,2000]]) {
    const r=containedArtwork(w,h);close(r.width*16/9/r.height,w/h);
    assert.ok(r.x>=0&&r.y>=0&&r.x+r.width<=1&&r.y+r.height<=1);
  }
  assert.equal(legacy.length,7);
});
