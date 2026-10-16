import { copyFile, mkdir } from "node:fs/promises";
import { resolve, join } from "node:path";

// GitHub Pages serves directory indexes. Keep Vinext's flat export as well so
// its static RSC URLs continue to work without relying on host rewrites.
const client = resolve("dist/client");
const destination = join(client, "recorrido");
await mkdir(destination, { recursive: true });
await copyFile(join(client, "recorrido.html"), join(destination, "index.html"));
await copyFile(join(client, "recorrido.rsc"), join(destination, "index.rsc"));
console.log("Static route ready: /recorrido/");
