export const ARTWORK_ASPECT_RATIO = 16 / 9;

// A stable world rectangle; the illustration itself is never stretched/cropped.
export function containedArtwork(width, height) {
  const aspect = width / height;
  const w = Math.min(1, aspect / ARTWORK_ASPECT_RATIO);
  const h = Math.min(1, ARTWORK_ASPECT_RATIO / aspect);
  return { x: (1 - w) / 2, y: (1 - h) / 2, width: w, height: h };
}

export function rebaseCamera(camera, nextAnchor, transitions) {
  let { x, y, anchorLevel } = camera;
  while (anchorLevel < nextAnchor) {
    const t = transitions[anchorLevel++];
    const p = t.portalScale / 100;
    const scale = p * t.imageScale;
    x = 0.5 + (x - t.portalX / 100 - p * t.imageX / 100) / scale;
    y = 0.5 + (y - t.portalY / 100 - p * t.imageY / 100) / scale;
  }
  while (anchorLevel > nextAnchor) {
    const t = transitions[--anchorLevel];
    const p = t.portalScale / 100;
    x = t.portalX / 100 + p * t.imageX / 100 + (x - 0.5) * p * t.imageScale;
    y = t.portalY / 100 + p * t.imageY / 100 + (y - 0.5) * p * t.imageScale;
  }
  return { x, y, anchorLevel };
}
