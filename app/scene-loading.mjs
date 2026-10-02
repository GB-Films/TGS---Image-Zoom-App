export const PREVIEW_WIDTH = 768;

export const previewSource = (source) => source.replace('/scenes/', '/scenes/previews/');

export const startupSource = (source, index) => index < 2 ? source : previewSource(source);

// Keep six placed scenes, but reserve full resolution for the current scene,
// the one we are entering and the one we can immediately return to.
export function sceneLoadPlan(scenes, level, behind = 2, ahead = 3) {
  const desired = new Set();
  const previews = [];
  const full = [];
  for (const offset of [0, 1, 2, 3, -1, -2]) {
    const index = level + offset;
    if (index < 0 || index >= scenes.length || offset < -behind || offset > ahead) continue;
    const source = scenes[index].src;
    previews.push(previewSource(source));
    desired.add(previewSource(source));
    if (offset >= -1 && offset <= 1) {
      full.push(source);
      desired.add(source);
    }
  }
  return { desired, prioritized: [...previews, ...full] };
}

// Never retire a visible full-resolution source until its replacement is ready.
export const canReleaseScene = (source, desired, decoded) =>
  !desired.has(source) && !(desired.has(previewSource(source)) && !decoded.has(previewSource(source)));
