export const PREVIEW_WIDTH = 768;
export const MAX_RETAINED_FULL_SCENES = 4;
export const MAX_DECODED_BYTES = 256 * 1024 * 1024;

export const previewSource = (source) => source.replace('/scenes/', '/scenes/previews/');

export const startupSource = (source, index) => index < 2 ? source : previewSource(source);

// Prepare every lightweight scene before starting, without loading every 4K.
export const startupSceneSources = (scenes) => [...new Set([
  ...scenes.slice(0, 4).map((scene, index) => startupSource(scene.src, index)),
  ...scenes.map(scene => previewSource(scene.src)),
])];

// All previews remain decoded. Keep current/next/previous 4K plus a bounded
// recently-needed neighbor, so crossing back and forth does not thrash them.
export function sceneLoadPlan(scenes, level, behind = 2, ahead = 3, retainedFull = []) {
  const previews = [], requiredFull = [];
  for (const offset of [0, 1, 2, 3, -1, -2]) {
    const index = level + offset;
    if (index < 0 || index >= scenes.length || offset < -behind || offset > ahead) continue;
    const source = scenes[index].src;
    previews.push(previewSource(source));
    if (offset >= -1 && offset <= 1) requiredFull.push(source);
  }
  const allPreviews = [...new Set([...previews, ...scenes.map(scene => previewSource(scene.src))])];
  const fullSources = [...requiredFull];
  const bytes = scene => scene.width * scene.height * 4;
  let decodedBytes = scenes.reduce((sum, scene) => sum
    + PREVIEW_WIDTH * Math.round(scene.height * PREVIEW_WIDTH / scene.width) * 4
    + (fullSources.includes(scene.src) ? bytes(scene) : 0), 0);
  for (const source of retainedFull) {
    if (fullSources.length >= MAX_RETAINED_FULL_SCENES) break;
    if (fullSources.includes(source)) continue;
    const index = scenes.findIndex(scene => scene.src === source);
    if (index < 0 || Math.abs(index - level) > 2) continue;
    const sceneBytes = bytes(scenes[index]);
    if (decodedBytes + sceneBytes > MAX_DECODED_BYTES) continue;
    fullSources.push(source);
    decodedBytes += sceneBytes;
  }
  const desired = new Set([...allPreviews, ...fullSources]);
  // Close previews first, then readable 4Ks, then distant previews. Startup
  // explicitly waits for all previews; later they remain cache hits.
  const prioritized = [...new Set([...previews, ...requiredFull, ...allPreviews, ...fullSources])];
  return { desired, prioritized, fullSources };
}

// Never retire a visible full-resolution source until its replacement is ready.
export const canReleaseScene = (source, desired, decoded) =>
  !desired.has(source) && !(desired.has(previewSource(source)) && !decoded.has(previewSource(source)));
