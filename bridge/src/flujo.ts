// Flujo de plantillas: clip en bruto (ya unido y sin silencios) + plantilla de estilo → edición.
// Etapas (siguiendo el método: plan → assets → vista previa):
//   1. Preparar: proyecto VES, transcripción y corte a 30 ms, paleta DEL PROPIO VIDEO.
//   2. Plan: la IA propone beats A/B/C (inspirados en la biblioteca, con originales) → TABLERO DE PREEDICIÓN (STOP 1).
//   3. Construir: aplica tus elecciones, genera los motion graphics originales, lista de assets,
//      subtítulos, validación, storyboard y BORRADOR con sonido. El final solo con tu aprobación (STOP 3).
import { readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { runVes, waitVes, projectStatus, skillSystem } from "./ves.js";
import { planBeats, type Beats, type PlanOpts } from "./beats.js";
import { KAL_SKILL, type KBeats, type Fuente } from "./beats_kal.js";
import { writeMotionHtml, renderMotionHtml } from "./motion.js";
import type { ProviderId } from "./providers/index.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const PY = join(ROOT, "tools/.venv/bin/python");

// Plantillas = familias de estilo (Arthur Brooks, Imperial Santi y las que vengan) con sus variantes (formatos)
export type Variante = { id: string; name: string; description: string; enfoque?: string; vesStyle?: string; styleId?: string; preview?: string; ideal?: string; recomendada?: boolean };
export type Familia = { id: string; name: string; description: string; motor: "ves" | "rapido"; skill?: string; preview?: string; paletaEstilo?: Record<string, string>; preguntaFuentes?: boolean; variantes: Variante[] };
export const familias = (): Familia[] => JSON.parse(readFileSync(join(ROOT, "plantillas/plantillas.json"), "utf8")).familias;
export type Plantilla = Variante & { motor: "ves" | "rapido"; familia: string; familiaName: string; skill?: string };
export const plantillas = (): Plantilla[] => familias().flatMap((f) => f.variantes.map((v) => ({ ...v, motor: f.motor, familia: f.id, familiaName: f.name, skill: f.skill, preview: v.preview || f.preview })));
/** Skills con motor VES propio (cada una guarda sus proyectos en su system/projects). */
const skills = () => [...new Set(familias().filter((f) => f.motor === "ves").map((f) => f.skill))];

/** Paleta del propio video: 3–6 opciones medidas para que subtítulos y gráficos resalten. */
export function paletaDeVideo(video: string, outDir: string) {
  execFileSync(PY, [join(ROOT, "tools/paleta.py"), video, outDir], { stdio: "ignore" });
  return JSON.parse(readFileSync(join(outDir, "paleta.json"), "utf8")) as { options: { name: string; from: string; colors: Record<string, string>; caption: string; recommended?: boolean }[] };
}

export type Respuestas = {
  energia: "calma" | "media" | "viral";
  texturas: number;                // 0 limpio · 0.4 suave · 1 como Arthur
  palette?: Record<string, string>;
  originales: boolean;
  broll: { path: string; desc: string }[]; // ya copiado al proyecto
  rapido?: boolean;                // saltar el tablero y usar las recomendaciones
  notas?: string;
  fuentes?: string[];              // Kallaway: enlaces de la noticia/producto → capturas reales para la mitad superior
};

export type FlujoJob = {
  id: string; project: string; plantilla: string; status: "running" | "tablero" | "review" | "error";
  step: string; steps: string[]; current: number; log: string[]; error?: string; beats?: number; scenes?: number; assets?: number; originales?: number;
  provider: ProviderId; respuestas: Respuestas; vesStyle: string; skill?: string; evidencia?: Fuente[];
};
const jobs = new Map<string, FlujoJob>();
// El flujo se guarda en el proyecto: si el bridge se reinicia, se retoma donde iba
function save(job: FlujoJob) { try { writeFileSync(join(dirOf(job), "flujo.json"), JSON.stringify(job)); } catch { /* aún sin carpeta */ } }
export function getFlujo(id: string) {
  if (jobs.has(id)) return jobs.get(id);
  for (const sk of skills()) {
  const root = join(skillSystem(sk), "projects");
  for (const p of existsSync(root) ? readdirSync(root) : []) {
    const f = join(root, p, "flujo.json");
    if (!existsSync(f)) continue;
    const j = JSON.parse(readFileSync(f, "utf8")) as FlujoJob;
    if (j.id !== id) continue;
    if (j.status === "running") { j.status = "error"; j.error = "El sistema se reinició a mitad de camino. Pulsa Reintentar."; }
    jobs.set(id, j);
    return j;
  }
  }
}
const fail = (job: FlujoJob) => (e: unknown) => { job.status = "error"; job.error = (e as Error).message; save(job); };

const STEPS = ["Preparando el proyecto", "Transcribiendo y cortando a 30 ms", "Tu IA propone los beats A/B/C", "Tablero de preedición (tú eliges)", "Motion graphics originales", "Subtítulos, validación y storyboard", "Borrador con sonido"];
const dirOf = (job: Pick<FlujoJob, "project" | "skill">) => join(skillSystem(job.skill), "projects", job.project);
const isKal = (job: FlujoJob) => job.skill === KAL_SKILL;

async function step(job: FlujoJob, i: number, cmds: { script: Parameters<typeof runVes>[0]; args: string[] }[]) {
  job.current = i; job.step = STEPS[i]; save(job);
  for (const c of cmds) {
    const j = await waitVes(runVes(c.script, c.args, isKal(job) ? { VES_STYLE: "kallaway" } : {}, job.skill));
    job.log.push(`$ ${j.cmd}`, ...j.log.slice(-6));
    job.log = job.log.slice(-60);
    if (j.status === "error") throw new Error(`${j.cmd}: ${j.log.slice(-3).join(" ")}`);
  }
}

export function startFlujo(args: { videoPath: string; plantilla: string; provider: ProviderId; name?: string; respuestas: Respuestas; brollFiles?: { path: string; desc: string }[] }) {
  const p = plantillas().find((x) => x.id === args.plantilla);
  if (!p || p.motor !== "ves" || !p.vesStyle) throw new Error("Plantilla desconocida o no es del motor VES");
  const project = (args.name ?? `video-${new Date().toISOString().slice(5, 16).replace(/[-:T]/g, "")}`).replace(/[^\w.-]/g, "-");
  const job: FlujoJob = { id: randomUUID().slice(0, 8), project, plantilla: p.id, status: "running", step: STEPS[0], steps: STEPS, current: 0, log: [], provider: args.provider, respuestas: args.respuestas, vesStyle: p.vesStyle, skill: p.skill };
  jobs.set(job.id, job);
  (async () => {
    await step(job, 0, [{ script: "ves", args: ["new", project, "--video", args.videoPath, "--style", p.vesStyle!] }]);
    await step(job, 1, [{ script: "ves", args: ["all", project, "--lang", "es"] }]);
    const dir = dirOf(job);
    // Kallaway: las fuentes que pegó Santiago → capturas reales (1080×940) para la mitad superior
    if (isKal(job)) {
      job.evidencia = [];
      const urls = (job.respuestas.fuentes ?? []).filter((u) => /^https?:\/\//.test(u)).slice(0, 8);
      for (const [i, url] of urls.entries()) {
        const id = `E${String(i + 1).padStart(2, "0")}`;
        const j = await waitVes(runVes("evidence", ["shot", project, url, "--id", id], {}, job.skill));
        const ok = j.status === "done" && existsSync(join(dir, `media/evidence/${id}.png`));
        job.log.push(ok ? `✓ captura ${id}: ${url}` : `⚠ no se pudo capturar ${url}`);
        if (ok) job.evidencia.push({ id, url, path: `media/evidence/${id}.png`, title: (j.log.join(" ").match(/\((.*)\)\s*$/)?.[1] ?? url).slice(0, 120) });
      }
      save(job);
    }
    // paleta del propio video (la elegida en las preguntas o la que más resalta)
    const pal = job.respuestas.palette ?? paletaDeVideo(join(dir, "media/raw_cut.mp4"), join(dir, "_paleta")).options[0]?.colors;
    if (pal) writeFileSync(join(dir, "palette.json"), JSON.stringify({ source: "emperador:video", colors: pal, options: [pal] }, null, 1));
    // b-roll de Santiago → dentro del proyecto
    const broll = (args.brollFiles ?? []).map((b, i) => {
      const rel = `media/broll/B${String(i + 1).padStart(2, "0")}${b.path.match(/\.\w+$/)?.[0] ?? ".mp4"}`;
      mkdirSync(join(dir, "media/broll"), { recursive: true });
      copyFileSync(b.path, join(dir, rel));
      return { path: rel, desc: b.desc };
    });
    job.respuestas = { ...job.respuestas, palette: pal, broll };
    await plan(job);
  })().catch(fail(job));
  return job;
}

/** Ajustes automáticos antes de validar: escenas más cortas que el mínimo del estilo se alargan hasta la
 *  siguiente o se quitan (queda la cara); nada pasa del final del video. */
function autofix(job: FlujoJob) {
  const dir = dirOf(job);
  const style = JSON.parse(readFileSync(join(skillSystem(job.skill), "styles", job.vesStyle, "style.json"), "utf8"));
  const min = (style.pacing?.min_scene_s ?? 0.8) + 0.02;
  const meta = JSON.parse(readFileSync(join(dir, "project.json"), "utf8"));
  const dur = (meta.cut_probe ?? meta.probe).duration;
  const plan = JSON.parse(readFileSync(join(dir, "edit_plan.json"), "utf8"));
  const sc = [...plan.scenes].sort((a: { start: number }, b: { start: number }) => a.start - b.start);
  const out = [];
  for (let i = 0; i < sc.length; i++) {
    const s = sc[i], next = sc[i + 1];
    s.end = Math.min(s.end, dur);
    if (s.end - s.start < min) s.end = Math.min(dur, next ? Math.max(s.end, Math.min(s.start + min, next.start)) : s.start + min);
    if (s.end - s.start >= min - 0.02) out.push(s);
  }
  plan.scenes = out;
  writeFileSync(join(dir, "edit_plan.json"), JSON.stringify(plan, null, 1));
}

async function plan(job: FlujoJob) {
  job.status = "running"; job.current = 2; job.step = STEPS[2];
  const r = job.respuestas;
  const enfoque = plantillas().find((x) => x.id === job.plantilla)?.enfoque;
  const po: PlanOpts = { energia: r.energia, originales: r.originales, broll: r.broll, notas: [enfoque, r.notas].filter(Boolean).join("\n") || undefined, palette: r.palette, fuentes: job.evidencia };
  const beats = await planBeats(job.provider, job.vesStyle, job.project, po, job.skill);
  const dir = dirOf(job);
  writeFileSync(join(dir, "beats.json"), JSON.stringify(beats, null, 1));
  job.beats = beats.beats.length; job.assets = beats.assets?.length ?? 0;
  writeFileSync(join(dir, "edit_plan.json"), JSON.stringify({
    version: 1, style: job.vesStyle, source: { video: "media/raw_cut.mp4", captions: "captions.json" },
    palette: r.palette ?? null, texture_amount: r.texturas, scenes: [], assets: beats.assets ?? [],
    captions: { enabled: true, hide_during: ["fullscreen"] }, music: { file: null, volume: 0.16 },
  }, null, 1));
  await step(job, 3, [{ script: "beats", args: ["panel", job.project, "--out", `projects/${job.project}/out/panel`] }]);
  if (r.rapido) return build(job, {});
  job.status = "tablero"; job.step = "Tablero de preedición: elige A/B/C en cada beat"; save(job);
}

/** Santiago eligió en el tablero (o "usar recomendaciones"): construir hasta el borrador. */
async function build(job: FlujoJob, picks: Record<string, string>) {
  job.status = "running";
  const dir = dirOf(job);
  if (isKal(job)) return buildKal(job, picks);
  const beats = JSON.parse(readFileSync(join(dir, "beats.json"), "utf8")) as Beats;
  for (const b of beats.beats) if (picks[b.id]) b.pick = picks[b.id] as "A" | "B" | "C";
  // motion graphics originales: la IA los escribe para HyperFrames en la paleta del video y se renderizan
  job.current = 4; job.step = STEPS[4]; job.originales = 0;
  const words = JSON.parse(readFileSync(join(dir, "transcript_cut.json"), "utf8")).words as { w: string; start: number; end: number }[];
  for (const b of beats.beats) {
    const o = b.opts["ABC".indexOf(b.pick)];
    if (o?.type !== "mg_original" || (o.props as { media?: string })?.media) continue;
    const secs = Math.max(1.5, b.end - b.start);
    const said = words.filter((w) => w.start >= b.start && w.start < b.end).map((w) => `${(w.start - b.start).toFixed(2)}s ${w.w}`).join(" · ");
    const pal = job.respuestas.palette ?? {};
    const brief = `Motion graphic ORIGINAL vertical de ${secs.toFixed(2)} s para un video de redes estilo premium minimal (inspirado en Arthur Brooks, pero NUEVO).
Idea: ${(o.props as { brief?: string })?.brief ?? o.desc ?? b.script}
Lo que se dice (sincroniza los textos a estas palabras, tiempos desde 0): ${said}
Paleta del video (úsala, nada de azul por defecto): acento ${pal.vibrant_bright}, acento oscuro ${pal.vibrant_dark}, papel ${pal.dull_white}, negro ${pal.dull_black}.
Tipografía: Playfair Display itálica bold para la palabra clave, Inter para el resto. Textos cortos y grandes, centrados.
Que sea dinámico y viral: algo se mueve todo el tiempo, entrada fuerte en el primer cuarto de segundo, sin texturas pesadas.`;
    const { motionBrief } = await import("./motion.js");
    const fondo = `el que mejor sirva a la idea entre papel ${pal.dull_white}, acento ${pal.vibrant_bright} o negro ${pal.dull_black}`;
    const html = await writeMotionHtml(job.provider, motionBrief(brief, Math.round(secs * 100) / 100, { caption: { highlight: pal.vibrant_bright ?? "#E9B949" } } as never, fondo));
    const m = await renderMotionHtml(html, Math.round(secs * 100) / 100);
    const rel = `media/mg/${b.id}.mp4`;
    mkdirSync(join(dir, "media/mg"), { recursive: true });
    copyFileSync(join(dirname(m.projectDir), `${m.id}.mp4`), join(dir, rel));
    o.props = { ...(o.props ?? {}), media: rel };
    job.originales++;
  }
  writeFileSync(join(dir, "beats.json"), JSON.stringify(beats, null, 1));
  const allPicks = Object.fromEntries(beats.beats.map((b) => [b.id, b.pick]));
  const picksFile = join(dir, "picks.json");
  writeFileSync(picksFile, JSON.stringify({ picks: { [job.project]: allPicks } }));
  await step(job, 5, [{ script: "beats", args: ["apply", job.project, "--picks", picksFile] }]);
  autofix(job);
  await step(job, 5, [
    ...(job.assets ? [{ script: "assets" as const, args: [job.project] }] : []),
    { script: "ves", args: ["captions", job.project] },
    { script: "ves", args: ["captionsheet", job.project] },
    { script: "ves", args: ["validate", job.project] },
    { script: "ves", args: ["storyboard", job.project] },
  ]);
  job.scenes = JSON.parse(readFileSync(join(dir, "edit_plan.json"), "utf8")).scenes.length;
  await step(job, 6, [
    { script: "ves", args: ["render", job.project, "--draft"] },
    { script: "ves", args: ["sound", job.project, "--draft"] },
  ]);
  job.current = STEPS.length; job.step = "Borrador listo para revisar"; job.status = "review"; save(job);
}

/** Kallaway: originales en la mitad superior (1080×940), cara medida, revisión de reglas y borrador. */
async function buildKal(job: FlujoJob, picks: Record<string, string>) {
  const dir = dirOf(job);
  const beats = JSON.parse(readFileSync(join(dir, "beats.json"), "utf8")) as KBeats;
  for (const b of beats.beats) if (picks[b.id]) b.pick = picks[b.id] as "A" | "B" | "C";
  job.current = 4; job.step = STEPS[4]; job.originales = 0; save(job);
  const words = JSON.parse(readFileSync(join(dir, "transcript_cut.json"), "utf8")).words as { w: string; start: number; end: number }[];
  const pal = job.respuestas.palette ?? {};
  const { motionBrief } = await import("./motion.js");
  for (const b of beats.beats) for (const [i, s] of b.opts["ABC".indexOf(b.pick)].scenes.entries()) {
    const top = s.props?.top;
    if (!top?.original || top.media?.length) continue;
    const secs = Math.round(Math.max(0.8, s.end - s.start) * 100) / 100;
    const said = words.filter((w) => w.start >= s.start && w.start < s.end).map((w) => `${(w.start - s.start).toFixed(2)}s ${w.w}`).join(" · ");
    const brief = `Motion graphic ORIGINAL de ${secs} s para la MITAD SUPERIOR de un reel estilo Kallaway (la cara va debajo, no la dibujes).
Idea: ${top.original}
Lo que se dice (sincroniza a estas palabras, tiempos desde 0): ${said}
Paleta: resaltado ${pal.highlight ?? pal.vibrant_bright}, franja ${pal.vibrant_dark}, blanco ${pal.dull_white}, fondo casi negro ${pal.dull_black}.
Look Kallaway: Inter 900, sólidos planos, cifras gigantes amarillas, etiquetas con borde negro, flechas amarillas. Sin texturas, sin degradados decorativos.
Que se lea en el teléfono y algo cambie cada 0.6–1 s; entrada fuerte en el primer cuarto de segundo.`;
    try {
      const html = await writeMotionHtml(job.provider, motionBrief(brief, secs, { caption: { highlight: pal.highlight ?? pal.vibrant_bright ?? "#F5B942" } } as never, pal.dull_black ?? "#0B0B0D", { w: 1080, h: 940 }));
      const m = await renderMotionHtml(html, secs);
      const rel = `media/mg/${b.id}s${i}.mp4`;
      mkdirSync(join(dir, "media/mg"), { recursive: true });
      copyFileSync(join(dirname(m.projectDir), `${m.id}.mp4`), join(dir, rel));
      top.media = [rel]; job.originales++;
    } catch (e) {
      job.log.push(`⚠ original ${b.id}: ${(e as Error).message.slice(0, 160)}`);
      top.placeholder ??= String(top.original).slice(0, 40);
    }
    save(job);
  }
  writeFileSync(join(dir, "beats.json"), JSON.stringify(beats, null, 1));
  const picksFile = join(dir, "picks.json");
  writeFileSync(picksFile, JSON.stringify({ picks: { [job.project]: Object.fromEntries(beats.beats.map((b) => [b.id, b.pick])) } }));
  await step(job, 5, [
    { script: "beats", args: ["apply", job.project, "--picks", picksFile] },
    { script: "kal", args: ["face", job.project] },
  ]);
  autofix(job);
  await step(job, 5, [
    ...(job.assets ? [{ script: "assets" as const, args: [job.project] }] : []),
    { script: "ves", args: ["captions", job.project] },
    { script: "ves", args: ["captionsheet", job.project] },
    { script: "ves", args: ["validate", job.project] },
    { script: "ves", args: ["storyboard", job.project] },
    { script: "kal", args: ["check", job.project] },
  ]);
  job.scenes = JSON.parse(readFileSync(join(dir, "edit_plan.json"), "utf8")).scenes.length;
  await step(job, 6, [
    { script: "ves", args: ["render", job.project, "--draft", "--force"] },
    { script: "ves", args: ["sound", job.project, "--draft"] },
  ]);
  job.current = STEPS.length; job.step = "Borrador listo para revisar"; job.status = "review"; save(job);
}

export function elegir(id: string, picks: Record<string, string>) {
  const job = getFlujo(id);
  if (!job) throw new Error("No existe ese flujo");
  if (job.status === "running") throw new Error("Este flujo todavía está trabajando");
  job.error = undefined;
  build(job, picks).catch(fail(job));
  return job;
}

/** Volver a planificar (otra propuesta de beats) con respuestas nuevas. */
export function replanificar(id: string, cambios: Partial<Respuestas>) {
  const job = getFlujo(id);
  if (!job) throw new Error("No existe ese flujo");
  job.respuestas = { ...job.respuestas, ...cambios };
  plan(job).catch(fail(job));
  return job;
}

export function tablero(id: string) {
  const job = getFlujo(id);
  if (!job) throw new Error("No existe ese flujo");
  const f = join(dirOf(job), "out/panel/panel_data.json");
  const beats = JSON.parse(readFileSync(join(dirOf(job), "beats.json"), "utf8"));
  const thumbs = existsSync(f) ? JSON.parse(readFileSync(f, "utf8")).thumbs : {};
  return { beats, thumbs };
}

export const flujoFiles = (job: FlujoJob) => projectStatus(job.project, job.skill);

/** Cuadro real del video en un segundo (para "quedarse en la cara" en el tablero). */
export function cuadro(id: string, t: number) {
  const job = getFlujo(id);
  if (!job) throw new Error("No existe ese flujo");
  const dir = join(dirOf(job), "_cuadros");
  mkdirSync(dir, { recursive: true });
  const f = join(dir, `${t.toFixed(1)}.jpg`);
  if (!existsSync(f)) execFileSync("ffmpeg", ["-v", "error", "-y", "-ss", t.toFixed(2), "-i", join(dirOf(job), "media/raw_cut.mp4"), "-frames:v", "1", "-vf", "scale=180:-2", "-q:v", "4", f]);
  return f;
}
