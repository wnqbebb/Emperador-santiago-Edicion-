// Bridge local: la web habla con él en http://localhost:8787. Sin él, la web sigue funcionando offline.
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { createReadStream, createWriteStream, existsSync, mkdirSync, statSync } from "node:fs";
import { join, extname, basename, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { pipeline } from "node:stream/promises";
import { DATA } from "./store.js";
import { startRender, getRender, type Engine } from "./render.js";
import { FX_DIR } from "./fxbake.js";
import { startMontaje, getMontaje, analizarMontaje, renderMontaje, MONTAJE_DIR } from "./montaje.js";
import { plantillas, familias, startFlujo, getFlujo, elegir, replanificar, tablero, flujoFiles, paletaDeVideo, cuadro, pedirPrompts } from "./flujo.js";
import { skyPath } from "./skylight.js";
import { searchIdeas, startMotion, getMotion, renderMotionHtml, MOTION_DIR } from "./motion.js";
import { startAnalysis, getAnalysis, reaInstalled } from "./analyze.js";
import { runVes, getVesJob, humanAction, confirmPhrase, listVesStyles, listProjects, projectStatus, vesPath, vesInstalled, type VesScript } from "./ves.js";
import { listStyles, getStyle, saveStyle, createJob, getJob, updateJob, listJobs } from "./store.js";
import { availableProviders, planEdit, type ProviderId } from "./providers/index.js";

const PORT = Number(process.env.SANTI_PORT ?? 8787);
const MEDIA = join(DATA, "media");
mkdirSync(MEDIA, { recursive: true });

/** Sirve un archivo con soporte de Range (necesario para video). */
function serveFile(req: IncomingMessage, res: ServerResponse, path: string, type: string) {
  const size = statSync(path).size;
  const range = req.headers.range?.match(/bytes=(\d*)-(\d*)/);
  const head = { "content-type": type, "accept-ranges": "bytes", "access-control-allow-origin": currentOrigin };
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
// Solo el propio editor puede llamar al bridge desde el navegador (otras páginas no pueden ordenar nada).
const WEB_ORIGINS = (process.env.SANTI_WEB_ORIGIN ?? "http://localhost:5173,http://127.0.0.1:5173,http://localhost:4173").split(",");
let currentOrigin = WEB_ORIGINS[0];
function send(res: ServerResponse, code: number, data: unknown) {
  res.writeHead(code, {
    "content-type": "application/json",
    "access-control-allow-origin": currentOrigin,
    vary: "origin",
    "access-control-allow-headers": "content-type",
    "access-control-allow-methods": "GET,POST,OPTIONS",
  });
  res.end(JSON.stringify(data));
}

createServer(async (req, res) => {
  try {
    const origin = req.headers.origin;
    if (origin && !WEB_ORIGINS.includes(origin)) { res.writeHead(403); return res.end("Origen no permitido"); }
    currentOrigin = origin ?? WEB_ORIGINS[0];
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
    // Biblioteca de ideas + generador de motion graphics (HyperFrames)
    if (p === "/api/library") return send(res, 200, searchIdeas(url.searchParams.get("q") ?? "", url.searchParams.get("cat") ?? ""));
    if (p === "/api/motion" && req.method === "POST") {
      const b = await body(req);
      const style = getStyle(b.styleId) ?? getStyle("imperial")!;
      if (b.html) return send(res, 200, await renderMotionHtml(b.html, b.seconds ?? 6));
      return send(res, 200, startMotion(b.provider, b.idea, b.seconds ?? 6, style));
    }
    const mj = p.match(/^\/api\/motion\/([\w-]+)$/);
    if (mj) return send(res, 200, getMotion(mj[1]) ?? { error: "No existe" });
    const mf = p.match(/^\/motion\/([\w.-]+\.mp4)$/);
    if (mf && existsSync(join(MOTION_DIR, mf[1]))) return serveFile(req, res, join(MOTION_DIR, mf[1]), "video/mp4");

    // Aprender un estilo de un video de referencia (rea-video)
    if (p === "/api/analyze" && req.method === "POST") {
      const b = await body(req);
      if (!reaInstalled()) return send(res, 400, { error: "rea-video no está instalado: npm run setup:rea" });
      const videoPath = join(MEDIA, basename(b.mediaId ?? ""));
      if (!existsSync(videoPath)) return send(res, 400, { error: "Sube primero el video de referencia" });
      return send(res, 200, startAnalysis(videoPath, b.name || "Estilo aprendido", b.provider || undefined));
    }
    const an = p.match(/^\/api\/analyze\/([\w-]+)$/);
    if (an) return send(res, 200, getAnalysis(an[1]) ?? { error: "No existe" });

    // ---------- Unión de clips y recortes de silencio
    if ((p === "/api/montaje" || p === "/api/montaje/analizar") && req.method === "POST") {
      const b = await body(req);
      const files = (b.clips ?? []).map((c: { mediaId: string; name: string }) => ({ path: join(MEDIA, basename(c.mediaId)), name: String(c.name) }));
      if (!files.length || files.some((f: { path: string }) => !existsSync(f.path))) return send(res, 400, { error: "Faltan clips por subir" });
      const opts = { ritmo: b.ritmo ?? "dinamico", muletillas: !!b.muletillas, formato: b.formato ?? "vertical", idioma: b.idioma ?? "es",
        repetidas: !!b.repetidas, mejorarAudio: !!b.mejorarAudio, velocidad: Number(b.velocidad ?? 1), srt: !!b.srt };
      return send(res, 200, p.endsWith("analizar") ? analizarMontaje(files, opts) : startMontaje(files, opts));
    }
    const mr = p.match(/^\/api\/montaje\/([\w-]+)\/render$/);
    if (mr && req.method === "POST") { const b = await body(req); return send(res, 200, renderMontaje(mr[1], b.restaurar ?? {}, b.cambios ?? {})); }
    const mt = p.match(/^\/api\/montaje\/([\w-]+)$/);
    if (mt) {
      const j = getMontaje(mt[1]);
      if (!j) return send(res, 404, { error: "No existe" });
      return send(res, 200, { ...j, master: j.master && `/montaje/${j.id}/video-completo.mp4`, web: j.web && `/montaje/${j.id}/video-completo-redes.mp4`, srt: j.srt && `/montaje/${j.id}/video-completo.srt` });
    }
    const mtf = p.match(/^\/montaje\/([\w-]+)\/(video-completo(?:-redes)?\.(mp4|srt))$/);
    if (mtf && existsSync(join(MONTAJE_DIR, mtf[1], mtf[2]))) return serveFile(req, res, join(MONTAJE_DIR, mtf[1], mtf[2]), mtf[3] === "srt" ? "application/x-subrip" : "video/mp4");

    // ---------- Plantillas de estilo de edición → flujo automático
    if (p === "/api/plantillas") return send(res, 200, plantillas());
    if (p === "/api/familias") return send(res, 200, familias());
    if (p.startsWith("/plantilla-preview/")) {
      const t = plantillas().find((x) => x.id === p.split("/")[2]);
      const full = t?.preview ? join(dirname(fileURLToPath(import.meta.url)), "..", "..", t.preview) : "";
      if (!full || !existsSync(full)) return send(res, 404, { error: "Sin vista previa" });
      return serveFile(req, res, full, "image/jpeg");
    }
    // Paleta del propio video (para preguntarle a Santiago con vista previa)
    if (p === "/api/paleta" && req.method === "POST") {
      const b = await body(req);
      // del video unido (montajeId) o de un clip subido directo (mediaId)
      const id = basename(String(b.montajeId ?? b.mediaId ?? "")).replace(/\.\w+$/, "");
      const video = b.montajeId ? join(MONTAJE_DIR, id, "video-completo.mp4") : join(MEDIA, basename(String(b.mediaId ?? "")));
      if (!existsSync(video)) return send(res, 400, { error: "No encuentro el video" });
      mkdirSync(join(MONTAJE_DIR, id), { recursive: true });
      const r = paletaDeVideo(video, join(MONTAJE_DIR, id, "paleta"));
      return send(res, 200, { ...r, frame: `/montaje/${id}/paleta/cuadro.jpg` });
    }
    const pf = p.match(/^\/montaje\/([\w-]+)\/paleta\/cuadro\.jpg$/);
    if (pf && existsSync(join(MONTAJE_DIR, pf[1], "paleta/cuadro.jpg"))) return serveFile(req, res, join(MONTAJE_DIR, pf[1], "paleta/cuadro.jpg"), "image/jpeg");

    if (p === "/api/flujo" && req.method === "POST") {
      const b = await body(req);
      // el clip puede venir de la Unión de clips (montajeId) o subido directamente (mediaId)
      const videoPath = b.montajeId ? join(MONTAJE_DIR, basename(b.montajeId), "video-completo.mp4") : join(MEDIA, basename(b.mediaId ?? ""));
      if (!existsSync(videoPath)) return send(res, 400, { error: "No encuentro el video" });
      const brollFiles = (b.broll ?? []).map((x: { mediaId: string; desc: string }) => ({ path: join(MEDIA, basename(x.mediaId)), desc: String(x.desc ?? "") })).filter((x: { path: string }) => existsSync(x.path));
      const r = b.respuestas ?? {};
      const respuestas = { energia: r.energia ?? "viral", texturas: Number(r.texturas ?? 0.4), palette: r.palette, originales: r.originales !== false, broll: [], rapido: !!r.rapido, notas: r.notas, fuentes: Array.isArray(r.fuentes) ? r.fuentes.map(String).slice(0, 8) : undefined };
      return send(res, 200, startFlujo({ videoPath, plantilla: String(b.plantilla), provider: b.provider, name: b.name, respuestas, brollFiles }));
    }
    const fl = p.match(/^\/api\/flujo\/([\w-]+)(?:\/(elegir|tablero|replan|cuadro|prompts))?$/);
    if (fl) {
      if (fl[2] === "prompts" && req.method === "POST") { const b = await body(req); return send(res, 200, pedirPrompts(fl[1], b.base === "pedido" ? "pedido" : "sugerencia", String(b.pedido ?? ""), b.beat ? String(b.beat) : undefined)); }
      if (fl[2] === "elegir" && req.method === "POST") return send(res, 200, elegir(fl[1], (await body(req)).picks ?? {}));
      if (fl[2] === "replan" && req.method === "POST") return send(res, 200, replanificar(fl[1], await body(req)));
      if (fl[2] === "tablero") return send(res, 200, tablero(fl[1]));
      if (fl[2] === "cuadro") return serveFile(req, res, cuadro(fl[1], Number(url.searchParams.get("t") ?? 0)), "image/jpeg");
      const j = getFlujo(fl[1]);
      return j ? send(res, 200, { ...j, project_status: flujoFiles(j) }) : send(res, 404, { error: "No existe" });
    }

    // ---------- VES (crear-estilo-edicion): edición profesional por STOPs y laboratorio de estilos
    if (p === "/api/ves") return send(res, 200, { installed: vesInstalled(), styles: listVesStyles().map((v) => ({ id: v.id, name: v.name, description: v.description })), projects: listProjects() });
    if (p === "/api/ves/project" && req.method === "POST") {
      const b = await body(req);
      const videoPath = join(MEDIA, basename(b.mediaId ?? ""));
      if (!existsSync(videoPath)) return send(res, 400, { error: "Sube primero el clip" });
      return send(res, 200, runVes("ves", ["new", String(b.name), "--video", videoPath, "--style", String(b.style)]));
    }
    if (p === "/api/ves/run" && req.method === "POST") {
      const b = await body(req);
      return send(res, 200, runVes(b.script as VesScript, (b.args ?? []).map(String), b.estilo ? { VES_STYLE: String(b.estilo), VES_REFS: String(b.estilo) } : {}));
    }
    // STOP 3: solo con la frase de confirmación que escribe Santiago
    if (p === "/api/ves/human" && req.method === "POST") {
      const b = await body(req);
      return send(res, 200, humanAction(String(b.project), b.action, String(b.confirm ?? ""), b.skill ? String(b.skill) : undefined));
    }
    if (p === "/api/ves/confirm-phrase") return send(res, 200, { phrase: confirmPhrase(url.searchParams.get("action") as "approve", url.searchParams.get("project") ?? "") });
    const vj = p.match(/^\/api\/ves\/run\/([\w-]+)$/);
    if (vj) return send(res, 200, getVesJob(vj[1]) ?? { error: "No existe" });
    const vp = p.match(/^\/api\/ves\/project\/([\w.-]+)$/);
    if (vp) return send(res, 200, projectStatus(vp[1], url.searchParams.get("skill") ?? undefined));
    const sf = p.match(/^\/skylight-files\/([\w.-]+)\/(.+)$/);
    if (sf) {
      const full = skyPath(sf[1], decodeURIComponent(sf[2]));
      if (!existsSync(full)) return send(res, 404, { error: "No existe" });
      const ext = extname(full).slice(1);
      return serveFile(req, res, full, ({ mp4: "video/mp4", html: "text/html; charset=utf-8", md: "text/markdown; charset=utf-8", png: "image/png", jpg: "image/jpeg" } as Record<string, string>)[ext] ?? "application/octet-stream");
    }
    if (p.startsWith("/ves-files/")) {
      const full = vesPath(decodeURIComponent(p.slice("/ves-files/".length)), url.searchParams.get("skill") ?? undefined);
      if (!existsSync(full) || statSync(full).isDirectory()) return send(res, 404, { error: "No existe" });
      const type = ({ ".html": "text/html; charset=utf-8", ".png": "image/png", ".jpg": "image/jpeg", ".mp4": "video/mp4", ".json": "application/json", ".md": "text/markdown; charset=utf-8", ".zip": "application/zip" } as Record<string, string>)[extname(full)] ?? "application/octet-stream";
      return serveFile(req, res, full, type);
    }

    const fxm = p.match(/^\/fx\/([\w.-]+)$/);
    if (fxm && existsSync(join(FX_DIR, fxm[1]))) return serveFile(req, res, join(FX_DIR, fxm[1]), "video/webm");
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

    if (p === "/api/health") return send(res, 200, { ok: true, providers: await availableProviders(), rea: reaInstalled() });
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
