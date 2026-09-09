// Open the aperture, not the opacity of either image. The cached mask is sampled
// closer to its opaque centre as the child approaches its full-screen checkpoint.
// All production masks contain this central region; see mask-presets.test.mjs.
export function maskOpeningScale(depth, transitionLevel, viewWeight = 1) {
  const progress = Math.min(1, Math.max(0, (depth - transitionLevel - 0.88) / 0.12));
  const eased = progress * progress * progress * (progress * (progress * 6 - 15) + 10);
  return 1 + 15 * eased * viewWeight;
}

// The feathered image rim moves outside the image only at the checkpoint.
export function maskEdgeScale(depth, transitionLevel, viewWeight = 1) {
  const t = Math.min(1, Math.max(0, (depth - transitionLevel - 0.96) / 0.04));
  return 1 + 0.6 * t * t * (3 - 2 * t) * viewWeight;
}

// In free zoom, depth alone does not say where the user is looking. Keep the
// authored contour until the child covers the viewport, then open it smoothly
// with an 8% overscan. Panning back out restores the same contour continuously.
export function maskViewWeight(left, top, width, height, viewportWidth, viewportHeight) {
  if (width <= 0 || height <= 0) return 0;
  const clearance = Math.min(-left / width, -top / height,
    (left + width - viewportWidth) / width, (top + height - viewportHeight) / height);
  const t = Math.min(1, Math.max(0, clearance / 0.08));
  return t * t * (3 - 2 * t);
}
