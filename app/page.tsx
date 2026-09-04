"use client";

import {
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
  type WheelEvent,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

export const dynamic = "force-static";

type MotionOrigin = { beta: number; gamma: number };
type PointerPosition = { x: number; y: number };
type GestureOrigin = {
  distance: number;
  depth: number;
  cameraX: number;
  cameraY: number;
  viewScale: number;
  focusX: number;
  focusY: number;
};
type ExperienceMode = "manual" | "guided";
type MaskPoint = { x: number; y: number };
type LayerPlacement = { centerX: number; centerY: number; scale: number };
type DecodedScene = HTMLImageElement | ImageBitmap;

type TransitionSettings = {
  portalX: number;
  portalY: number;
  portalScale: number;
  imageX: number;
  imageY: number;
  imageScale: number;
  smoothing: number;
  feather: number;
  points: MaskPoint[];
};

const PUBLIC_ASSET_BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const publicAsset = (path: string) => `${PUBLIC_ASSET_BASE}${path}`;

const SCENES = [
  { src: publicAsset("/scenes/scene-01-majestic-mountains.webp"), alt: "Paisaje digital de montañas majestuosas", focalX: 0.54, focalY: 0.46, portalStart: 11 },
  { src: publicAsset("/scenes/scene-02-sunset-colors.webp"), alt: "Paisaje con colores intensos de atardecer", focalX: 0.61, focalY: 0.43, portalStart: 10 },
  { src: publicAsset("/scenes/scene-03-digital-sunset.webp"), alt: "Paisaje digital junto al agua al atardecer", focalX: 0.5, focalY: 0.52, portalStart: 10 },
  { src: publicAsset("/scenes/scene-04-snowy-forest.webp"), alt: "Montañas nevadas en un bosque", focalX: 0.44, focalY: 0.46, portalStart: 10 },
  { src: publicAsset("/scenes/scene-05-astronaut.webp"), alt: "Astronauta rodeado de planetas y flores", focalX: 0.56, focalY: 0.5, portalStart: 10 },
  { src: publicAsset("/scenes/scene-06-cosmic-landscape.webp"), alt: "Paisaje cósmico de prueba", focalX: 0.43, focalY: 0.54, portalStart: 10 },
  { src: publicAsset("/scenes/scene-07-final-landscape.webp"), alt: "Paisaje digital final de la secuencia", focalX: 0.5, focalY: 0.5, portalStart: 10 },
] as const;

const ZOOM_SEQUENCE = [0, 1, 2, 3, 4, 5, 6] as const;
const MAX_DEPTH = ZOOM_SEQUENCE.length - 1;
const SETTINGS_KEY = "tgs-zoom-mask-settings-v2";
const ARTWORK_ASPECT_RATIO = 16 / 9;
const MAX_SUPPORTED_IMAGES = 15;
const RENDER_AHEAD_LEVELS = 3;
const STARTUP_DECODE_LEVELS = 3;
const DECODE_BEHIND_LEVELS = 2;
const DECODE_AHEAD_LEVELS = 2;
const REBASE_DELAY = 0.18;
const PREWARM_LEAD = 0.65;
const REBASE_BLEND_DEPTH = 0.12;
const MASK_IMAGE_CACHE = new Map<string, string>();
const DECODED_IMAGE_CACHE = new Map<string, DecodedScene>();
const IMAGE_LOAD_PROMISES = new Map<string, Promise<DecodedScene | null>>();
const ACTIVE_IMAGE_SOURCES = new Set<string>();
const MAX_CONCURRENT_DECODES = 2;
const DECODE_WAITERS: Array<() => void> = [];
let decodesInFlight = 0;
const CANVAS_MASK_CACHE = new Map<string, HTMLCanvasElement>();
const CANVAS_REBASE_DELAY = 0.4;
const CAMERA_TANGENT_STRENGTH = 0.18;

const DEFAULT_MASK_POINTS: MaskPoint[] = [
  { x: 0.5, y: 0.07 },
  { x: 0.78, y: 0.14 },
  { x: 0.93, y: 0.38 },
  { x: 0.9, y: 0.68 },
  { x: 0.68, y: 0.91 },
  { x: 0.35, y: 0.92 },
  { x: 0.1, y: 0.68 },
  { x: 0.08, y: 0.34 },
];

const MASK_PRESETS = {
  circle: {
    smoothing: 1,
    points: Array.from({ length: 6 }, (_value, index) => {
      const angle = -Math.PI / 2 + index * Math.PI / 3;
      return { x: 0.5 + Math.cos(angle) * 0.38, y: 0.5 + Math.sin(angle) * 0.38 };
    }),
  },
  square: {
    smoothing: 0,
    points: [
      { x: 0.14, y: 0.14 }, { x: 0.86, y: 0.14 },
      { x: 0.86, y: 0.86 }, { x: 0.14, y: 0.86 },
    ],
  },
  triangle: {
    smoothing: 0,
    points: [
      { x: 0.5, y: 0.1 }, { x: 0.9, y: 0.86 }, { x: 0.1, y: 0.86 },
    ],
  },
} as const;

const clamp = (value: number, min = 0, max = 1) =>
  Math.min(max, Math.max(min, value));

const isImageBitmap = (image: DecodedScene): image is ImageBitmap =>
  typeof ImageBitmap !== "undefined" && image instanceof ImageBitmap;

const releaseDecodedScene = (image: DecodedScene) => {
  if (isImageBitmap(image)) {
    image.close();
  } else {
    image.src = "";
  }
};

const isDecodedSceneReady = (image: DecodedScene) =>
  isImageBitmap(image)
    ? image.width > 0 && image.height > 0
    : image.complete && image.naturalWidth > 0;

const decodeImageElement = (src: string, blob?: Blob) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new window.Image();
    const objectUrl = blob ? URL.createObjectURL(blob) : null;
    image.decoding = "async";
    image.onload = () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      resolve(image);
    };
    image.onerror = () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      reject(new Error(`No se pudo decodificar ${src}`));
    };
    image.src = objectUrl ?? src;
  });

const acquireDecodeSlot = async () => {
  if (decodesInFlight >= MAX_CONCURRENT_DECODES) {
    await new Promise<void>((resolve) => DECODE_WAITERS.push(resolve));
  }
  decodesInFlight += 1;
};

const releaseDecodeSlot = () => {
  decodesInFlight = Math.max(0, decodesInFlight - 1);
  DECODE_WAITERS.shift()?.();
};

const loadDecodedScene = (src: string) => {
  const cached = DECODED_IMAGE_CACHE.get(src);
  if (cached && isDecodedSceneReady(cached)) return Promise.resolve(cached);
  const pending = IMAGE_LOAD_PROMISES.get(src);
  if (pending) return pending;

  const loadPromise = (async (): Promise<DecodedScene | null> => {
    await acquireDecodeSlot();
    try {
      if (!ACTIVE_IMAGE_SOURCES.has(src)) return null;
      const response = await fetch(src, { cache: "force-cache" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const blob = await response.blob();
      let decoded: DecodedScene;
      if (typeof window.createImageBitmap === "function") {
        try {
          decoded = await window.createImageBitmap(blob);
        } catch {
          decoded = await decodeImageElement(src, blob);
        }
      } else {
        decoded = await decodeImageElement(src, blob);
      }
      if (!ACTIVE_IMAGE_SOURCES.has(src)) {
        releaseDecodedScene(decoded);
        return null;
      }
      DECODED_IMAGE_CACHE.set(src, decoded);
      return decoded;
    } catch {
      try {
        const decoded = await decodeImageElement(src);
        if (!ACTIVE_IMAGE_SOURCES.has(src)) {
          releaseDecodedScene(decoded);
          return null;
        }
        DECODED_IMAGE_CACHE.set(src, decoded);
        return decoded;
      } catch {
        return null;
      }
    } finally {
      releaseDecodeSlot();
      IMAGE_LOAD_PROMISES.delete(src);
    }
  })();
  IMAGE_LOAD_PROMISES.set(src, loadPromise);
  return loadPromise;
};

const releaseScenesOutside = (sources: Set<string>) => {
  for (const [src, decoded] of DECODED_IMAGE_CACHE) {
    if (sources.has(src)) continue;
    releaseDecodedScene(decoded);
    DECODED_IMAGE_CACHE.delete(src);
  }
};

const clonePoints = (points: MaskPoint[]) => points.map((point) => ({ ...point }));

const createDefaultTransitions = (): TransitionSettings[] =>
  ZOOM_SEQUENCE.slice(0, -1).map((_sceneIndex, level) => {
    const scene = SCENES[ZOOM_SEQUENCE[level]];
    return {
      portalX: scene.focalX * 100,
      portalY: scene.focalY * 100,
      portalScale: scene.portalStart,
      imageX: 0,
      imageY: 0,
      imageScale: 1,
      smoothing: 0.72,
      feather: 24,
      points: clonePoints(DEFAULT_MASK_POINTS),
    };
  });

const distanceBetween = (positions: PointerPosition[]) =>
  Math.hypot(
    positions[0].x - positions[1].x,
    positions[0].y - positions[1].y,
  );

const interpolateSpline = (
  previous: number,
  start: number,
  end: number,
  following: number,
  progress: number,
) => {
  const progressSquared = progress * progress;
  const progressCubed = progressSquared * progress;
  const startTangent = (end - previous) * CAMERA_TANGENT_STRENGTH;
  const endTangent = (following - start) * CAMERA_TANGENT_STRENGTH;
  return (
    (2 * progressCubed - 3 * progressSquared + 1) * start +
    (progressCubed - 2 * progressSquared + progress) * startTangent +
    (-2 * progressCubed + 3 * progressSquared) * end +
    (progressCubed - progressSquared) * endTangent
  );
};

const buildClosedPath = (points: MaskPoint[], smoothing: number, size = 1000) => {
  if (points.length < 3) return "";
  const scaled = points.map((point) => ({ x: point.x * size, y: point.y * size }));

  if (smoothing <= 0.01) {
    return `${scaled.map((point, index) =>
      `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`,
    ).join(" ")} Z`;
  }

  const commands = [`M ${scaled[0].x.toFixed(2)} ${scaled[0].y.toFixed(2)}`];
  for (let index = 0; index < scaled.length; index += 1) {
    const previous = scaled[(index - 1 + scaled.length) % scaled.length];
    const current = scaled[index];
    const next = scaled[(index + 1) % scaled.length];
    const afterNext = scaled[(index + 2) % scaled.length];
    const strength = smoothing / 6;
    const controlOne = {
      x: current.x + (next.x - previous.x) * strength,
      y: current.y + (next.y - previous.y) * strength,
    };
    const controlTwo = {
      x: next.x - (afterNext.x - current.x) * strength,
      y: next.y - (afterNext.y - current.y) * strength,
    };

    commands.push(
      `C ${controlOne.x.toFixed(2)} ${controlOne.y.toFixed(2)} ` +
        `${controlTwo.x.toFixed(2)} ${controlTwo.y.toFixed(2)} ` +
        `${next.x.toFixed(2)} ${next.y.toFixed(2)}`,
    );
  }
  return `${commands.join(" ")} Z`;
};

const createMaskImage = (settings: TransitionSettings) => {
  const cacheKey = JSON.stringify([
    settings.smoothing,
    settings.feather,
    settings.points,
  ]);
  const cachedMask = MASK_IMAGE_CACHE.get(cacheKey);
  if (cachedMask) return cachedMask;
  const path = buildClosedPath(settings.points, settings.smoothing);
  const filter = settings.feather > 0
    ? `<defs><filter id="soft" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="${settings.feather}" /></filter></defs>`
    : "";
  const filterAttribute = settings.feather > 0 ? ' filter="url(#soft)"' : "";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" preserveAspectRatio="none">${filter}<path d="${path}" fill="white"${filterAttribute}/></svg>`;
  const maskImage = `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
  if (MASK_IMAGE_CACHE.size >= 64) {
    const oldestKey = MASK_IMAGE_CACHE.keys().next().value;
    if (oldestKey) MASK_IMAGE_CACHE.delete(oldestKey);
  }
  MASK_IMAGE_CACHE.set(cacheKey, maskImage);
  return maskImage;
};

const calculateLayerPlacements = (
  transitions: TransitionSettings[],
  anchorLevel: number,
) => {
  const placements: Array<LayerPlacement | undefined> = Array(ZOOM_SEQUENCE.length);
  placements[anchorLevel] = { centerX: 0.5, centerY: 0.5, scale: 1 };

  for (let level = anchorLevel - 1; level >= 0; level -= 1) {
    const child = placements[level + 1];
    if (!child) break;
    const transition = transitions[level];
    if (!transition) break;
    const portalScale = transition.portalScale / 100;
    const relativeScale = portalScale * transition.imageScale;
    const relativeX =
      transition.portalX / 100 - 0.5 + portalScale * transition.imageX / 100;
    const relativeY =
      transition.portalY / 100 - 0.5 + portalScale * transition.imageY / 100;
    const parentScale = child.scale / relativeScale;
    placements[level] = {
      centerX: child.centerX - parentScale * relativeX,
      centerY: child.centerY - parentScale * relativeY,
      scale: parentScale,
    };
  }

  for (let level = anchorLevel + 1; level < ZOOM_SEQUENCE.length; level += 1) {
    const parent = placements[level - 1];
    if (!parent) break;
    const transition = transitions[level - 1];
    if (!transition) break;
    const portalScale = transition.portalScale / 100;
    placements[level] = {
      centerX:
        parent.centerX +
        parent.scale *
          (transition.portalX / 100 - 0.5 + portalScale * transition.imageX / 100),
      centerY:
        parent.centerY +
        parent.scale *
          (transition.portalY / 100 - 0.5 + portalScale * transition.imageY / 100),
      scale: parent.scale * portalScale * transition.imageScale,
    };
  }

  return placements;
};

const calculateCameraForAnchor = (
  transitions: TransitionSettings[],
  anchorLevel: number,
  level: number,
  nextLevel: number,
  levelProgress: number,
) => {
  const placements = calculateLayerPlacements(transitions, anchorLevel);
  const currentPlacement = placements[level] ?? { centerX: 0.5, centerY: 0.5, scale: 1 };
  const nextPlacement = placements[nextLevel] ?? currentPlacement;
  const previousPlacement = placements[level - 1] ?? {
    centerX: currentPlacement.centerX * 2 - nextPlacement.centerX,
    centerY: currentPlacement.centerY * 2 - nextPlacement.centerY,
    scale: currentPlacement.scale * currentPlacement.scale / nextPlacement.scale,
  };
  const followingPlacement = placements[nextLevel + 1] ?? {
    centerX: nextPlacement.centerX * 2 - currentPlacement.centerX,
    centerY: nextPlacement.centerY * 2 - currentPlacement.centerY,
    scale: nextPlacement.scale * nextPlacement.scale / currentPlacement.scale,
  };
  const cameraX = interpolateSpline(
    previousPlacement.centerX,
    currentPlacement.centerX,
    nextPlacement.centerX,
    followingPlacement.centerX,
    levelProgress,
  );
  const cameraY = interpolateSpline(
    previousPlacement.centerY,
    currentPlacement.centerY,
    nextPlacement.centerY,
    followingPlacement.centerY,
    levelProgress,
  );
  const logViewScale = interpolateSpline(
    -Math.log(previousPlacement.scale),
    -Math.log(currentPlacement.scale),
    -Math.log(nextPlacement.scale),
    -Math.log(followingPlacement.scale),
    levelProgress,
  );
  const viewScale = Math.exp(logViewScale);
  return { placements, currentPlacement, cameraX, cameraY, viewScale };
};

const calculateCanonicalCameraAtDepth = (transitions: TransitionSettings[], depth: number) => {
  const level = Math.min(Math.floor(depth), MAX_DEPTH);
  const nextLevel = Math.min(level + 1, MAX_DEPTH);
  const levelProgress = nextLevel === level ? 0 : depth - level;
  return calculateCameraForAnchor(
    transitions,
    0,
    level,
    nextLevel,
    levelProgress,
  );
};

const blurMaskAlpha = (
  pixels: ImageData,
  width: number,
  height: number,
  radius: number,
) => {
  if (radius < 1) return;
  const source = new Uint8ClampedArray(width * height);
  const temporary = new Uint8ClampedArray(width * height);
  for (let index = 0; index < source.length; index += 1) {
    source[index] = pixels.data[index * 4 + 3];
  }

  const horizontalPass = (input: Uint8ClampedArray, output: Uint8ClampedArray) => {
    const diameter = radius * 2 + 1;
    for (let y = 0; y < height; y += 1) {
      const row = y * width;
      let sum = 0;
      for (let offset = -radius; offset <= radius; offset += 1) {
        sum += input[row + clamp(offset, 0, width - 1)];
      }
      for (let x = 0; x < width; x += 1) {
        output[row + x] = Math.round(sum / diameter);
        sum -= input[row + clamp(x - radius, 0, width - 1)];
        sum += input[row + clamp(x + radius + 1, 0, width - 1)];
      }
    }
  };

  const verticalPass = (input: Uint8ClampedArray, output: Uint8ClampedArray) => {
    const diameter = radius * 2 + 1;
    for (let x = 0; x < width; x += 1) {
      let sum = 0;
      for (let offset = -radius; offset <= radius; offset += 1) {
        sum += input[clamp(offset, 0, height - 1) * width + x];
      }
      for (let y = 0; y < height; y += 1) {
        output[y * width + x] = Math.round(sum / diameter);
        sum -= input[clamp(y - radius, 0, height - 1) * width + x];
        sum += input[clamp(y + radius + 1, 0, height - 1) * width + x];
      }
    }
  };

  for (let pass = 0; pass < 3; pass += 1) {
    horizontalPass(source, temporary);
    verticalPass(temporary, source);
  }
  for (let index = 0; index < source.length; index += 1) {
    pixels.data[index * 4] = 255;
    pixels.data[index * 4 + 1] = 255;
    pixels.data[index * 4 + 2] = 255;
    pixels.data[index * 4 + 3] = source[index];
  }
};

const getCanvasMask = (settings: TransitionSettings) => {
  const cacheKey = JSON.stringify([settings.smoothing, settings.feather, settings.points]);
  const cachedMask = CANVAS_MASK_CACHE.get(cacheKey);
  if (cachedMask) return cachedMask;

  const width = 512;
  const height = Math.round(width / ARTWORK_ASPECT_RATIO);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) return canvas;

  const path = new Path2D(buildClosedPath(settings.points, settings.smoothing, 1));
  context.setTransform(width, 0, 0, height, 0, 0);
  context.fillStyle = "#ffffff";
  context.fill(path);
  context.setTransform(1, 0, 0, 1, 0, 0);
  const featherRadius = Math.round(settings.feather / 1000 * width);
  if (featherRadius > 0) {
    const pixels = context.getImageData(0, 0, width, height);
    blurMaskAlpha(pixels, width, height, featherRadius);
    context.putImageData(pixels, 0, 0);
  }

  if (CANVAS_MASK_CACHE.size >= 64) {
    const oldestKey = CANVAS_MASK_CACHE.keys().next().value;
    if (oldestKey) CANVAS_MASK_CACHE.delete(oldestKey);
  }
  CANVAS_MASK_CACHE.set(cacheKey, canvas);
  return canvas;
};

function CanvasZoomRenderer({
  depth,
  transitions,
  viewport,
  hidden,
  cacheRevision,
  cameraOverride,
  renderBuffers,
}: {
  depth: number;
  transitions: TransitionSettings[];
  viewport: { width: number; height: number };
  hidden: boolean;
  cacheRevision: number;
  cameraOverride?: { x: number; y: number; viewScale: number };
  renderBuffers?: Array<{ anchorLevel: number; opacity: number }>;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const layerCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const maskCanvasRef = useRef<HTMLCanvasElement | null>(null);

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || hidden || viewport.width <= 0 || viewport.height <= 0) return;

    const pixelRatio = Math.min(window.devicePixelRatio || 1, 1.25);
    const renderWidth = Math.max(1, Math.round(viewport.width * pixelRatio));
    const renderHeight = Math.max(1, Math.round(viewport.height * pixelRatio));
    if (canvas.width !== renderWidth || canvas.height !== renderHeight) {
      canvas.width = renderWidth;
      canvas.height = renderHeight;
    }

    if (!layerCanvasRef.current) layerCanvasRef.current = document.createElement("canvas");
    if (!maskCanvasRef.current) maskCanvasRef.current = document.createElement("canvas");
    const layerCanvas = layerCanvasRef.current;
    const maskCanvas = maskCanvasRef.current;
    if (layerCanvas.width !== renderWidth || layerCanvas.height !== renderHeight) {
      layerCanvas.width = renderWidth;
      layerCanvas.height = renderHeight;
      maskCanvas.width = renderWidth;
      maskCanvas.height = renderHeight;
    }

    const context = canvas.getContext("2d", { alpha: true });
    const layerContext = layerCanvas.getContext("2d");
    const maskContext = maskCanvas.getContext("2d");
    if (!context || !layerContext || !maskContext) return;

    const level = Math.min(Math.floor(depth), MAX_DEPTH);
    const nextLevel = Math.min(level + 1, MAX_DEPTH);
    const levelProgress = nextLevel === level ? 0 : depth - level;
    const anchorLevel = Math.max(
      0,
      Math.floor(Math.max(0, depth - CANVAS_REBASE_DELAY)) - 1,
    );
    const artworkWidth = Math.max(viewport.width, viewport.height * ARTWORK_ASPECT_RATIO);
    const artworkHeight = artworkWidth / ARTWORK_ASPECT_RATIO;

    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, renderWidth, renderHeight);
    if (!cameraOverride) {
      context.fillStyle = "#001827";
      context.fillRect(0, 0, renderWidth, renderHeight);
    }
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";

    const buffers = renderBuffers ?? [{ anchorLevel, opacity: 1 }];
    const renderBuffer = (bufferAnchor: number, opacity: number) => {
      // Warm buffers are kept for the DOM editor, but drawing a nearly invisible
      // 4K scene on every frame would waste the canvas budget.
      if (opacity <= 0.01) return;
      const calculatedCamera = calculateCameraForAnchor(
        transitions,
        bufferAnchor,
        level,
        nextLevel,
        levelProgress,
      );
      const camera = cameraOverride
        ? (() => {
            const framePlacement = calculatedCamera.placements[0] ?? {
              centerX: 0.5,
              centerY: 0.5,
              scale: 1,
            };
            const frameScale = Math.max(framePlacement.scale, 0.000001);
            return {
              ...calculatedCamera,
              cameraX: framePlacement.centerX + frameScale * (cameraOverride.x - 0.5),
              cameraY: framePlacement.centerY + frameScale * (cameraOverride.y - 0.5),
              viewScale: cameraOverride.viewScale / frameScale,
            };
          })()
        : calculatedCamera;
      const toScreenX = (coordinate: number) =>
        (viewport.width / 2 +
          (coordinate - camera.cameraX) * artworkWidth * camera.viewScale) * pixelRatio;
      const toScreenY = (coordinate: number) =>
        (viewport.height / 2 +
          (coordinate - camera.cameraY) * artworkHeight * camera.viewScale) * pixelRatio;

      context.globalCompositeOperation = "source-over";
      context.globalAlpha = opacity;
      const layersToRender = cameraOverride
        ? [...new Set([
            Math.max(1, bufferAnchor),
            Math.max(1, bufferAnchor + 1),
            Math.max(1, bufferAnchor + 2),
            Math.max(1, level - 1),
            Math.max(1, level),
            Math.max(1, nextLevel),
          ])]
          .filter((layer) => layer <= MAX_DEPTH)
          .sort((first, second) => first - second)
        : Array.from(
            { length: Math.min(MAX_DEPTH, bufferAnchor + 3) - bufferAnchor + 1 },
            (_value, index) => bufferAnchor + index,
          );
      for (const layer of layersToRender) {
        const placement = camera.placements[layer];
        const image = DECODED_IMAGE_CACHE.get(SCENES[ZOOM_SEQUENCE[layer]].src);
        if (!placement || !image || !isDecodedSceneReady(image)) continue;

        layerContext.setTransform(1, 0, 0, 1, 0, 0);
        layerContext.clearRect(0, 0, renderWidth, renderHeight);
        layerContext.globalCompositeOperation = "source-over";
        layerContext.globalAlpha = 1;
        layerContext.imageSmoothingEnabled = true;
        layerContext.imageSmoothingQuality = "high";

        const layerWidth = artworkWidth * camera.viewScale * placement.scale * pixelRatio;
        const layerHeight = artworkHeight * camera.viewScale * placement.scale * pixelRatio;
        const layerCenterX = toScreenX(placement.centerX);
        const layerCenterY = toScreenY(placement.centerY);
        layerContext.drawImage(
          image,
          layerCenterX - layerWidth / 2,
          layerCenterY - layerHeight / 2,
          layerWidth,
          layerHeight,
        );

        if (layer > bufferAnchor) {
          maskContext.setTransform(1, 0, 0, 1, 0, 0);
          maskContext.clearRect(0, 0, renderWidth, renderHeight);
          maskContext.globalAlpha = 1;
          let maskDrawn = false;

          for (let transitionLevel = bufferAnchor; transitionLevel < layer; transitionLevel += 1) {
            const parentPlacement = camera.placements[transitionLevel];
            const transition = transitions[transitionLevel];
            if (!parentPlacement || !transition) continue;

            const portalScale = transition.portalScale / 100;
            const portalCenterX =
              parentPlacement.centerX +
              parentPlacement.scale * (transition.portalX / 100 - 0.5);
            const portalCenterY =
              parentPlacement.centerY +
              parentPlacement.scale * (transition.portalY / 100 - 0.5);
            const portalWidth =
              artworkWidth * camera.viewScale * parentPlacement.scale * portalScale * pixelRatio;
            const portalHeight =
              artworkHeight * camera.viewScale * parentPlacement.scale * portalScale * pixelRatio;
            const portalScreenX = toScreenX(portalCenterX);
            const portalScreenY = toScreenY(portalCenterY);
            const mask = getCanvasMask(transition);

            maskContext.globalCompositeOperation = maskDrawn ? "destination-in" : "source-over";
            maskContext.drawImage(
              mask,
              portalScreenX - portalWidth / 2,
              portalScreenY - portalHeight / 2,
              portalWidth,
              portalHeight,
            );
            maskDrawn = true;
          }

          if (maskDrawn) {
            layerContext.globalCompositeOperation = "destination-in";
            layerContext.drawImage(maskCanvas, 0, 0);
          }
        }

        context.drawImage(layerCanvas, 0, 0);
      }
    };

    for (const buffer of buffers) renderBuffer(buffer.anchorLevel, buffer.opacity);
    context.globalAlpha = 1;
  }, [cacheRevision, cameraOverride, depth, hidden, renderBuffers, transitions, viewport]);

  return (
    <canvas
      ref={canvasRef}
      className={`zoom-renderer${hidden ? " zoom-renderer--hidden" : ""}`}
      aria-hidden="true"
    />
  );
}

function MaskEditorOverlay({
  points,
  smoothing,
  selectedPoint,
  onSelectPoint,
  onMovePoint,
  handleScale,
  onDragChange,
  onMovePortal,
}: {
  points: MaskPoint[];
  smoothing: number;
  selectedPoint: number;
  onSelectPoint: (index: number) => void;
  onMovePoint: (index: number, point: MaskPoint) => void;
  handleScale: number;
  onDragChange: (dragging: boolean) => void;
  onMovePortal: (deltaX: number, deltaY: number) => void;
}) {
  const editorRef = useRef<HTMLDivElement>(null);
  const draggingPointRef = useRef<number | null>(null);
  const draggingPortalRef = useRef(false);
  const lastPortalPositionRef = useRef<PointerPosition | null>(null);
  const pointFrameRef = useRef(0);
  const pendingPointRef = useRef<{ index: number; point: MaskPoint } | null>(null);
  const portalFrameRef = useRef(0);
  const pendingPortalDeltaRef = useRef({ x: 0, y: 0 });
  const path = buildClosedPath(points, smoothing, 100);

  const flushPointMove = () => {
    if (!pendingPointRef.current) return;
    onMovePoint(pendingPointRef.current.index, pendingPointRef.current.point);
    pendingPointRef.current = null;
  };

  const flushPortalMove = () => {
    const delta = pendingPortalDeltaRef.current;
    if (delta.x !== 0 || delta.y !== 0) onMovePortal(delta.x, delta.y);
    pendingPortalDeltaRef.current = { x: 0, y: 0 };
  };

  const moveSelectedPoint = (event: PointerEvent<HTMLButtonElement>) => {
    if (draggingPointRef.current === null || !editorRef.current) return;
    event.preventDefault();
    event.stopPropagation();
    const bounds = editorRef.current.getBoundingClientRect();
    pendingPointRef.current = { index: draggingPointRef.current, point: {
      x: clamp((event.clientX - bounds.left) / bounds.width, 0.01, 0.99),
      y: clamp((event.clientY - bounds.top) / bounds.height, 0.01, 0.99),
    } };
    if (!pointFrameRef.current) {
      pointFrameRef.current = window.requestAnimationFrame(() => {
        pointFrameRef.current = 0;
        flushPointMove();
      });
    }
  };

  useEffect(() => () => {
    window.cancelAnimationFrame(pointFrameRef.current);
    window.cancelAnimationFrame(portalFrameRef.current);
  }, []);

  return (
    <div ref={editorRef} className="mask-editor-overlay">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        <path d={path} />
      </svg>
      {points.map((point, index) => (
        <button
          key={index}
          className={`mask-point${selectedPoint === index ? " mask-point--selected" : ""}`}
          type="button"
          aria-label={`Punto ${index + 1} de la máscara`}
          style={{
            left: `${point.x * 100}%`,
            top: `${point.y * 100}%`,
            transform: `translate(-50%, -50%) scale(${handleScale})`,
          }}
          onPointerDown={(event) => {
            event.preventDefault();
            event.stopPropagation();
            draggingPointRef.current = index;
            onSelectPoint(index);
            onDragChange(true);
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerMove={moveSelectedPoint}
          onPointerUp={(event) => {
            event.stopPropagation();
            flushPointMove();
            draggingPointRef.current = null;
            onDragChange(false);
          }}
          onPointerCancel={() => {
            draggingPointRef.current = null;
            onDragChange(false);
          }}
        />
      ))}
      <button
        className="mask-center-handle"
        type="button"
        aria-label="Mover la máscara y el objetivo del zoom"
        style={{ transform: `translate(-50%, -50%) scale(${handleScale})` }}
        onPointerDown={(event) => {
          event.preventDefault();
          event.stopPropagation();
          draggingPortalRef.current = true;
          lastPortalPositionRef.current = { x: event.clientX, y: event.clientY };
          onDragChange(true);
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          if (!draggingPortalRef.current || !lastPortalPositionRef.current) return;
          event.preventDefault();
          event.stopPropagation();
          const deltaX = event.clientX - lastPortalPositionRef.current.x;
          const deltaY = event.clientY - lastPortalPositionRef.current.y;
          lastPortalPositionRef.current = { x: event.clientX, y: event.clientY };
          pendingPortalDeltaRef.current.x += deltaX;
          pendingPortalDeltaRef.current.y += deltaY;
          if (!portalFrameRef.current) {
            portalFrameRef.current = window.requestAnimationFrame(() => {
              portalFrameRef.current = 0;
              flushPortalMove();
            });
          }
        }}
        onPointerUp={(event) => {
          event.stopPropagation();
          flushPortalMove();
          draggingPortalRef.current = false;
          lastPortalPositionRef.current = null;
          onDragChange(false);
        }}
        onPointerCancel={() => {
          flushPortalMove();
          draggingPortalRef.current = false;
          lastPortalPositionRef.current = null;
          onDragChange(false);
        }}
      >
        <span aria-hidden="true">✥</span>
      </button>
    </div>
  );
}

function ZoomLayer({
  level,
  transitions,
  editingTransition,
  selectedPoint,
  onSelectPoint,
  onMovePoint,
  editorHandleScale,
  depth,
  maskIsDragging,
  onMaskDragChange,
  onMovePortal,
}: {
  level: number;
  transitions: TransitionSettings[];
  editingTransition: number | null;
  selectedPoint: number;
  onSelectPoint: (index: number) => void;
  onMovePoint: (index: number, point: MaskPoint) => void;
  editorHandleScale: number;
  depth: number;
  maskIsDragging: boolean;
  onMaskDragChange: (dragging: boolean) => void;
  onMovePortal: (deltaX: number, deltaY: number) => void;
}) {
  const scene = SCENES[ZOOM_SEQUENCE[level]];
  const hasNextLayer =
    level < MAX_DEPTH && level <= Math.floor(depth) + RENDER_AHEAD_LEVELS - 1;
  const transition = transitions[level];
  const isLiveEditing = editingTransition === level && maskIsDragging;
  const maskIsVisible = level >= Math.floor(depth) - 1 || editingTransition === level;
  const maskImage = useMemo(
    () => (hasNextLayer && transition && maskIsVisible && !isLiveEditing ? createMaskImage(transition) : "none"),
    [hasNextLayer, isLiveEditing, maskIsVisible, transition],
  );

  const portalStyle: CSSProperties | undefined = transition
    ? {
        top: `${transition.portalY}%`,
        left: `${transition.portalX}%`,
        transform: `translate3d(-50%, -50%, 0) scale(${transition.portalScale / 100})`,
      }
    : undefined;
  const maskStyle: CSSProperties | undefined = transition
    ? isLiveEditing
      ? { clipPath: `polygon(${transition.points.map((point) => `${point.x * 100}% ${point.y * 100}%`).join(", ")})` }
      : { WebkitMaskImage: maskImage, maskImage }
    : undefined;
  const contentStyle: CSSProperties | undefined = transition
    ? {
        transform: `translate3d(${transition.imageX}%, ${transition.imageY}%, 0) scale(${transition.imageScale})`,
      }
    : undefined;

  return (
    <div className="zoom-layer">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="zoom-image" src={scene.src} alt={level === 0 ? scene.alt : ""}
        decoding="async"
        loading="eager"
        fetchPriority={level <= Math.floor(depth) + 1 ? "high" : "low"}
        draggable="false" />

      {hasNextLayer && transition ? (
        <div className="zoom-portal" style={portalStyle}>
          <div className="zoom-portal__mask" style={maskStyle}>
            <div className="zoom-portal__content" style={contentStyle}>
              <ZoomLayer
                level={level + 1}
                transitions={transitions}
                editingTransition={editingTransition}
                selectedPoint={selectedPoint}
                onSelectPoint={onSelectPoint}
                onMovePoint={onMovePoint}
                editorHandleScale={editorHandleScale}
                depth={depth}
                maskIsDragging={maskIsDragging}
                onMaskDragChange={onMaskDragChange}
                onMovePortal={onMovePortal}
              />
            </div>
          </div>
          {editingTransition === level ? (
            <MaskEditorOverlay points={transition.points} smoothing={transition.smoothing}
              selectedPoint={selectedPoint} onSelectPoint={onSelectPoint}
              onMovePoint={onMovePoint} handleScale={editorHandleScale}
              onDragChange={onMaskDragChange} onMovePortal={onMovePortal} />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function EditorRange({
  label,
  value,
  min,
  max,
  step,
  suffix = "",
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  suffix?: string;
  onChange: (value: number) => void;
}) {
  const inputId = useId();
  return (
    <div className="editor-range">
      <span><label htmlFor={inputId}>{label}</label><output>{value.toFixed(step < 1 ? 2 : 0)}{suffix}</output></span>
      <input id={inputId} type="range" value={value} min={min} max={max} step={step}
        onChange={(event) => onChange(Number(event.target.value))} />
    </div>
  );
}

export default function Home() {
  const welcomeRef = useRef<HTMLElement>(null);
  const zoomRef = useRef<HTMLDivElement>(null);
  const motionOriginRef = useRef<MotionOrigin | null>(null);
  const pointersRef = useRef(new Map<number, PointerPosition>());
  const gestureOriginRef = useRef<GestureOrigin | null>(null);
  const panOriginRef = useRef<{ x: number; y: number; cameraX: number; cameraY: number } | null>(null);
  const depthRef = useRef(0);
  const pendingDepthRef = useRef(0);
  const depthFrameRef = useRef(0);

  const [assetsReady, setAssetsReady] = useState(false);
  const [started, setStarted] = useState(false);
  const [experienceMode, setExperienceMode] = useState<ExperienceMode>("manual");
  const [depth, setDepth] = useState(0);
  const [hasInteracted, setHasInteracted] = useState(false);
  const [developerMode, setDeveloperMode] = useState(false);
  const [workspaceShifted, setWorkspaceShifted] = useState(true);
  const [maskIsDragging, setMaskIsDragging] = useState(false);
  const [cameraLock, setCameraLock] = useState<{ x: number; y: number; scale: number } | null>(null);
  const [editingTransition, setEditingTransition] = useState(0);
  const [selectedPoint, setSelectedPoint] = useState(0);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [transitions, setTransitions] = useState(createDefaultTransitions);
  const [manualCamera, setManualCamera] = useState({ x: 0.5, y: 0.5 });
  const manualCameraRef = useRef(manualCamera);
  const [viewport, setViewport] = useState({ width: 1024, height: 768 });
  const [imageCacheRevision, setImageCacheRevision] = useState(0);
  const preloadLevel = Math.floor(depth);
  const canvasWidth = Math.max(viewport.width, viewport.height * ARTWORK_ASPECT_RATIO);
  const canvasHeight = canvasWidth / ARTWORK_ASPECT_RATIO;
  const manualBaseViewScale = calculateCanonicalCameraAtDepth(transitions, depth).viewScale;

  const setWelcomeParallax = useCallback((x: number, y: number) => {
    const scene = welcomeRef.current;
    if (!scene) return;
    scene.style.setProperty("--logo-x", `${x * 15}px`);
    scene.style.setProperty("--logo-y", `${y * 11}px`);
    scene.style.setProperty("--logo-rx", `${y * -1.35}deg`);
    scene.style.setProperty("--logo-ry", `${x * 1.7}deg`);
    scene.style.setProperty("--ambient-x", `${x * -8}px`);
    scene.style.setProperty("--ambient-y", `${y * -6}px`);
    scene.style.setProperty("--halo-x", `${x * -3.6}px`);
    scene.style.setProperty("--halo-y", `${y * -2.6}px`);
  }, []);

  const resetWelcomeParallax = useCallback(
    () => setWelcomeParallax(0, 0),
    [setWelcomeParallax],
  );

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const handleOrientation = (event: DeviceOrientationEvent) => {
      if (event.beta === null || event.gamma === null) return;
      if (!motionOriginRef.current) {
        motionOriginRef.current = { beta: event.beta, gamma: event.gamma };
      }
      const origin = motionOriginRef.current;
      setWelcomeParallax(
        clamp((event.gamma - origin.gamma) / 18, -1, 1),
        clamp((event.beta - origin.beta) / 18, -1, 1),
      );
    };
    const resetMotionOrigin = () => {
      motionOriginRef.current = null;
      resetWelcomeParallax();
    };
    window.addEventListener("deviceorientation", handleOrientation, true);
    window.addEventListener("orientationchange", resetMotionOrigin);
    return () => {
      window.removeEventListener("deviceorientation", handleOrientation, true);
      window.removeEventListener("orientationchange", resetMotionOrigin);
    };
  }, [resetWelcomeParallax, setWelcomeParallax]);

  useEffect(() => {
    let resizeFrame = 0;
    const updateViewport = () => {
      window.cancelAnimationFrame(resizeFrame);
      resizeFrame = window.requestAnimationFrame(() => {
        setViewport({ width: window.innerWidth, height: window.innerHeight });
      });
    };
    updateViewport();
    window.addEventListener("resize", updateViewport);
    window.addEventListener("orientationchange", updateViewport);
    return () => {
      window.cancelAnimationFrame(resizeFrame);
      window.removeEventListener("resize", updateViewport);
      window.removeEventListener("orientationchange", updateViewport);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const uniqueSources = [...new Set(
      ZOOM_SEQUENCE.slice(0, STARTUP_DECODE_LEVELS)
        .map((sceneIndex) => SCENES[sceneIndex].src),
    )];
    uniqueSources.forEach((src) => ACTIVE_IMAGE_SOURCES.add(src));
    Promise.all(uniqueSources.map(loadDecodedScene)).then((images) => {
      if (!cancelled && images.every(Boolean)) {
        setImageCacheRevision((revision) => revision + 1);
        setAssetsReady(true);
      }
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const firstLevel = Math.max(0, preloadLevel - DECODE_BEHIND_LEVELS);
    const lastLevel = Math.min(MAX_DEPTH, preloadLevel + DECODE_AHEAD_LEVELS);
    const desiredSources = new Set(
      ZOOM_SEQUENCE.slice(firstLevel, lastLevel + 1)
        .map((sceneIndex) => SCENES[sceneIndex].src),
    );
    if (experienceMode === "manual") {
      desiredSources.add(SCENES[ZOOM_SEQUENCE[0]].src);
    }
    ACTIVE_IMAGE_SOURCES.clear();
    desiredSources.forEach((src) => ACTIVE_IMAGE_SOURCES.add(src));
    releaseScenesOutside(desiredSources);

    const prioritizedLevels = [
      preloadLevel,
      preloadLevel + 1,
      preloadLevel + 2,
      preloadLevel - 1,
      preloadLevel - 2,
    ].filter((level, index, levels) =>
      level >= firstLevel && level <= lastLevel && levels.indexOf(level) === index,
    );
    const preloadTimer = window.setTimeout(async () => {
      for (const level of prioritizedLevels) {
        if (cancelled) return;
        const src = SCENES[ZOOM_SEQUENCE[level]].src;
        if (DECODED_IMAGE_CACHE.has(src)) continue;
        const decoded = await loadDecodedScene(src);
        if (cancelled) return;
        if (decoded) setImageCacheRevision((revision) => revision + 1);
      }
    }, preloadLevel === 0 ? 280 : 32);
    return () => {
      cancelled = true;
      window.clearTimeout(preloadTimer);
    };
  }, [experienceMode, preloadLevel]);

  useEffect(() => {
    const controller = new AbortController();
    const warmEncodedFiles = async () => {
      for (const scene of SCENES) {
        if (controller.signal.aborted) return;
        try {
          const response = await fetch(scene.src, {
            cache: "force-cache",
            signal: controller.signal,
          });
          if (response.ok) await response.blob();
        } catch {
          if (controller.signal.aborted) return;
        }
      }
    };
    const warmupTimer = window.setTimeout(warmEncodedFiles, 1200);
    return () => {
      window.clearTimeout(warmupTimer);
      controller.abort();
    };
  }, []);

  useEffect(() => () => {
    ACTIVE_IMAGE_SOURCES.clear();
    releaseScenesOutside(ACTIVE_IMAGE_SOURCES);
  }, []);

  useEffect(() => {
    const loadFrame = window.requestAnimationFrame(() => {
      try {
        const saved = window.localStorage.getItem(SETTINGS_KEY);
        if (saved) {
          const parsed = JSON.parse(saved) as TransitionSettings[];
          if (Array.isArray(parsed) && parsed.length === MAX_DEPTH) {
            setTransitions(parsed.map((transition) => ({
              portalX: transition.portalX,
              portalY: transition.portalY,
              portalScale: transition.portalScale,
              imageX: transition.imageX,
              imageY: transition.imageY,
              imageScale: transition.imageScale,
              smoothing: transition.smoothing,
              feather: transition.feather ?? 24,
              points: transition.points,
            })));
          }
        }
      } catch {
        // Invalid local settings fall back to the carefully chosen defaults.
      }
      setSettingsLoaded(true);
    });
    return () => window.cancelAnimationFrame(loadFrame);
  }, []);

  useEffect(() => {
    if (!settingsLoaded || maskIsDragging) return;
    const saveTimer = window.setTimeout(() => {
      window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(transitions));
    }, 450);
    return () => window.clearTimeout(saveTimer);
  }, [maskIsDragging, settingsLoaded, transitions]);

  const commitDepth = useCallback((value: number) => {
    const nextDepth = clamp(value, 0, MAX_DEPTH);
    depthRef.current = nextDepth;
    pendingDepthRef.current = nextDepth;
    if (!depthFrameRef.current) {
      depthFrameRef.current = window.requestAnimationFrame(() => {
        depthFrameRef.current = 0;
        setDepth(pendingDepthRef.current);
      });
    }
  }, []);

  useEffect(() => () => window.cancelAnimationFrame(depthFrameRef.current), []);

  const updateTransition = (patch: Partial<TransitionSettings>) => {
    setTransitions((current) => current.map((transition, index) =>
      index === editingTransition ? { ...transition, ...patch } : transition,
    ));
  };

  const moveMaskPoint = (index: number, point: MaskPoint) => {
    const transition = transitions[editingTransition];
    updateTransition({
      points: transition.points.map((currentPoint, pointIndex) =>
        pointIndex === index ? point : currentPoint,
      ),
    });
  };

  const frameTransition = useCallback((index: number) => {
    setEditingTransition(index);
    setSelectedPoint(0);
    commitDepth(Math.min(index + 0.45, MAX_DEPTH));
  }, [commitDepth]);

  const setManualCameraPosition = useCallback((x: number, y: number, viewScale = manualBaseViewScale) => {
    const safeScale = Math.max(viewScale, 0.001);
    const horizontalReach = clamp(viewport.width / (2 * canvasWidth * safeScale), 0, 0.5);
    const verticalReach = clamp(viewport.height / (2 * canvasHeight * safeScale), 0, 0.5);
    const nextCamera = {
      x: clamp(x, horizontalReach, 1 - horizontalReach),
      y: clamp(y, verticalReach, 1 - verticalReach),
    };
    manualCameraRef.current = nextCamera;
    setManualCamera(nextCamera);
  }, [canvasHeight, canvasWidth, manualBaseViewScale, viewport]);

  const resetManualCamera = useCallback(() => {
    setManualCameraPosition(0.5, 0.5, 1);
  }, [setManualCameraPosition]);

  const selectExperienceMode = (mode: ExperienceMode) => {
    setExperienceMode(mode);
    resetManualCamera();
  };

  const startExperience = () => {
    if (!assetsReady) return;
    resetManualCamera();
    setStarted(true);
    setHasInteracted(false);
    window.requestAnimationFrame(() => zoomRef.current?.focus());
  };

  const restartExperience = () => {
    depthRef.current = 0;
    pendingDepthRef.current = 0;
    window.cancelAnimationFrame(depthFrameRef.current);
    depthFrameRef.current = 0;
    pointersRef.current.clear();
    gestureOriginRef.current = null;
    panOriginRef.current = null;
    resetManualCamera();
    setDepth(0);
    setHasInteracted(false);
    setDeveloperMode(false);
    setMaskIsDragging(false);
    setCameraLock(null);
    setStarted(false);
  };

  const handleWelcomePointerMove = (event: PointerEvent<HTMLElement>) => {
    if (event.pointerType === "touch") return;
    const bounds = event.currentTarget.getBoundingClientRect();
    setWelcomeParallax(
      clamp(((event.clientX - bounds.left) / bounds.width - 0.5) * 2, -1, 1),
      clamp(((event.clientY - bounds.top) / bounds.height - 0.5) * 2, -1, 1),
    );
  };

  const handleZoomPointerDown = (event: PointerEvent<HTMLElement>) => {
    if ((event.target as HTMLElement).closest("button, input, select, .mask-editor-overlay, .developer-panel")) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (experienceMode === "manual" && pointersRef.current.size === 1) {
      panOriginRef.current = {
        x: event.clientX,
        y: event.clientY,
        cameraX: manualCameraRef.current.x,
        cameraY: manualCameraRef.current.y,
      };
      setHasInteracted(true);
    }
    if (pointersRef.current.size === 2) {
      const positions = Array.from(pointersRef.current.values()).slice(0, 2);
      const focus = {
        x: (positions[0].x + positions[1].x) / 2,
        y: (positions[0].y + positions[1].y) / 2,
      };
      gestureOriginRef.current = {
        distance: Math.max(distanceBetween(positions), 1),
        depth: depthRef.current,
        cameraX: manualCameraRef.current.x,
        cameraY: manualCameraRef.current.y,
        viewScale: manualBaseViewScale,
        focusX: focus.x,
        focusY: focus.y,
      };
      panOriginRef.current = null;
      setHasInteracted(true);
    }
  };

  const handleZoomPointerMove = (event: PointerEvent<HTMLElement>) => {
    if (!pointersRef.current.has(event.pointerId)) return;
    event.preventDefault();
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointersRef.current.size < 2) {
      if (experienceMode !== "manual" || !panOriginRef.current) return;
      const parentScreenScale = Math.max(manualBaseViewScale, 0.001);
      setManualCameraPosition(
        panOriginRef.current.cameraX - (event.clientX - panOriginRef.current.x) / (canvasWidth * parentScreenScale),
        panOriginRef.current.cameraY - (event.clientY - panOriginRef.current.y) / (canvasHeight * parentScreenScale),
        parentScreenScale,
      );
      return;
    }
    if (!gestureOriginRef.current) return;
    const positions = Array.from(pointersRef.current.values()).slice(0, 2);
    const distance = Math.max(distanceBetween(positions), 1);
    const scaleDelta = Math.log2(distance / gestureOriginRef.current.distance);
    const nextDepth = clamp(gestureOriginRef.current.depth + scaleDelta * 0.9, 0, MAX_DEPTH);
    if (experienceMode === "manual") {
      const focus = {
        x: (positions[0].x + positions[1].x) / 2,
        y: (positions[0].y + positions[1].y) / 2,
      };
      const nextViewScale = calculateCanonicalCameraAtDepth(transitions, nextDepth).viewScale;
      const focusX = (gestureOriginRef.current.focusX - viewport.width / 2) / canvasWidth;
      const focusY = (gestureOriginRef.current.focusY - viewport.height / 2) / canvasHeight;
      const nextFocusX = (focus.x - viewport.width / 2) / canvasWidth;
      const nextFocusY = (focus.y - viewport.height / 2) / canvasHeight;
      setManualCameraPosition(
        gestureOriginRef.current.cameraX + focusX / gestureOriginRef.current.viewScale - nextFocusX / nextViewScale,
        gestureOriginRef.current.cameraY + focusY / gestureOriginRef.current.viewScale - nextFocusY / nextViewScale,
        nextViewScale,
      );
    }
    commitDepth(nextDepth);
  };

  const handleZoomPointerEnd = (event: PointerEvent<HTMLElement>) => {
    pointersRef.current.delete(event.pointerId);
    gestureOriginRef.current = null;
    if (pointersRef.current.size === 0) panOriginRef.current = null;
  };

  const handleWheel = (event: WheelEvent<HTMLElement>) => {
    event.preventDefault();
    setHasInteracted(true);
    const nextDepth = clamp(depthRef.current - event.deltaY * 0.0018, 0, MAX_DEPTH);
    if (experienceMode === "manual") {
      const currentViewScale = manualBaseViewScale;
      const nextViewScale = calculateCanonicalCameraAtDepth(transitions, nextDepth).viewScale;
      const focusX = (event.clientX - viewport.width / 2) / canvasWidth;
      const focusY = (event.clientY - viewport.height / 2) / canvasHeight;
      setManualCameraPosition(
        manualCameraRef.current.x + focusX / currentViewScale - focusX / nextViewScale,
        manualCameraRef.current.y + focusY / currentViewScale - focusY / nextViewScale,
        nextViewScale,
      );
    }
    commitDepth(nextDepth);
  };

  const handleZoomKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (experienceMode === "manual" && ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) {
      event.preventDefault();
      setHasInteracted(true);
      const step = 0.08 / Math.max(manualBaseViewScale, 0.001);
      const horizontal = event.key === "ArrowLeft" ? -step : event.key === "ArrowRight" ? step : 0;
      const vertical = event.key === "ArrowUp" ? -step : event.key === "ArrowDown" ? step : 0;
      setManualCameraPosition(manualCameraRef.current.x + horizontal, manualCameraRef.current.y + vertical, manualBaseViewScale);
      return;
    }
    if (["+", "=", "ArrowUp"].includes(event.key)) {
      event.preventDefault();
      setHasInteracted(true);
      commitDepth(depthRef.current + 0.1);
    }
    if (["-", "_", "ArrowDown"].includes(event.key)) {
      event.preventDefault();
      setHasInteracted(true);
      commitDepth(depthRef.current - 0.1);
    }
  };

  const level = Math.min(Math.floor(depth), MAX_DEPTH);
  // Keep one completed transition behind the camera until its hard mask edge
  // is outside the viewport, while resetting here avoids huge GPU transforms.
  const anchorLevel = Math.max(
    0,
    Math.floor(Math.max(0, depth - REBASE_DELAY)) - 1,
  );
  const nextLevel = Math.min(level + 1, MAX_DEPTH);
  const levelProgress = nextLevel === level ? 0 : depth - level;
  const activeCamera = calculateCameraForAnchor(
    transitions,
    anchorLevel,
    level,
    nextLevel,
    levelProgress,
  );
  const warmAnchorLevel =
    depth >= anchorLevel + 2 + REBASE_DELAY - PREWARM_LEAD &&
    anchorLevel < MAX_DEPTH - 1
      ? anchorLevel + 1
      : null;
  const rebaseBlendStart = anchorLevel + 1 + REBASE_DELAY;
  const rebaseBlend = anchorLevel === 0
    ? 1
    : clamp((depth - rebaseBlendStart) / REBASE_BLEND_DEPTH, 0, 1);
  const previousAnchorLevel = anchorLevel > 0 && rebaseBlend < 1
    ? anchorLevel - 1
    : null;
  const bufferAnchors = [anchorLevel];
  if (previousAnchorLevel !== null) bufferAnchors.unshift(previousAnchorLevel);
  if (warmAnchorLevel !== null && !bufferAnchors.includes(warmAnchorLevel)) {
    bufferAnchors.push(warmAnchorLevel);
  }
  const canvasRenderBuffers = bufferAnchors.map((bufferAnchor) => {
    const isActiveBuffer = bufferAnchor === anchorLevel;
    const isPreviousBuffer = bufferAnchor === previousAnchorLevel;
    const opacity = isPreviousBuffer
      ? 1 - rebaseBlend
      : isActiveBuffer
        ? previousAnchorLevel === null ? 1 : rebaseBlend
        : 0.001;
    return { anchorLevel: bufferAnchor, opacity };
  });
  const manualFramePlacement = activeCamera.placements[0] ?? { centerX: 0.5, centerY: 0.5, scale: 1 };
  const manualFrameScale = Math.max(manualFramePlacement.scale, 0.000001);
  const manualLocalCameraX =
    manualFramePlacement.centerX + manualFrameScale * (manualCamera.x - 0.5);
  const manualLocalCameraY =
    manualFramePlacement.centerY + manualFrameScale * (manualCamera.y - 0.5);
  const manualLocalViewScale = manualBaseViewScale / manualFrameScale;
  const cameraX = experienceMode === "manual" ? manualLocalCameraX : activeCamera.cameraX;
  const cameraY = experienceMode === "manual" ? manualLocalCameraY : activeCamera.cameraY;
  const calculatedViewScale = experienceMode === "manual"
    ? manualLocalViewScale
    : activeCamera.viewScale;
  const displayCameraX = maskIsDragging && cameraLock
    ? cameraLock.x
    : cameraX;
  const displayCameraY = maskIsDragging && cameraLock
    ? cameraLock.y
    : cameraY;
  const viewScale = maskIsDragging && cameraLock
    ? cameraLock.scale
    : calculatedViewScale;
  const manualBaseImageStyle: CSSProperties = {
    width: canvasWidth,
    height: canvasHeight,
    transform: `translate3d(calc(-50% + ${(0.5 - manualCamera.x) * canvasWidth * manualBaseViewScale}px), calc(-50% + ${(0.5 - manualCamera.y) * canvasHeight * manualBaseViewScale}px), 0) scale(${manualBaseViewScale})`,
  };
  const panelWidth = Math.min(360, viewport.width * 0.42);
  const editorOffsetX = developerMode && workspaceShifted && viewport.width >= 680
    ? -(panelWidth / 2 + 12)
    : 0;
  const canvasStyle: CSSProperties = { width: canvasWidth, height: canvasHeight };
  const activeTransition = transitions[editingTransition];
  const editingPlacement =
    activeCamera.placements[editingTransition] ?? activeCamera.currentPlacement;
  const activePortalScreenScale =
    viewScale * editingPlacement.scale * (activeTransition.portalScale / 100);
  const editorHandleScale = 1 / Math.max(activePortalScreenScale, 0.001);
  const handleMaskDragChange = (dragging: boolean) => {
    if (dragging) {
      setCameraLock({ x: cameraX, y: cameraY, scale: calculatedViewScale });
    } else {
      setCameraLock(null);
    }
    setMaskIsDragging(dragging);
  };
  const movePortalByPixels = (deltaX: number, deltaY: number) => {
    const parentScreenScale = viewScale * editingPlacement.scale;
    const horizontalDelta = deltaX / (canvasWidth * parentScreenScale) * 100;
    const verticalDelta = deltaY / (canvasHeight * parentScreenScale) * 100;
    setTransitions((current) => current.map((transition, index) =>
      index === editingTransition
        ? {
            ...transition,
            portalX: clamp(transition.portalX + horizontalDelta, 1, 99),
            portalY: clamp(transition.portalY + verticalDelta, 1, 99),
          }
        : transition,
    ));
  };
  const createWorldStyle = (bufferAnchor: number): CSSProperties => {
    const isActiveBuffer = bufferAnchor === anchorLevel;
    const camera = isActiveBuffer
      ? activeCamera
      : calculateCameraForAnchor(
          transitions,
          bufferAnchor,
          level,
          nextLevel,
          levelProgress,
        );
    const bufferCameraX = isActiveBuffer ? displayCameraX : camera.cameraX;
    const bufferCameraY = isActiveBuffer ? displayCameraY : camera.cameraY;
    const bufferViewScale = isActiveBuffer ? viewScale : camera.viewScale;
    return {
      transform: `translate3d(${(0.5 - bufferCameraX) * canvasWidth * bufferViewScale + editorOffsetX}px, ${(0.5 - bufferCameraY) * canvasHeight * bufferViewScale}px, 0) scale(${bufferViewScale})`,
    };
  };

  return (
    <>
      {!started ? (
        <main ref={welcomeRef} className="welcome-screen"
          onPointerMove={handleWelcomePointerMove} onPointerLeave={resetWelcomeParallax}>
          <div className="ambient-orb ambient-orb--top" aria-hidden="true" />
          <div className="ambient-orb ambient-orb--bottom" aria-hidden="true" />
          <section className="welcome-content" aria-label="Bienvenida a TGS">
            <div className="logo-float"><div className="logo-scene">
              <div className="logo-halo" aria-hidden="true" />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="brand-logo" src={publicAsset("/brand/tgs-logo-color.svg")} alt="TGS"
                width="500" height="185" draggable="false" />
            </div></div>
            <div className="experience-choice" role="group" aria-label="Elegir experiencia">
              <button className={`experience-choice__option${experienceMode === "manual" ? " experience-choice__option--selected" : ""}`}
                type="button" onClick={() => selectExperienceMode("manual")}
                aria-pressed={experienceMode === "manual"}>
                <span className="experience-choice__icon" aria-hidden="true">✦</span>
                <span><strong>Zoom libre</strong><small>Elegí la dirección con el cursor o tus dedos</small></span>
              </button>
              <button className={`experience-choice__option${experienceMode === "guided" ? " experience-choice__option--selected" : ""}`}
                type="button" onClick={() => selectExperienceMode("guided")}
                aria-pressed={experienceMode === "guided"}>
                <span className="experience-choice__icon" aria-hidden="true">◌</span>
                <span><strong>Zoom guiado</strong><small>Recorré la secuencia visual automática</small></span>
              </button>
            </div>
            <button className="start-button" type="button" onClick={startExperience}
              disabled={!assetsReady} aria-busy={!assetsReady}>
              <span>{assetsReady ? "Comenzar" : "Preparando…"}</span>
              <span className="start-button__arrow" aria-hidden="true">→</span>
            </button>
          </section>
          <div className="bottom-glow" aria-hidden="true" />
        </main>
      ) : null}

      <div ref={zoomRef}
        className={`zoom-experience${started ? " zoom-experience--active" : ""}${developerMode ? " zoom-experience--developer" : ""}${experienceMode === "manual" ? " zoom-experience--manual" : ""}`}
        role="slider" aria-label={experienceMode === "manual" ? "Experiencia de zoom libre" : "Experiencia de zoom guiado"} aria-valuemin={0}
        aria-valuemax={MAX_DEPTH * 100} aria-valuenow={Math.round(depth * 100)}
        aria-hidden={!started} tabIndex={started ? 0 : -1}
        onPointerDown={handleZoomPointerDown} onPointerMove={handleZoomPointerMove}
        onPointerUp={handleZoomPointerEnd} onPointerCancel={handleZoomPointerEnd}
        onWheel={handleWheel} onKeyDown={handleZoomKeyDown}>
        {experienceMode === "manual" ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img className="manual-base-image" src={SCENES[0].src} alt="" aria-hidden="true"
            draggable="false" style={manualBaseImageStyle} />
        ) : null}
        <CanvasZoomRenderer
          depth={depth}
          transitions={transitions}
          viewport={viewport}
          hidden={developerMode}
          cacheRevision={imageCacheRevision}
          cameraOverride={experienceMode === "manual"
            ? { x: manualCamera.x, y: manualCamera.y, viewScale: manualBaseViewScale }
            : undefined}
          renderBuffers={experienceMode === "manual"
            ? [{ anchorLevel, opacity: 1 }]
            : canvasRenderBuffers}
        />
        {developerMode ? bufferAnchors.map((bufferAnchor) => {
          const isActiveBuffer = bufferAnchor === anchorLevel;
          const isPreviousBuffer = bufferAnchor === previousAnchorLevel;
          const bufferOpacity = isPreviousBuffer
            ? 1 - rebaseBlend
            : isActiveBuffer
              ? previousAnchorLevel === null ? 1 : rebaseBlend
              : 0.001;
          return (
            <div
              key={bufferAnchor}
              className={`zoom-world ${isActiveBuffer ? "zoom-world--active" : "zoom-world--warm"}`}
              style={{
                ...createWorldStyle(bufferAnchor),
                opacity: bufferOpacity,
                zIndex: isActiveBuffer ? 3 : isPreviousBuffer ? 2 : 1,
              }}
              aria-hidden={!isActiveBuffer}
            >
              <div className="zoom-canvas" style={canvasStyle}>
                <ZoomLayer level={bufferAnchor} transitions={transitions}
                  editingTransition={isActiveBuffer && developerMode ? editingTransition : null}
                  selectedPoint={selectedPoint} onSelectPoint={setSelectedPoint}
                  onMovePoint={moveMaskPoint} editorHandleScale={editorHandleScale}
                  depth={depth} maskIsDragging={isActiveBuffer && maskIsDragging}
                  onMaskDragChange={handleMaskDragChange}
                  onMovePortal={movePortalByPixels} />
              </div>
            </div>
          );
        }) : null}
        <div className="zoom-vignette" aria-hidden="true" />
        <header className="zoom-header">
          <div className="zoom-brand" aria-label="TGS">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={publicAsset("/brand/tgs-logo-color.svg")} alt="TGS" draggable="false" />
          </div>
          <div className="zoom-header__actions">
            <button className="developer-button" type="button"
              onClick={() => {
                if (!developerMode) frameTransition(editingTransition);
                setDeveloperMode(!developerMode);
              }}>
              {developerMode ? "Modo usuario" : "Ajustar máscaras"}
            </button>
            <button className="restart-button" type="button" onClick={restartExperience}>Reiniciar</button>
          </div>
        </header>

        {developerMode ? (
          <aside className="developer-panel" aria-label="Editor de máscaras"
            onWheel={(event) => event.stopPropagation()}>
            <div className="developer-panel__heading">
              <div><span className="developer-kicker">Modo desarrollador</span><h2>Unión {editingTransition + 1}</h2></div>
              <span className="saved-badge">Guardado local</span>
            </div>
            <div className="editor-workspace-actions">
              <span>Demo: {ZOOM_SEQUENCE.length} de hasta {MAX_SUPPORTED_IMAGES} imágenes 4K</span>
              <button type="button" onClick={() => setWorkspaceShifted(!workspaceShifted)}>
                {workspaceShifted ? "Centrar visual" : "Vista a la izquierda"}
              </button>
            </div>
            <label className="editor-select">
              <span>Unión a editar</span>
              <select value={editingTransition}
                onChange={(event) => frameTransition(Number(event.target.value))}>
                {transitions.map((_transition, index) =>
                  <option key={index} value={index}>Imagen {index + 1} → {index + 2}</option>)}
              </select>
            </label>

            <section className="editor-section">
              <div className="editor-section__title"><h3>Forma de la máscara</h3><span>{activeTransition.points.length} puntos</span></div>
              <p>Arrastrá los puntos para dibujar el contorno. El control central mueve la máscara completa y define hacia dónde apunta el zoom.</p>
              <div className="mask-presets" aria-label="Formas iniciales">
                {(Object.keys(MASK_PRESETS) as Array<keyof typeof MASK_PRESETS>).map((presetKey) => {
                  const labels = { circle: "Círculo", square: "Cuadrado", triangle: "Triángulo" };
                  return (
                    <button key={presetKey} type="button" onClick={() => {
                      const preset = MASK_PRESETS[presetKey];
                      updateTransition({
                        points: clonePoints([...preset.points]),
                        smoothing: preset.smoothing,
                      });
                      setSelectedPoint(0);
                    }}>{labels[presetKey]}</button>
                  );
                })}
              </div>
              <div className="point-actions">
                <button type="button" onClick={() => {
                  const points = activeTransition.points;
                  const nextIndex = (selectedPoint + 1) % points.length;
                  const point = points[selectedPoint];
                  const nextPoint = points[nextIndex];
                  const newPoints = [...points];
                  newPoints.splice(selectedPoint + 1, 0, {
                    x: (point.x + nextPoint.x) / 2, y: (point.y + nextPoint.y) / 2,
                  });
                  updateTransition({ points: newPoints });
                  setSelectedPoint(selectedPoint + 1);
                }}>+ Agregar punto</button>
                <button type="button" disabled={activeTransition.points.length <= 3}
                  onClick={() => {
                    const points = activeTransition.points.filter((_point, index) => index !== selectedPoint);
                    updateTransition({ points });
                    setSelectedPoint(Math.max(0, Math.min(selectedPoint - 1, points.length - 1)));
                  }}>Quitar</button>
              </div>
              <EditorRange label="Suavizado spline" value={activeTransition.smoothing}
                min={0} max={1} step={0.01} onChange={(smoothing) => updateTransition({ smoothing })} />
              <EditorRange label="Feather" value={activeTransition.feather}
                min={0} max={80} step={1} onChange={(feather) => updateTransition({ feather })} />
            </section>

            <section className="editor-section">
              <div className="editor-section__title"><h3>Imagen insertada</h3></div>
              <EditorRange label="Posición horizontal" value={activeTransition.imageX}
                min={-50} max={50} step={1} suffix="%" onChange={(imageX) => updateTransition({ imageX })} />
              <EditorRange label="Posición vertical" value={activeTransition.imageY}
                min={-50} max={50} step={1} suffix="%" onChange={(imageY) => updateTransition({ imageY })} />
              <EditorRange label="Escala" value={activeTransition.imageScale}
                min={0.5} max={2} step={0.01} suffix="×" onChange={(imageScale) => updateTransition({ imageScale })} />
            </section>

            <details className="editor-advanced">
              <summary>Posición de la entrada</summary>
              <EditorRange label="Entrada horizontal" value={activeTransition.portalX}
                min={10} max={90} step={0.5} suffix="%" onChange={(portalX) => updateTransition({ portalX })} />
              <EditorRange label="Entrada vertical" value={activeTransition.portalY}
                min={10} max={90} step={0.5} suffix="%" onChange={(portalY) => updateTransition({ portalY })} />
              <EditorRange label="Tamaño inicial" value={activeTransition.portalScale}
                min={2} max={35} step={0.5} suffix="%" onChange={(portalScale) => updateTransition({ portalScale })} />
            </details>

            <div className="developer-panel__footer">
              <button type="button" onClick={() => frameTransition(editingTransition)}>Encuadrar unión</button>
              <button type="button" className="reset-settings" onClick={() => {
                const defaults = createDefaultTransitions();
                setTransitions((current) => current.map((transition, index) =>
                  index === editingTransition ? defaults[index] : transition,
                ));
                setSelectedPoint(0);
              }}>Restablecer</button>
            </div>
          </aside>
        ) : null}

        {!developerMode ? (
          <>
            <div className={`zoom-hint${hasInteracted ? " zoom-hint--hidden" : ""}`}>
              <div className="pinch-symbol" aria-hidden="true"><span /><span /></div>
              <p className="touch-instruction">{experienceMode === "manual" ? "Pellizcá y arrastrá para elegir la dirección" : "Separá dos dedos para entrar"}</p>
              <p className="desktop-instruction">{experienceMode === "manual" ? "Usá la rueda para acercarte y arrastrá para explorar" : "Usá la rueda o el trackpad para acercarte"}</p>
            </div>
            <div className={`focus-guide${hasInteracted ? " focus-guide--hidden" : ""}`}
              aria-hidden="true"><span /></div>
          </>
        ) : null}
      </div>
    </>
  );
}
