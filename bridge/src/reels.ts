// Motor "Reels Instagram" (skill .claude/skills/instagram-editing), sin Premiere: todo se renderiza aquí.
// Base con FFmpeg (encuadre, punch-ins, pantalla dividida, blanco y negro con grano) + una capa HTML cuadro a cuadro
// (subtítulos, palabras grandes, gráficos en canvas escritos por la IA, destellos) + diseño sonoro con el kit propio.
// Tres estilos de la skill: cara completa, educativo en pantalla dividida y cinemático en blanco y negro.
import { spawn, execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { join, dirname, resolve, relative, normalize } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { DATA } from "./store.js";
import { ask, extract, type Asset, type PlanOpts, type Energia } from "./beats.js";
import type { ProviderId } from "./providers/index.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
export const REELS = join(ROOT, ".claude/skills/instagram-editing");
export const REELS_DATA = join(DATA, "reels");
const PY = join(ROOT, "tools/.venv/bin/python");
const SFX = join(ROOT, ".claude/skills/skylight/sfx");
export type Estilo = "cara" | "split" | "cine";
export const REEL_STEPS = ["Preparando el clip (1080×1920)", "Palabras y encuadre de la cara", "Tu IA propone los beats A/B/C", "Tablero de preedición (tú eliges)", "Gráficos en código", "Subtítulos, efectos y render", "Diseño sonoro y mezcla"];

export const reelDir = (project: string) => {
  if (!/^[\w.-]+$/.test(project)) throw new Error("Proyecto inválido");
  return join(REELS_DATA, project);
};
const read = (p: string, max = 1e9) => (existsSync(p) ? readFileSync(p, "utf8").slice(0, max) : "");

function ff(args: string[], log: string[], input?: NodeJS.ReadableStream) {
  return new Promise<void>((ok, ko) => {
    const p = spawn("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", ...args]);
    let err = ""; p.stderr.on("data", (d) => (err += d));
    p.on("close", (c) => (c === 0 ? ok() : ko(new Error(`ffmpeg: ${err.slice(-400)}`))));
    p.stdin.on("error", () => { /* FFmpeg se cerró antes: el error real llega en 'close' */ });
    if (input) input.pipe(p.stdin);
    log.push(`$ ffmpeg ${args.slice(0, 6).join(" ")} …`);
  });
}

type Word = { w: string; t0: number; t1: number };

/** Preparar: clip a 1080×1920 30 fps, voz, palabras con tiempos y dónde está la cara. */
export async function reelPrepare(project: string, video: string, log: string[], step: (i: number) => void) {
  const dir = reelDir(project);
  mkdirSync(join(dir, "work"), { recursive: true });
  mkdirSync(join(dir, "out"), { recursive: true });
  step(0);
  await ff(["-i", video, "-vf", "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,fps=30,setsar=1", "-c:v", "libx264", "-crf", "16", "-preset", "medium", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "256k", "-ar", "48000", join(dir, "work/base.mp4")], log);
  await ff(["-i", join(dir, "work/base.mp4"), "-vn", "-ac", "1", "-ar", "16000", "-c:a", "pcm_s16le", join(dir, "work/voice16k.wav")], log);
  step(1);
  const words = (JSON.parse(execFileSync(PY, [join(ROOT, "tools/palabras.py"), join(dir, "work/voice16k.wav"), "small", "es"], { maxBuffer: 64 << 20 }).toString()) as Word[]).map(({ w, t0, t1 }) => ({ w, t0, t1 }));
  writeFileSync(join(dir, "work/words.json"), JSON.stringify(words));
  // cara: YuNet (el modelo que trae Skylight) en 9 cuadros → mediana
  const face = JSON.parse(execFileSync(PY, [join(ROOT, "tools/cara.py"), join(dir, "work/base.mp4"), join(ROOT, ".claude/skills/skylight/assets/models/face_detection_yunet_2023mar.onnx")]).toString());
  writeFileSync(join(dir, "work/face.json"), JSON.stringify(face));
  return dir;
}

const ENERGIA: Record<Energia, string> = {
  calma: "Cambios cada 3–5 s. Calma, limpio y legible gana.",
  media: "Algo cambia cada 2–3 s (layout, gráfico, punch-in).",
  viral: "Gancho en 0–1.5 s; algo cambia cada 1–2 s; en el estilo dividido el gráfico de arriba cambia cada ~1 s con las palabras.",
};
const ESTILO: Record<Estilo, string> = {
  cara: `ESTILO 1 · CARA COMPLETA: casi todo "cara" (punch-in suave en cortes alternos), gráficos sencillos en el tercio inferior (region "lower", panel oscuro redondeado de 900×440): checklist que se marca al decirlo, pareja de iconos A → B, una cifra. Pocas "grande". NADA de exceso de flashes, zooms o cambios de layout.`,
  split: `ESTILO 2 · EDUCATIVO DIVIDIDO: la base es "split" (gráfico arriba 1080×960 que cambia ~cada segundo con las palabras, la persona abajo; subtítulo pequeño en caja negra sobre la costura). En las palabras importantes, "grande" (palabra enorme a pantalla completa sobre el pecho). Gráficos arriba: pantallas que parecen reales (app, chat, línea de tiempo), gráficas simples, una palabra grande, iconos; UN movimiento de cámara lento y continuo.`,
  cine: `ESTILO 3 · CINEMÁTICO B/N: blanco y negro, oscuro, viñeta y grano. Texto que se construye palabra a palabra (sans fina; palabra clave en serif itálica elegante). Palabras grandes en mayúsculas condensadas rojas con un parpadeo leve ("grande"). En palabras clave, corte a "negro" con un gráfico en un plano 3D inclinado con poca profundidad de campo (region "full": línea de tiempo, ondas, tiras de película, subtítulos). Quemados de película cálidos al entrar y salir del negro.`,
};

export type ROpt = { title: string; cats?: string; desc?: string; type: null; layout: "cara" | "split" | "grande" | "negro"; punch?: boolean; palabra?: string; grafico?: { brief: string; region: "top" | "lower" | "full" } | null };
export type RBeat = { id: string; start: number; end: number; script: string; seen: string; pick: "A" | "B" | "C"; opts: ROpt[] };
export type RBeats = { title: string; estilo: Estilo; keywords: string[]; beats: RBeat[]; assets?: Asset[] };

export function reelPrompt(project: string, estilo: Estilo, po: PlanOpts) {
  const dir = reelDir(project);
  const words = JSON.parse(read(join(dir, "work/words.json"))) as Word[];
  const duration = words.at(-1)?.t1 ?? 0;
  const face = JSON.parse(read(join(dir, "work/face.json")) || "{}");
  const system = `Eres el editor de "Emperador Santiago · Edición de Videos" con la skill instagram-editing (edición general de reels). No hay Premiere: todo se renderiza en Emperador.
# Reglas de edición
${read(join(REELS, "references/editing-rules.md"))}
# Los tres estilos
${read(join(REELS, "references/styles.md"))}
# Gráficos
${read(join(REELS, "references/graphics.md"), 2500)}
# Estilo elegido
${ESTILO[estilo]}
# CREATIVIDAD (manda Santiago): las referencias son inspiración; esto es para redes y lo viral manda. Lo que se ve SIEMPRE coincide con lo que se dice, con sus palabras.
Paleta del video: ${JSON.stringify(po.palette ?? {})}. La cara está en x=${face.x?.toFixed?.(2)}, y=${face.y?.toFixed?.(2)} (fracción del cuadro).`;
  const user = `Clip ya limpio (${duration.toFixed(2)} s). Palabras (inicio fin palabra):
${words.map((w) => `${w.t0.toFixed(2)} ${w.t1.toFixed(2)} ${w.w}`).join("\n")}
Energía: ${po.energia.toUpperCase()} → ${ENERGIA[po.energia]}
${po.notas ? `Notas de Santiago (mandan): ${po.notas}\n` : ""}
Devuelve SOLO un JSON (bloque \`\`\`json):
{"title", "keywords": [palabras exactas del clip que van resaltadas en el subtítulo, 8–14],
 "beats": [{"id","start","end","script","seen" (qué regla/estilo lo justifica),"pick":"A|B|C",
   "opts": [ ×3 {"title","cats","desc","type": null,
     "layout": "cara|split|grande|negro",
     "punch": true|false,
     "palabra": "solo si layout grande: 1–2 palabras dichas en ese beat",
     "grafico": null o {"region": "top (split) | lower (cara) | full (negro)", "brief": "qué se dibuja en canvas, cómo se mueve y en qué palabra entra cada cosa (tiempos absolutos)"} } ] } ],
 "assets": [] }
Reglas: beats de 1–6 s sin huecos de 0 a ${duration.toFixed(2)}; el primero abre en la cara; A = lo mejor del estilo, B = otra idea, C = más sobria. Gráficos solo de lo que se dice; nada de logos ni interfaces reales de marcas.`;
  return { system, user, duration };
}

export function reelSanitize(b: RBeats, estilo: Estilo, duration: number): RBeats {
  const okLayout: Record<Estilo, ROpt["layout"][]> = { cara: ["cara", "grande"], split: ["split", "grande", "cara"], cine: ["cara", "grande", "negro"] };
  const region = { cara: "lower", split: "top", negro: "full", grande: null } as const;
  let beats = (b.beats ?? []).filter((x) => x && typeof x.start === "number" && typeof x.end === "number").sort((x, y) => x.start - y.start);
  beats.forEach((x, i) => {
    x.id = `b${String(i + 1).padStart(2, "0")}`;
    x.start = i === 0 ? 0 : beats[i - 1].end;
    x.end = i === beats.length - 1 ? duration : Math.max(x.start + 0.5, Math.min(duration, x.end));
    x.opts = (x.opts ?? []).slice(0, 3);
    while (x.opts.length < 3) x.opts.push({ title: "Cara", desc: "Respiro limpio.", type: null, layout: estilo === "split" ? "split" : "cara" });
    for (const o of x.opts) {
      o.type = null;
      if (!okLayout[estilo].includes(o.layout)) o.layout = estilo === "split" ? "split" : "cara";
      const r = region[o.layout];
      o.grafico = o.grafico && r && typeof o.grafico.brief === "string" ? { brief: o.grafico.brief.slice(0, 1200), region: r } : null;
      if (o.layout === "negro" && !o.grafico) o.layout = "cara";
      if (o.layout !== "grande") delete o.palabra;
      else o.palabra = String(o.palabra ?? x.script.split(/\s+/).slice(-1)[0]).split(/\s+/).slice(0, 2).join(" ");
    }
    if (!"ABC".includes(x.pick)) x.pick = "A";
  });
  return { title: b.title || "Reel", estilo, keywords: (b.keywords ?? []).slice(0, 20), beats, assets: (b.assets ?? []).slice(0, 6) };
}

export async function reelPlan(project: string, estilo: Estilo, po: PlanOpts, provider: ProviderId) {
  const { system, user, duration } = reelPrompt(project, estilo, po);
  return reelSanitize(extract(await ask(provider, system, user)) as unknown as RBeats, estilo, duration);
}

/** La IA escribe cada gráfico elegido como código de canvas (sin imágenes generadas). */
async function writeGraphics(provider: ProviderId, beats: RBeats, words: Word[], pal: Record<string, string>, log: string[]) {
  const list = beats.beats.map((b) => ({ b, o: b.opts["ABC".indexOf(b.pick)] })).filter(({ o }) => o.grafico);
  if (!list.length) return {} as Record<string, string>;
  const size = { top: "1080×960", lower: "900×440 (ya hay un panel oscuro redondeado detrás)", full: "1080×1920 sobre negro" };
  const pedido = list.map(({ b, o }) => {
    const said = words.filter((w) => w.t0 >= b.start && w.t0 < b.end).map((w) => `${(w.t0 - b.start).toFixed(2)}s ${w.w}`).join(" · ");
    return `## ${b.id} · ${size[o.grafico!.region]} · dura ${(b.end - b.start).toFixed(2)} s\nIdea: ${o.grafico!.brief}\nLo que se dice (t desde 0): ${said}`;
  }).join("\n\n");
  const system = `Eres motion designer. Escribes gráficos para un reel como CUERPO de una función JavaScript de canvas 2D:
(ctx, t, w, h, pal, ease, dur) => { … }   — t = segundos desde que aparece el gráfico, w×h = su caja (el origen ya está en la esquina), pal = {accent, dark, white, black, key}, ease(k) = ease-out cúbico de 0..1, dur = duración.
Reglas: dibuja solo dentro de 0..w × 0..h; fuentes "Inter" (pesos 400–900), "Serif" (itálica elegante) y "Anton" (condensada); cada elemento entra en SU palabra (usa los tiempos), con fade + blur cortos (ctx.filter = "blur(Npx)"), arranque rápido y asentado lento, deriva suave continua (nada totalmente quieto), sin rebotes; textos grandes y legibles en un teléfono; usa la paleta; nada de imágenes externas, fetch, Date ni Math.random; deja ctx como estaba (save/restore). Textos con las palabras del que habla, en español.`;
  const user = `${pedido}\n\nPaleta: ${JSON.stringify(pal)}\nDevuelve SOLO un JSON {"b03": "cuerpo de la función", …} en un bloque \`\`\`json.`;
  const out = extract(await ask(provider, system, user)) as unknown as Record<string, string>;
  const ok: Record<string, string> = {};
  for (const [id, body] of Object.entries(out)) {
    try { new Function("ctx", "t", "w", "h", "pal", "ease", "dur", String(body)); ok[id] = String(body); }
    catch (e) { log.push(`⚠ gráfico ${id} con error de código: ${(e as Error).message}`); }
  }
  return ok;
}

type TL = {
  style: Estilo; pal: Record<string, string>; face: { x: number; y: number };
  layouts: { t0: number; t1: number; kind: string }[];
  captions: { t0: number; t1: number; words: { w: string; t: number; i: number }[]; keys: number[] }[];
  big: { t0: number; t1: number; text: string }[];
  graphics: { t0: number; t1: number; id: string; region: string }[];
  flashes: { t: number; kind: "white" | "burn" }[];
};

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\w]/g, "");

function timeline(beats: RBeats, words: Word[], face: { x: number; y: number }, pal: Record<string, string>, haveG: Set<string>): TL {
  const st = beats.estilo;
  const picked = beats.beats.map((b) => ({ b, o: b.opts["ABC".indexOf(b.pick)] }));
  const layouts = picked.map(({ b, o }) => ({ t0: b.start, t1: b.end, kind: o.layout === "negro" && !haveG.has(b.id) ? "cara" : o.layout }));
  // subtítulos: 1–2 palabras (cara) o hasta 3; cortan en pausas y puntuación; la palabra clave resaltada
  const keyset = new Set(beats.keywords.flatMap((k) => k.split(/\s+/)).map(norm).filter(Boolean));
  const maxW = st === "cara" ? 2 : 3;
  const captions: TL["captions"] = [];
  let cur: { w: string; t: number; i: number }[] = [];
  const flush = (end: number) => { if (cur.length) captions.push({ t0: cur[0].t, t1: end, words: cur, keys: cur.filter((x) => keyset.has(norm(x.w))).map((x) => x.i) }); cur = []; };
  words.forEach((w, i) => {
    const prev = words[i - 1];
    if (cur.length && (cur.length >= maxW || (prev && w.t0 - prev.t1 > 0.3) || /[.,;:?!]$/.test(prev?.w ?? ""))) flush(w.t0);
    cur.push({ w: w.w.replace(/[.,;:]+$/, ""), t: w.t0, i });
  });
  flush((words.at(-1)?.t1 ?? 0) + 0.4);
  for (let k = 0; k < captions.length - 1; k++) captions[k].t1 = Math.min(captions[k].t1, captions[k + 1].t0, captions[k].words.at(-1)!.t + 1.2);
  // palabras grandes: desde la palabra dicha hasta el final del beat
  const big = picked.filter(({ o }) => o.layout === "grande" && o.palabra).map(({ b, o }) => {
    const first = norm(o.palabra!.split(/\s+/)[0]);
    const w = words.find((x) => x.t0 >= b.start - 0.05 && x.t0 < b.end && norm(x.w) === first);
    return { t0: w ? w.t0 : b.start, t1: b.end, text: o.palabra! };
  });
  const graphics = picked.filter(({ b, o }) => o.grafico && haveG.has(b.id)).map(({ b, o }) => ({ t0: b.start, t1: b.end, id: b.id, region: o.grafico!.region }));
  // destellos: solo en transiciones (cambio de layout), nunca a mitad de toma; cine → quemados al entrar/salir del negro
  const flashes: TL["flashes"] = [{ t: 0, kind: st === "cine" ? "burn" : "white" }];
  for (let k = 1; k < layouts.length; k++) {
    const a = layouts[k - 1].kind, b = layouts[k].kind, t = layouts[k].t0;
    if (a === b) continue;
    if (st === "cine" && (a === "negro" || b === "negro")) flashes.push({ t, kind: "burn" });
    else if (st !== "cine" && t - flashes.at(-1)!.t > 4 && (b === "split" || a === "split")) flashes.push({ t, kind: "white" });
  }
  return { style: st, pal, face, layouts, captions, big, graphics, flashes };
}

/** Zoom por tramos: arranque 120 % → 100 %, empuje lento en la cara, punch-ins en cortes alternos y en palabras grandes. */
function zoomExpr(beats: RBeats) {
  const st = beats.estilo;
  const parts: string[] = [];
  beats.beats.forEach((b, i) => {
    const o = b.opts["ABC".indexOf(b.pick)];
    const d = Math.max(0.1, b.end - b.start);
    let z = `1+0.04*(t-${b.start.toFixed(3)})/${d.toFixed(3)}`;
    if (o.layout === "grande") z = "1.10";
    else if (o.punch || (st !== "cine" && i % 2 === 1)) z = `1.12+0.02*(t-${b.start.toFixed(3)})/${d.toFixed(3)}`;
    if (st === "cine" && o.layout !== "grande") z = `1+0.02*(t-${b.start.toFixed(3)})/${d.toFixed(3)}`;
    parts.push(`between(t,${b.start.toFixed(3)},${b.end.toFixed(3)})*(${z})`);
  });
  const base = `(${parts.join("+") || "1"})`;
  return `if(lt(t,1.2),max(${base},1.2-0.2*(t/1.2)),${base})`;   // arranque 120 % que se asienta
}

/** Diseño sonoro con el kit hecho en código: transiciones, clics en palabras clave, pops en gráficos; sin repetir en 2 s. */
function sonidos(tl: TL) {
  const ev: { t: number; f: string; db: number }[] = [];
  for (let k = 1; k < tl.layouts.length; k++) {
    const a = tl.layouts[k - 1].kind, b = tl.layouts[k].kind, t = tl.layouts[k].t0;
    if (a === b) continue;
    if (b === "negro") ev.push({ t, f: "shutter", db: -22 });
    else if (b === "grande") ev.push({ t, f: "bloom", db: -24 });
    else if (b === "split") ev.push({ t, f: "pop", db: -28 });
  }
  for (const g of tl.graphics) ev.push({ t: g.t0 + 0.05, f: "gui", db: -30 });
  for (const c of tl.captions) if (c.keys.length) ev.push({ t: c.words.find((w) => c.keys.includes(w.i))!.t, f: "click", db: -27 });
  ev.sort((a, b) => a.t - b.t);
  const out: typeof ev = [];
  for (const e of ev) {
    if (out.some((x) => Math.abs(x.t - e.t) < 0.15)) continue;                 // un sonido por momento
    if (out.some((x) => x.f === e.f && e.t - x.t < 2)) continue;              // sin repetir el mismo en 2 s
    out.push(e);
  }
  return out.filter((e) => existsSync(join(SFX, `${e.f}.wav`)));
}

/** Construir: gráficos → capa HTML cuadro a cuadro sobre la base de FFmpeg → sonido y mezcla. */
export async function reelBuild(project: string, beats: RBeats, log: string[], step: (i: number) => void, provider: ProviderId, palette?: Record<string, string>) {
  const dir = reelDir(project);
  const words = JSON.parse(readFileSync(join(dir, "work/words.json"), "utf8")) as Word[];
  const face = JSON.parse(readFileSync(join(dir, "work/face.json"), "utf8"));
  const pal = {
    accent: palette?.vibrant_bright ?? "#F5B942", dark: palette?.vibrant_dark ?? "#5a2d0c",
    white: palette?.dull_white ?? "#f4f1ec", black: palette?.dull_black ?? "#0d0d10", key: palette?.highlight ?? palette?.vibrant_bright ?? "#F5B942",
  };
  step(4);
  const gfile = join(dir, "work/graphics.json");
  const G = existsSync(gfile) ? JSON.parse(readFileSync(gfile, "utf8")) as Record<string, string> : await writeGraphics(provider, beats, words, pal, log);
  writeFileSync(gfile, JSON.stringify(G, null, 1));
  const tl = timeline(beats, words, face, pal, new Set(Object.keys(G)));
  writeFileSync(join(dir, "work/timeline.json"), JSON.stringify(tl, null, 1));

  step(5);
  const meta = JSON.parse(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "json", join(dir, "work/base.mp4")]).toString());
  const dur = Number(meta.format.duration);
  const n = Math.round(dur * 30);
  // base: zoom por tramos + estilo (+ persona en la mitad de abajo en los tramos divididos)
  const Z = zoomExpr(beats);
  const fy = Math.min(0.6, Math.max(0.2, face.y)).toFixed(2);
  let vf = `[0:v]scale=w='trunc(1080*(${Z})/2)*2':h='trunc(1920*(${Z})/2)*2':eval=frame,crop=1080:1920:'(iw-1080)/2':'(ih-1920)*${fy}',setsar=1`;
  if (beats.estilo === "cine") vf += ",hue=s=0,eq=contrast=1.12:brightness=-0.05,vignette=PI/4.5,noise=alls=10:allf=t";
  vf += "[b]";
  const splits = tl.layouts.filter((l) => l.kind === "split");
  let last = "b";
  if (splits.length) {
    const y = Math.round(Math.min(960, Math.max(0, face.y * 1920 - 380)));
    const en = splits.map((l) => `between(t,${l.t0.toFixed(3)},${l.t1.toFixed(3)})`).join("+");
    vf += `;[b]split[b1][b2];[b2]crop=1080:960:0:${y}[sp];[b1][sp]overlay=0:960:enable='${en}'[bs]`;
    last = "bs";
  }
  vf += `;[${last}][1:v]overlay=0:0:format=auto[v]`;
  // capa: Chromium dibuja cada cuadro (transparente) y lo pasa a FFmpeg por una tubería
  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ args: ["--allow-file-access-from-files"] });
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
  await page.goto(pathToFileURL(join(REELS, "emperador/overlay.html")).href);
  await page.evaluate(({ tl, G }) => {
    const w = window as unknown as { TL: unknown; G: Record<string, unknown> };
    w.TL = tl; w.G = {};
    for (const [id, body] of Object.entries(G)) { try { w.G[id] = new Function("ctx", "t", "w", "h", "pal", "ease", "dur", body as string); } catch { /* se salta */ } }
  }, { tl, G });
  await page.evaluate(() => (window as unknown as { ready: Promise<unknown> }).ready);
  const { PassThrough } = await import("node:stream");
  const pipe = new PassThrough();
  const render = ff(["-i", join(dir, "work/base.mp4"), "-f", "image2pipe", "-framerate", "30", "-c:v", "png", "-i", "-", "-filter_complex", vf, "-map", "[v]", "-an", "-frames:v", String(n), "-c:v", "libx264", "-crf", "17", "-preset", "medium", "-pix_fmt", "yuv420p", join(dir, "work/picture.mp4")], log, pipe);
  let dead: Error | null = null;
  render.catch((e) => { dead = e; });
  for (let i = 0; i < n && !dead; i++) {
    const b64 = await page.evaluate((t) => { (window as unknown as { renderAt: (t: number) => void }).renderAt(t); return (document.getElementById("c") as HTMLCanvasElement).toDataURL("image/png").split(",")[1]; }, i / 30);
    if (!pipe.write(Buffer.from(b64, "base64"))) await Promise.race([new Promise((r) => pipe.once("drain", r)), render.catch(() => null)]);
    if (i % 150 === 0) log.push(`  cuadro ${i}/${n}`);
  }
  const errs = await page.evaluate(() => (window as unknown as { errors: string[] }).errors);
  if (errs.length) log.push(`⚠ gráficos que fallaron al dibujar: ${errs.join(", ")}`);
  pipe.end();
  await browser.close();
  await render;

  step(6);
  const ev = sonidos(tl);
  writeFileSync(join(dir, "work/sonidos.json"), JSON.stringify(ev, null, 1));
  const ins = ev.flatMap((e) => ["-i", join(SFX, `${e.f}.wav`)]);
  const fx = ev.map((e, k) => `[${k + 1}:a]adelay=${Math.round(e.t * 1000)}|${Math.round(e.t * 1000)},volume=${e.db}dB[s${k}]`);
  const mix = `${fx.join(";")}${fx.length ? ";" : ""}[0:a]volume=1[vo];[vo]${ev.map((_, k) => `[s${k}]`).join("")}amix=inputs=${ev.length + 1}:normalize=0:duration=first,loudnorm=I=-14:TP=-1:LRA=11[a]`;
  await ff(["-i", join(dir, "work/base.mp4"), ...ins, "-filter_complex", mix, "-map", "[a]", "-ar", "48000", join(dir, "work/mix.wav")], log);
  await ff(["-i", join(dir, "work/picture.mp4"), "-i", join(dir, "work/mix.wav"), "-map", "0:v", "-map", "1:a", "-c:v", "copy", "-c:a", "aac", "-b:a", "256k", "-movflags", "+faststart", "-shortest", join(dir, `out/${project}.mp4`)], log);
  // hoja de contacto para revisar
  await ff(["-i", join(dir, `out/${project}.mp4`), "-vf", "fps=1,scale=180:-2,tile=8x6", "-frames:v", "1", join(dir, "out/hoja.jpg")], log);
  return { scenes: tl.layouts.length, graficos: Object.keys(G).length, sonidos: ev.length };
}

export function reelStatus(project: string) {
  const dir = reelDir(project);
  const files: string[] = [];
  for (const d of ["out"]) { const full = join(dir, d); if (existsSync(full)) for (const f of readdirSync(full)) if (statSync(join(full, f)).isFile()) files.push(`${d}/${f}`); }
  return { name: project, files, approved: false };
}

export function reelPath(project: string, rel: string) {
  const base = reelDir(project);
  const full = resolve(base, normalize(rel));
  if (relative(base, full).startsWith("..") || !/\.(mp4|jpg|png|md|json)$/.test(full)) throw new Error("Ruta no permitida");
  return full;
}

export const reelEstilo = (variante: string): Estilo => (/split/.test(variante) ? "split" : /cine/.test(variante) ? "cine" : "cara");
