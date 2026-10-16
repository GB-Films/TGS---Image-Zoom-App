import scenes from "./ride-scenes.json";
import { stopPosition, stopSide } from "./ride-sequence.mjs";

const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export const RIDE_STOPS = scenes.map((scene, index) => ({
  ...scene,
  src: `${base}${scene.src}`,
  preview: `${base}${scene.preview}`,
  u: stopPosition(index, scenes.length),
  side: stopSide(index),
}));
