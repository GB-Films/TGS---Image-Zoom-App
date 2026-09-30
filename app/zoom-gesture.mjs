const CAMERA_TANGENT_STRENGTH = 0.18;

export const interpolateSpline = (previous, start, end, following, progress) => {
  const squared = progress * progress;
  const cubed = squared * progress;
  const startTangent = (end - previous) * CAMERA_TANGENT_STRENGTH;
  const endTangent = (following - start) * CAMERA_TANGENT_STRENGTH;
  return (2 * cubed - 3 * squared + 1) * start
    + (cubed - 2 * squared + progress) * startTangent
    + (-2 * cubed + 3 * squared) * end
    + (cubed - squared) * endTangent;
};

// Depth is a scene progress value, not a physical zoom factor. Invert the
// renderer's log-scale curve so a pinch changes scale by the finger ratio.
export const createZoomScaleMapping = (viewScales) => {
  const logs = viewScales.map(Math.log);
  const maxDepth = logs.length - 1;
  const logScaleAtDepth = (depth) => {
    const bounded = Math.min(maxDepth, Math.max(0, depth));
    const level = Math.floor(bounded);
    if (level === maxDepth) return logs[level];
    const start = logs[level];
    const end = logs[level + 1];
    return interpolateSpline(
      logs[level - 1] ?? 2 * start - end,
      start,
      end,
      logs[level + 2] ?? 2 * end - start,
      bounded - level,
    );
  };
  return {
    scaleAtDepth: (depth) => Math.exp(logScaleAtDepth(depth)),
    depthAtScale: (scale) => {
      const target = Math.log(scale);
      if (target <= logs[0]) return 0;
      if (target >= logs[maxDepth]) return maxDepth;
      let low = 0;
      let high = maxDepth;
      for (let iteration = 0; iteration < 36; iteration += 1) {
        const middle = (low + high) / 2;
        if (logScaleAtDepth(middle) < target) low = middle;
        else high = middle;
      }
      return (low + high) / 2;
    },
  };
};

export const cameraForPinch = (origin, focus, viewScale, viewport, artwork) => ({
  x: origin.cameraX
    + (origin.focusX - viewport.width / 2) / (artwork.width * origin.viewScale)
    - (focus.x - viewport.width / 2) / (artwork.width * viewScale),
  y: origin.cameraY
    + (origin.focusY - viewport.height / 2) / (artwork.height * origin.viewScale)
    - (focus.y - viewport.height / 2) / (artwork.height * viewScale),
});
