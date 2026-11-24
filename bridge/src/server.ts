// Bridge local: la web habla con él en http://localhost:8787. Sin él, la web sigue funcionando offline.
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { createReadStream, createWriteStream, existsSync, mkdirSync, statSync } from "node:fs";
import { join, extname, basename } from "node:path";
import { randomUUID } from "node:crypto";
import { pipeline } from "node:stream/promises";
import { DATA } from "./store.js";
import { startRender, getRender, type Engine } from "./render.js";
import { listStyles, getStyle, saveStyle, createJob, getJob, updateJob, listJobs } from "./store.js";
import { availableProviders, planEdit, type ProviderId } from "./providers/index.js";

const PORT = Number(process.env.SANTI_PORT ?? 8787);
const MEDIA = join(DATA, "media");
mkdirSync(MEDIA, { recursive: true });

/** Sirve un archivo con soporte de Range (necesario para video). */
function serveFile(req: IncomingMessage, res: ServerResponse, path: string, type: string) {
  const size = statSync(path).size;
  const range = req.headers.range?.match(/bytes=(\d*)-(\d*)/);
  const head = { "content-type": type, "accept-ranges": "bytes", "access-control-allow-origin": "*" };
  if (range) {
    const start = range[1] ? +range[1] : 0, end = range[2] ? +range[2] : size - 1;
    res.writeHead(206, { ...head, "content-range": `bytes ${start}-${end}/${size}`, "content-length": end - start + 1 });
    createReadStream(path, { start, end }).pipe(res);
  } else {
    res.writeHead(200, { ...head, "content-length": size });
    createReadStream(path).pipe(res);
  }
}

async function body(req: IncomingMessage) {
  let s = "";
  for await (const c of req) s += c;
  return s ? JSON.parse(s) : {};
}
function send(res: ServerResponse, code: number, data: unknown) {
  res.writeHead(code, {
    "content-type": "application/json",
    "access-control-allow-origin": "*",
    "access-control-allow-headers": "content-type",
    "access-control-allow-methods": "GET,POST,OPTIONS",
  });
  res.end(JSON.stringify(data));
}

createServer(async (req, res) => {
  try {
    if (req.method === "OPTIONS") return send(res, 204, null);
    const url = new URL(req.url ?? "/", "http://x");
    const p = url.pathname;

    // Medios: la web sube el clip una vez para que Remotion/HyperFrames lo rendericen
    if (p === "/api/media" && req.method === "POST") {
      const ext = extname(url.searchParams.get("name") ?? "") || ".mp4";
      const file = `${randomUUID().slice(0, 8)}${ext}`;
      await pipeline(req, createWriteStream(join(MEDIA, file)));
      return send(res, 200, { mediaId: file, url: `http://localhost:${PORT}/media/${file}` });
    }
    const media = p.match(/^\/media\/([\w.-]+)$/);
    if (media && existsSync(join(MEDIA, media[1]))) return serveFile(req, res, join(MEDIA, media[1]), "video/mp4");

    if (p === "/api/render" && req.method === "POST") {
      const b = await body(req);
      const style = getStyle(b.styleId);
      const videoPath = join(MEDIA, basename(b.mediaId ?? ""));
      if (!style || !existsSync(videoPath)) return send(res, 400, { error: "Falta el estilo o el video" });
      const job = startRender({ engine: b.engine as Engine, videoPath, videoUrl: `http://localhost:${PORT}/media/${basename(videoPath)}`, plan: b.plan, words: b.words, style });
      return send(res, 200, job);
    }
    const r = p.match(/^\/api\/render\/([\w-]+)(\/file)?$/);
    if (r) {
      const job = getRender(r[1]);
      if (!job) return send(res, 404, { error: "No existe" });
      if (r[2] && job.output) return serveFile(req, res, job.output, "video/mp4");
      return send(res, 200, job);
    }

    if (p === "/api/health") return send(res, 200, { ok: true, providers: await availableProviders() });
    if (p === "/api/styles" && req.method === "GET") return send(res, 200, listStyles());
    if (p === "/api/styles" && req.method === "POST") return send(res, 200, saveStyle(await body(req)));

    // Plan directo con un proveedor (API o CLI de suscripción)
    if (p === "/api/plan" && req.method === "POST") {
      const b = await body(req);
      const style = getStyle(b.styleId);
      if (!style) return send(res, 404, { error: "Estilo no encontrado" });
      const plan = await planEdit(b.provider as ProviderId, { style, words: b.words, duration: b.duration, prompt: b.prompt ?? "" });
      return send(res, 200, { plan });
    }

    // Cola de trabajos: la web publica, y Claude Desktop / ChatGPT / Gemini (vía MCP) responden.
    if (p === "/api/jobs" && req.method === "POST") {
      const b = await body(req);
      return send(res, 200, createJob({ styleId: b.styleId, prompt: b.prompt ?? "", duration: b.duration, words: b.words }));
    }
    if (p === "/api/jobs" && req.method === "GET") return send(res, 200, listJobs().map(({ words, ...j }) => j));
    const m = p.match(/^\/api\/jobs\/([\w-]+)$/);
    if (m) {
      const job = getJob(m[1]);
      if (!job) return send(res, 404, { error: "No existe" });
      if (req.method === "POST") {
        const b = await body(req);
        updateJob({ ...job, plan: b.plan, plannedBy: b.plannedBy ?? "manual" });
      }
      return send(res, 200, getJob(m[1]));
    }
    send(res, 404, { error: "Ruta desconocida" });
  } catch (e) {
    send(res, 500, { error: (e as Error).message });
  }
}).listen(PORT, () => console.log(`Santi bridge en http://localhost:${PORT}`));
