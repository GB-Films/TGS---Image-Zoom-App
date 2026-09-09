import sharp from "sharp";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";

// Deliberate top-biased crops preserve headings and signs in the supplied art.
const scenes = [
  ["1- Oficina v2.png", "tgs-01-oficina.webp", 20],
  ["2- Operario mirando cartelera.png", "tgs-02-operario-cartelera.webp", 30],
  ["3- Bolsa de NY.png", "tgs-03-bolsa-ny.webp", 30],
  ["4- Gasoducto.png", "tgs-04-gasoducto.webp", 36],
  ["5- Planta Cerri.png", "tgs-05-planta-cerri.webp", 30],
  ["6- Antena.png", "tgs-06-antena.webp", 30],
  ["7- Mas Plantas.png", "tgs-07-mas-plantas.webp", 0],
  ["8- Gasoducto Submarino.png", "tgs-08-gasoducto-submarino.webp", 0],
];

const sourceDir = process.argv[2];
if (!sourceDir) throw new Error('Usage: npm run images:prepare -- "SOURCE_DIRECTORY"');
const repo = fileURLToPath(new URL("../", import.meta.url));
const outputDir = join(repo, "public/scenes");
const reportDir = join(repo, "outputs/scenes");
await mkdir(outputDir, { recursive: true });
await mkdir(reportDir, { recursive: true });
sharp.concurrency(2);
const report = [];
const previews = [];
for (const [input, output, cropTop] of scenes) {
  const source = await readFile(resolve(sourceDir, input));
  const metadata = await sharp(source).metadata();
  const width = metadata.width;
  const height = Math.floor(width * 9 / 16);
  if (height > metadata.height || cropTop + height > metadata.height) {
    throw new Error(`Invalid crop for ${input}: ${width}x${metadata.height}`);
  }
  const crop = { left: 0, top: cropTop, width, height };
  const info = await sharp(source)
    .flatten({ background: "#ffffff" })
    .extract(crop)
    .resize(3840, 2160, { fit: "fill", kernel: sharp.kernel.lanczos3 })
    .sharpen({ sigma: 0.5 })
    .webp({ quality: 88, effort: 6, smartSubsample: true })
    .toFile(join(outputDir, output));
  report.push({ input, output, sourceWidth: width, sourceHeight: metadata.height,
    sourceBytes: source.length, crop, width: info.width, height: info.height, bytes: info.size });
  const thumb = await sharp(join(outputDir, output)).resize(640, 360).png().toBuffer();
  const index = previews.length;
  previews.push({ input: thumb, left: (index % 2) * 640, top: Math.floor(index / 2) * 360 });
  console.log(`${output}: ${info.width}x${info.height}, ${(info.size / 1024).toFixed(0)} KiB`);
}
await sharp({ create: { width: 1280, height: 1440, channels: 3, background: "white" } })
  .composite(previews).png().toFile(join(reportDir, "contact-sheet.png"));
await writeFile(join(reportDir, "report.json"), JSON.stringify(report, null, 2) + "\n");
console.log(`Total WebP: ${(report.reduce((sum, scene) => sum + scene.bytes, 0) / 1048576).toFixed(2)} MiB`);
