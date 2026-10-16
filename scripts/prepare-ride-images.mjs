import sharp from "sharp";
import { access, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

// Separate, opaque exports for the ride. Never replaces the zoom's transparent art.
const root = process.argv[2];
if (!root) throw new Error('Usage: node scripts/prepare-ride-images.mjs "Trabajo de Imagenes"');
const order = join(root, "Orden Final");
const corrected = join(root, "Correcciones PowerPoint - 2026-10-01", "Generadas para revision");
const masters = join(root, "Maestros 4K");
const corrections = new Set(await readdir(corrected));
const masterNames = new Set(await readdir(masters));
const files = (await readdir(order)).filter(name => /^\d{2} - .+\.(png|jpe?g)$/i.test(name)).sort();
if (files.length !== 26 || files.some((name, index) => Number(name.slice(0, 2)) !== index + 1)) throw new Error("Se esperaba la secuencia completa 01–26");

const descriptions = [
  ["Inicio", "Una historia que avanza", "Subite al recorrido de TGS."],
  ["1992–2026", "Tenemos una historia que contarte", "Una parte de nuestros años al servicio de la energía argentina."],
  ["1992", "Nace TGS", "28 de diciembre de 1992 · El comienzo de nuestra historia."],
  ["1993–1994", "Las primeras plantas", "Olavarría, Saturno, Ordoqui, Adela y Cervantes."],
  ["1994", "Comenzamos a cotizar en NYSE", "17 de noviembre de 1994 · TGS llega a la Bolsa de Nueva York."],
  ["1998", "Expansión de la red de gasoductos", "Expansión de la red de ductos y construcción de plantas."],
  ["1998", "Tren C del Complejo General Cerri", "24 de noviembre de 1998 · Inauguración del Tren C."],
  ["1998", "Nace Telcosur", "30 de septiembre de 1998 · Nace Telcosur S.A."],
  ["2005–2019", "Más plantas, más desarrollo", "Expansión de las plantas compresoras: Magallanes, Río Seco, Moy Aike, Buchanan y Confluencia."],
  ["2010", "Loop submarino Magallanes", "15 de marzo de 2010 · Inauguración del loop del gasoducto submarino Magallanes."],
  ["Trayectoria", "Servicios a terceros", "Nuestra experiencia al servicio de clientes a lo largo de todo el país."],
  ["2017", "Llegamos a Vaca Muerta", "Comienza la construcción de Planta Tratayén y del gasoducto de captación."],
  ["2019", "Presentación de la nueva marca TGS", "Abril de 2019 · Presentación de la nueva marca."],
  ["2019", "Tratayén y los gasoductos de captación", "21 de diciembre de 2019 · Inauguración de Planta Tratayén y del sistema Vaca Muerta Norte y Sur."],
  ["2020", "Nuevo taller de Turbomáquinas", "Diciembre de 2020 · Inauguración del nuevo taller."],
  ["2023", "Operación del Gasoducto Perito Moreno", "Junio de 2023 · Adjudicación para operar y mantener el gasoducto."],
  ["2024", "30 años de TGS en NYSE", "Toque de campana en Nueva York: 30 años cotizando en NYSE."],
  ["2025", "Licencia extendida hasta 2047", "Julio de 2025 · Extensión de la licencia por 20 años más."],
  ["2025", "Ampliación final de Planta Tratayén", "Inauguración del último módulo de acondicionamiento: capacidad total de 28 MMm³/día."],
  ["2025", "Ampliación del Gasoducto Perito Moreno", "20 de octubre de 2025 · Adjudicación de ENARSA para las obras de ampliación."],
  ["2026", "Comienzan las obras de ampliación", "Enero de 2026 · Inicio de obras en el Gasoducto Perito Moreno."],
  ["2026", "Anuncio del Proyecto NGLs", "11 de marzo de 2026 · Anuncio en la Argentina Week de Nueva York."],
  ["2026", "Acuerdos y decisión final de inversión", "10 de junio de 2026 · Avanza el Proyecto NGLs."],
  ["2026", "Avance de obras del Gasoducto Perito Moreno", "Continúan las obras de ampliación, con nueva capacidad prevista para abril de 2027."],
  ["2026", "NGLs en Puerto Galván", "Octubre de 2026 · Trabajos iniciales en Puerto Galván, Bahía Blanca."],
  ["2026", "Hoy somos mucho más", "Nacimos como una transportadora de gas, pero hoy somos mucho más."],
  ["2026", "Energía que avanza", "Inversiones, proyectos y soluciones para el desarrollo energético de nuestro país."],
];
const output = resolve("public/ride");
await mkdir(join(output, "previews"), { recursive: true });
await mkdir("outputs/recorrido", { recursive: true });
sharp.concurrency(2);
const manifest = [], report = [];
for (let index = 0; index < descriptions.length; index++) {
  const file = files[index - 1];
  const source = index === 0 ? resolve("public/brand/tgs-logo-acuarela.png") : join(corrections.has(file) ? corrected : masterNames.has(file) ? masters : order, file);
  await access(source);
  // Buffer input also supports Dropbox source paths longer than Windows MAX_PATH.
  const bytes = await readFile(source);
  const name = `tgs-${String(index).padStart(2, "0")}.webp`;
  const full = await sharp(bytes).rotate().flatten({ background: "#ffffff" }).resize({ width: 1600, withoutEnlargement: true }).webp({ quality: 92, effort: 5, smartSubsample: true }).toFile(join(output, name));
  const preview = await sharp(bytes).rotate().flatten({ background: "#ffffff" }).resize({ width: 384, withoutEnlargement: true }).webp({ quality: 82, effort: 4 }).toFile(join(output, "previews", name));
  const [year, title, caption] = descriptions[index];
  manifest.push({ id: index, year, title, caption, alt: title, src: `/ride/${name}`, preview: `/ride/previews/${name}`, width: full.width, height: full.height });
  report.push({ id: index, source, width: full.width, height: full.height, fullBytes: full.size, previewBytes: preview.size });
}
await writeFile("app/recorrido/ride-scenes.json", JSON.stringify(manifest, null, 2) + "\n");
await writeFile("outputs/recorrido/image-sources.json", JSON.stringify(report, null, 2) + "\n");
console.log(`${manifest.length} imágenes opacas. Máximo 1600 px. ${(report.reduce((sum, row) => sum + row.fullBytes + row.previewBytes, 0) / 1048576).toFixed(2)} MiB en total.`);
