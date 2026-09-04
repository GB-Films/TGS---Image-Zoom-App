import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders the TGS welcome screen", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<html lang="es">/i);
  assert.match(html, /<title>TGS \| Zoom infinito<\/title>/i);
  assert.match(html, /Bienvenida a TGS/i);
  assert.match(html, /tgs-logo-color\.svg/i);
  assert.match(html, /Preparando…/i);
  assert.doesNotMatch(html, /codex-preview|SkeletonPreview|react-loading-skeleton/i);
});

test("includes installable web app metadata and early image fetches", async () => {
  const [layout, manifest] = await Promise.all([
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../public/manifest.webmanifest", import.meta.url), "utf8"),
  ]);
  const webManifest = JSON.parse(manifest);

  assert.match(layout, /manifest:\s*publicAsset\("\/manifest\.webmanifest"\)/);
  assert.match(layout, /appleWebApp/);
  assert.match(layout, /rel="preload"/);
  assert.match(layout, /scene-01-majestic-mountains\.webp/);
  assert.match(layout, /scene-02-sunset-colors\.webp/);
  assert.equal(webManifest.short_name, "TGS");
  assert.equal(webManifest.display, "standalone");
  assert.equal(webManifest.icons.length, 2);
});

test("mounts a predecoded, continuous nested zoom sequence", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

  assert.match(page, /ZOOM_SEQUENCE = \[0, 1, 2, 3, 4, 5, 6\]/);
  assert.match(page, /Promise\.all\(uniqueSources\.map\(loadDecodedScene\)\)/);
  assert.match(page, /window\.createImageBitmap\(blob\)/);
  assert.match(page, /level=\{level \+ 1\}/);
  assert.match(page, /className="zoom-portal"/);
  assert.match(page, /zoom-world--active/);
  assert.match(page, /zoom-world--warm/);
  assert.match(page, /Math\.exp\(/);
  assert.doesNotMatch(page, /setCurrentScene|transitionTimerRef/);
  assert.match(page, /Separá dos dedos para entrar/);
  assert.match(page, /Zoom libre/);
  assert.match(page, /Zoom guiado/);
  assert.match(page, /cameraOverride/);
  assert.match(page, /setManualCameraPosition/);
  assert.match(page, /Pellizcá y arrastrá para elegir la dirección/);
  assert.match(page, /buildClosedPath/);
  assert.match(page, /feGaussianBlur/);
  assert.match(page, /label="Feather"/);
  assert.match(page, /blurMaskAlpha/);
  assert.match(page, /Ajustar máscaras/);
  assert.match(page, /localStorage\.setItem\(SETTINGS_KEY/);
  assert.match(page, /ARTWORK_ASPECT_RATIO = 16 \/ 9/);
  assert.match(page, /MAX_SUPPORTED_IMAGES = 15/);
  assert.match(page, /MASK_PRESETS/);
  assert.match(page, /editorHandleScale/);
  assert.match(page, /Math\.floor\(depth\) \+ 1/);
  assert.match(page, /setTimeout\(\(\) => \{/);
  assert.match(page, /mask-center-handle/);
  assert.match(page, /movePortalByPixels/);
  assert.match(page, /REBASE_DELAY = 0\.18/);
  assert.match(page, /PREWARM_LEAD = 0\.65/);
  assert.match(page, /REBASE_BLEND_DEPTH = 0\.12/);
  assert.match(page, /pendingDepthRef/);
  assert.match(page, /depthFrameRef/);
  assert.match(page, /bufferAnchors\.map/);
  assert.match(page, /STARTUP_DECODE_LEVELS = 2/);
  assert.match(page, /RENDER_AHEAD_LEVELS = 3/);
  assert.match(page, /fetchPriority=/);
  assert.match(page, /interpolateSpline/);
  assert.match(page, /CAMERA_TANGENT_STRENGTH = 0\.18/);
  assert.match(page, /const strength = smoothing \/ 6/);
  assert.match(page, /logViewScale/);
  assert.match(page, /function CanvasZoomRenderer/);
  assert.match(page, /DECODED_IMAGE_CACHE/);
  assert.match(page, /releaseScenesOutside/);
  assert.match(page, /DECODE_BEHIND_LEVELS = 2/);
  assert.match(page, /DECODE_AHEAD_LEVELS = 2/);
  assert.match(page, /MAX_CONCURRENT_DECODES = 2/);
  assert.match(page, /acquireDecodeSlot/);
  assert.match(page, /cache: "force-cache"/);
  assert.match(page, /image\.close\(\)/);
  assert.match(page, /destination-in/);
  assert.match(page, /developerMode \? bufferAnchors\.map/);
  assert.match(page, /child\.scale \/ relativeScale/);
  assert.match(css, /\.mask-editor-overlay/);
  assert.match(css, /\.mask-center-handle/);
  assert.match(css, /\.developer-panel/);
  assert.match(css, /\.zoom-canvas/);
  assert.match(css, /\.zoom-world--warm/);
  assert.match(css, /\.zoom-renderer/);
  assert.match(css, /\.zoom-renderer--hidden/);
});
