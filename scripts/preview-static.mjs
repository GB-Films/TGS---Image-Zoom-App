import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";

const root = path.resolve("dist/client");
const port = Number(process.env.PREVIEW_PORT || 5173);
const localOrigin = `http://127.0.0.1:${port}`;
const config = JSON.parse(await fs.readFile(path.join(root, "mask-service.json"), "utf8"));
const service = new URL(config.url);
const mime = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".webp": "image/webp", ".png": "image/png", ".svg": "image/svg+xml", ".rsc": "text/x-component", ".webmanifest": "application/manifest+json" };

// Production restricts browser origins. Relay only anonymous mask reads for the
// local preview; publishing and authentication remain unavailable on this server.
http.createServer(async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.writeHead(405, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Esta vista previa es de solo lectura. Usá la app online para ajustar o publicar máscaras." })); return;
  }
  try {
    const url = new URL(req.url, localOrigin);
    if (url.pathname === "/mask-service.json") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ url: localOrigin })); return;
    }
    if (url.pathname === "/masks") {
      const upstream = new URL("/masks", service);
      upstream.search = url.search;
      const response = await fetch(upstream, { signal: AbortSignal.timeout(10000), cache: "no-store" });
      res.writeHead(response.status, { "Content-Type": "application/json" });
      res.end(await response.text()); return;
    }
    if (url.pathname === "/session") {
      res.writeHead(405, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Esta vista previa es de solo lectura." })); return;
    }
    let relative = decodeURIComponent(url.pathname);
    if (relative.endsWith("/")) relative += "index.html";
    else if (!path.extname(relative)) relative += "/index.html";
    const file = path.resolve(root, "." + relative);
    if (!file.startsWith(root + path.sep)) { res.writeHead(403); res.end(); return; }
    const data = await fs.readFile(file);
    res.writeHead(200, { "Content-Type": mime[path.extname(file)] ?? "application/octet-stream" });
    res.end(req.method === "HEAD" ? undefined : data);
  } catch (error) {
    const code = error?.code === "ENOENT" ? 404 : 502;
    res.writeHead(code, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: code === 404 ? "Archivo no encontrado." : "No se pudo cargar la vista previa o las máscaras publicadas." }));
  }
}).listen(port, "127.0.0.1", () => console.log(`Vista previa con máscaras publicadas (solo lectura): ${localOrigin}/`));
