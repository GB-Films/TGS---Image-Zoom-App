// Composition proof only: production assets remain unchanged.
import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { buildClosedPath } from "../app/mask-geometry.mjs";

const root = process.cwd();
const presets = JSON.parse(await readFile(path.join(root, "app/transition-presets.json"), "utf8"));
const page = await readFile(path.join(root, "app/page.tsx"), "utf8");
const sources = [...page.matchAll(/src: publicAsset\("(\/scenes\/tgs-[^"]+)"\)/g)]
  .map((match) => path.join(root, "public", match[1]));
const output = path.join(root, "outputs/masks");
await mkdir(output, { recursive: true });


const tiles = [];
for (const [index, preset] of presets.entries()) {
  const width = Math.round(3840 * preset.portalScale / 100);
  const height = Math.round(2160 * preset.portalScale / 100);
  const left = Math.round(3840 * preset.portalX / 100 - width / 2);
  const top = Math.round(2160 * preset.portalY / 100 - height / 2);
  const mask = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 1000 1000" preserveAspectRatio="none"><defs><filter id="f" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="${preset.feather}"/></filter></defs><path d="${buildClosedPath(preset.points, preset.smoothing)}" fill="white" filter="url(#f)"/></svg>`);
  const imageWidth = Math.max(1, Math.round(width * preset.imageScale));
  const imageHeight = Math.max(1, Math.round(height * preset.imageScale));
  const fitted = await sharp(sources[index + 1]).resize(imageWidth, imageHeight).png().toBuffer();
  const child = await sharp({ create: { width, height, channels: 4, background: preset.matte ?? "#ffffff" } })
    .composite([{ input: fitted,
      left: Math.round(width * (0.5 + preset.imageX / 100) - imageWidth / 2),
      top: Math.round(height * (0.5 + preset.imageY / 100) - imageHeight / 2) }]).png().toBuffer();
  const maskedChild = await sharp(child).composite([{ input: mask, blend: "dest-in" }]).png().toBuffer();
  const composite = await sharp(sources[index]).composite([{ input: maskedChild, left, top }]).png().toBuffer();
  const cropWidth = Math.min(3840, Math.max(900, width * 2));
  const cropHeight = Math.round(cropWidth * 9 / 16);
  const cropLeft = Math.max(0, Math.min(3840 - cropWidth, Math.round(left + width / 2 - cropWidth / 2)));
  const cropTop = Math.max(0, Math.min(2160 - cropHeight, Math.round(top + height / 2 - cropHeight / 2)));
  await sharp(sources[index]).extract({ left: cropLeft, top: cropTop, width: cropWidth, height: cropHeight })
    .resize(640, 360).png().toFile(path.join(output, `original-${index + 1}.png`));
  const detail = await sharp(composite).extract({ left: cropLeft, top: cropTop, width: cropWidth, height: cropHeight })
    .resize(640, 360).png().toBuffer();
  await sharp(detail).toFile(path.join(output, `union-${index + 1}.png`));
  const title = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="640" height="40"><rect width="640" height="40" fill="#eef4f8"/><text x="16" y="26" fill="#163b55" font-family="Arial" font-size="16">${index + 1} → ${index + 2} · ${preset.name}</text></svg>`);
  tiles.push({ input: title, left: index % 2 * 640, top: Math.floor(index / 2) * 400 });
  tiles.push({ input: detail, left: index % 2 * 640, top: Math.floor(index / 2) * 400 + 40 });
}
await sharp({ create: { width: 1280, height: 1600, channels: 3, background: "#eef4f8" } })
  .composite(tiles).png().toFile(path.join(output, "mask-proof.png"));
console.log("Saved composition details to outputs/masks/mask-proof.png (not a runtime screenshot).");
