import presets from "../app/transition-presets.json" with { type: "json" };
import { validateMasks } from "../shared/mask-settings.mjs";

const defaults = validateMasks(presets);
const encoder = new TextEncoder();
const MAX_BODY = 64 * 1024;

async function digest(value) {
  const bytes = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return [...new Uint8Array(bytes)].map(v => v.toString(16).padStart(2,"0")).join("");
}

async function matchesPassword(input, expected) {
  const [a,b] = await Promise.all([digest(input),digest(expected)]);
  let diff = 0;
  for (let i=0;i<a.length;i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function body(request) {
  if (!request.headers.get("content-type")?.startsWith("application/json")) throw new Error("Enviá datos JSON.");
  const reader = request.body?.getReader();
  if (!reader) throw new Error("Faltan los datos.");
  const chunks = [];
  let length = 0;
  try {
    while (true) {
      const {done,value} = await reader.read();
      if (done) break;
      length += value.length;
      if (length > MAX_BODY) { await reader.cancel(); throw new Error("Los datos son demasiado grandes."); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk,offset); offset += chunk.length; }
  return JSON.parse(new TextDecoder().decode(bytes));
}

function snapshot(row) {
  return row ? {version:row.version, updatedAt:row.updated_at, transitions:validateMasks(JSON.parse(row.payload))}
    : {version:0,updatedAt:null,transitions:defaults};
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("origin");
    const allowed = (env.MASK_ALLOWED_ORIGINS ?? "").split(",").map(v => v.trim());
    const headers = {"Content-Type":"application/json; charset=utf-8", "Cache-Control":"no-store", "Vary":"Origin", "X-Content-Type-Options":"nosniff"};
    if (origin && allowed.includes(origin)) {
      headers["Access-Control-Allow-Origin"] = origin;
      headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS";
      headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization";
    }
    const json = (data,status=200) => new Response(JSON.stringify(data),{status,headers});
    if (origin && !allowed.includes(origin)) return json({error:"Origen no permitido."},403);
    if (request.method === "OPTIONS") return new Response(null,{status:204,headers});
    const path = new URL(request.url).pathname;
    if (path === "/") return json({service:"TGS · Máscaras compartidas"});
    if (!env.DB || !env.MASK_EDITOR_PASSWORD) return json({error:"El servicio todavía no está configurado."},503);
    const db = env.DB;
    const now = Date.now();
    try {
      if (path === "/masks" && request.method === "GET") {
        return json(snapshot(await db.prepare("SELECT version, payload, updated_at FROM mask_versions ORDER BY version DESC LIMIT 1").first()));
      }
      if (path === "/session" && request.method === "POST") {
        // Atomic, durable throttling, including concurrent attempts. No raw IPs or passwords are stored.
        const ip = request.headers.get("cf-connecting-ip") ?? "unknown";
        const key = await digest(ip);
        const limit = await db.prepare(`INSERT INTO mask_login_limits (key,attempts,expires_at) VALUES (?,1,?)
          ON CONFLICT(key) DO UPDATE SET attempts = CASE WHEN expires_at <= ? THEN 1 ELSE attempts + 1 END,
          expires_at = CASE WHEN expires_at <= ? THEN excluded.expires_at ELSE expires_at END RETURNING attempts`)
          .bind(key,now+10*60*1000,now,now).first();
        if (limit.attempts > 10) return json({error:"Demasiados intentos. Esperá diez minutos."},429);
        let input;
        try { input = await body(request); } catch { return json({error:"Solicitud inválida."},400); }
        if (typeof input?.password !== "string" || input.password.length > 256 || !await matchesPassword(input.password,env.MASK_EDITOR_PASSWORD)) {
          return json({error:"Contraseña incorrecta. Volvé a intentarlo."},401);
        }
        const token = [...crypto.getRandomValues(new Uint8Array(32))].map(v=>v.toString(16).padStart(2,"0")).join("");
        const expiresAt = now + 8*60*60*1000;
        await db.batch([
          db.prepare("DELETE FROM mask_sessions WHERE expires_at <= ?").bind(now),
          db.prepare("DELETE FROM mask_login_limits WHERE expires_at <= ?").bind(now),
          db.prepare("INSERT INTO mask_sessions (token_hash, expires_at) VALUES (?, ?)").bind(await digest(token),expiresAt),
        ]);
        return json({token,expiresAt});
      }
      if ((path === "/masks" && request.method === "PUT") || (path === "/session" && request.method === "DELETE")) {
        const token = request.headers.get("authorization")?.match(/^Bearer ([a-f0-9]{64})$/)?.[1];
        if (!token) return json({error:"Ingresá la contraseña para publicar."},401);
        const tokenHash = await digest(token);
        const session = await db.prepare("SELECT expires_at FROM mask_sessions WHERE token_hash = ? AND expires_at > ?").bind(tokenHash,now).first();
        if (!session) return json({error:"La sesión venció. Volvé a ingresar la contraseña."},401);
        if (request.method === "DELETE") {
          await db.prepare("DELETE FROM mask_sessions WHERE token_hash = ?").bind(tokenHash).run();
          return json({ok:true});
        }
        let input, transitions;
        try {
          input = await body(request);
          transitions = validateMasks(input.transitions);
          if (!Number.isSafeInteger(input.baseVersion) || input.baseVersion < 0 || typeof input.requestId !== "string" || !/^[a-f0-9-]{36}$/.test(input.requestId)) throw new Error("Publicación inválida.");
        } catch (error) { return json({error:error.message || "Máscaras inválidas."},400); }
        // A retry after a lost response cannot publish twice. Conflicting editors cannot overwrite each other.
        const payload = JSON.stringify(transitions);
        const previous = await db.prepare("SELECT version,payload,updated_at FROM mask_versions WHERE request_id = ?").bind(input.requestId).first();
        if (previous) return previous.payload === payload ? json(snapshot(previous)) : json({error:"Identificador de publicación reutilizado."},409);
        const row = await db.prepare(`INSERT INTO mask_versions (request_id,payload,updated_at)
          SELECT ?,?,? WHERE COALESCE((SELECT MAX(version) FROM mask_versions),0) = ?
          ON CONFLICT(request_id) DO NOTHING RETURNING version,payload,updated_at`)
          .bind(input.requestId,payload,new Date(now).toISOString(),input.baseVersion).first();
        if (row) return json(snapshot(row));
        const retry = await db.prepare("SELECT version,payload,updated_at FROM mask_versions WHERE request_id = ?").bind(input.requestId).first();
        if (retry?.payload === payload) return json(snapshot(retry));
        return json({error:"Hay una versión publicada más reciente. Cargala antes de volver a publicar; tu borrador se conserva."},409);
      }
      return json({error:"Ruta no disponible."},404);
    } catch {
      // Do not log requests, authorization headers, passwords, tokens or submitted masks.
      console.error("Mask service storage operation failed");
      return json({error:"No se pudo acceder al guardado. Tus cambios no se perdieron; intentá nuevamente."},503);
    }
  },
};
