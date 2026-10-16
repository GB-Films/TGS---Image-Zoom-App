import * as THREE from "three";
import { rideTextureWindow } from "./ride-loading.mjs";

type Source = { src: string; preview: string };

/** All previews stay small; only the current and two neighboring textures stay large. */
export async function createRideTextures(stops: Source[], anisotropy: number, onChange: (index: number, texture: THREE.Texture) => void) {
  const previews = new Map<number, THREE.Texture>();
  const full = new Map<number, THREE.Texture>();
  const pending = new Map<number, Promise<void>>();
  let desired = new Set<number>();
  let disposed = false;
  const loader = new THREE.TextureLoader();
  const configure = (texture: THREE.Texture) => {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = anisotropy;
    return texture;
  };
  let next = 0;
  // Bound image decoding rather than starting 27 large decodes at once.
  try {
    await Promise.all(Array.from({ length: 3 }, async () => {
      while (!disposed && next < stops.length) {
        const index = next++;
        const texture = configure(await loader.loadAsync(stops[index].preview));
        if (disposed) { texture.dispose(); return; }
        previews.set(index, texture);
      }
    }));
  } catch (error) {
    disposed = true;
    for (const texture of previews.values()) texture.dispose();
    throw error;
  }
  let inFlight = 0;
  const waiters: Array<() => void> = [];
  async function promote(index: number) {
    if (full.has(index)) return;
    const existing = pending.get(index);
    if (existing) return existing;
    const task = (async () => {
      if (inFlight >= 2) await new Promise<void>(resolve => waiters.push(resolve));
      inFlight++;
      try {
        if (disposed || !desired.has(index)) return;
        const texture = configure(await loader.loadAsync(stops[index].src));
        if (disposed || !desired.has(index)) { texture.dispose(); return; }
        full.set(index, texture);
        onChange(index, texture);
      } catch {
        // The already-loaded opaque preview stays visible if a promotion fails.
      } finally {
        inFlight--;
        waiters.shift()?.();
        pending.delete(index);
      }
    })();
    pending.set(index, task);
    return task;
  }
  return {
    preview(index: number) { return previews.get(index)!; },
    async warm(index: number) {
      if (disposed) return;
      desired = new Set(rideTextureWindow(index, stops.length));
      for (const [key, texture] of full) {
        if (!desired.has(key)) {
          onChange(key, previews.get(key)!);
          full.delete(key); texture.dispose();
        }
      }
      await Promise.all([...desired].map(promote));
    },
    dispose() {
      disposed = true;
      for (const texture of [...previews.values(), ...full.values()]) texture.dispose();
      previews.clear(); full.clear(); desired.clear();
    },
  };
}
