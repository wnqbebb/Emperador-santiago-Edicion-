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
import { runVes, waitVes, VES, projectStatus } from "./ves.js";
import { planBeats, type Beats, type PlanOpts } from "./beats.js";
import { writeMotionHtml, renderMotionHtml } from "./motion.js";
import type { ProviderId } from "./providers/index.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const PY = join(ROOT, "tools/.venv/bin/python");

// Plantillas = familias de estilo (Arthur Brooks, Imperial Santi y las que vengan) con sus variantes (formatos)
export type Variante = { id: string; name: string; description: string; vesStyle?: string; styleId?: string; preview?: string; ideal?: string; recomendada?: boolean };
export type Familia = { id: string; name: string; description: string; motor: "ves" | "rapido"; skill?: string; preview?: string; variantes: Variante[] };
export const familias = (): Familia[] => JSON.parse(readFileSync(join(ROOT, "plantillas/plantillas.json"), "utf8")).familias;
export type Plantilla = Variante & { motor: "ves" | "rapido"; familia: string; familiaName: string };
export const plantillas = (): Plantilla[] => familias().flatMap((f) => f.variantes.map((v) => ({ ...v, motor: f.motor, familia: f.id, familiaName: f.name, preview: v.preview || f.preview })));

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
};

export type FlujoJob = {
  id: string; project: string; plantilla: string; status: "running" | "tablero" | "review" | "error";
  step: string; steps: string[]; current: number; log: string[]; error?: string; beats?: number; scenes?: number; assets?: number; originales?: number;
  provider: ProviderId; respuestas: Respuestas; vesStyle: string;
};
const jobs = new Map<string, FlujoJob>();
// El flujo se guarda en el proyecto: si el bridge se reinicia, se retoma donde iba
function save(job: FlujoJob) { try { writeFileSync(join(dirOf(job.project), "flujo.json"), JSON.stringify(job)); } catch { /* aún sin carpeta */ } }
export function getFlujo(id: string) {
  if (jobs.has(id)) return jobs.get(id);
  const root = join(VES, "projects");
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
const fail = (job: FlujoJob) => (e: unknown) => { job.status = "error"; job.error = (e as Error).message; save(job); };

const STEPS = ["Preparando el proyecto", "Transcribiendo y cortando a 30 ms", "Tu IA propone los beats A/B/C", "Tablero de preedición (tú eliges)", "Motion graphics originales", "Subtítulos, validación y storyboard", "Borrador con sonido"];
const dirOf = (p: string) => join(VES, "projects", p);

async function step(job: FlujoJob, i: number, cmds: { script: Parameters<typeof runVes>[0]; args: string[] }[]) {
  job.current = i; job.step = STEPS[i]; save(job);
  for (const c of cmds) {
    const j = await waitVes(runVes(c.script, c.args));
    job.log.push(`$ ${j.cmd}`, ...j.log.slice(-6));
    job.log = job.log.slice(-60);
    if (j.status === "error") throw new Error(`${j.cmd}: ${j.log.slice(-3).join(" ")}`);
  }
}

export function startFlujo(args: { videoPath: string; plantilla: string; provider: ProviderId; name?: string; respuestas: Respuestas; brollFiles?: { path: string; desc: string }[] }) {
  const p = plantillas().find((x) => x.id === args.plantilla);
  if (!p || p.motor !== "ves" || !p.vesStyle) throw new Error("Plantilla desconocida o no es del motor VES");
  const project = (args.name ?? `video-${new Date().toISOString().slice(5, 16).replace(/[-:T]/g, "")}`).replace(/[^\w.-]/g, "-");
  const job: FlujoJob = { id: randomUUID().slice(0, 8), project, plantilla: p.id, status: "running", step: STEPS[0], steps: STEPS, current: 0, log: [], provider: args.provider, respuestas: args.respuestas, vesStyle: p.vesStyle };
  jobs.set(job.id, job);
  (async () => {
    await step(job, 0, [{ script: "ves", args: ["new", project, "--video", args.videoPath, "--style", p.vesStyle!] }]);
    await step(job, 1, [{ script: "ves", args: ["all", project, "--lang", "es"] }]);
    const dir = dirOf(project);
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
function autofix(project: string, vesStyle: string) {
  const dir = dirOf(project);
  const style = JSON.parse(readFileSync(join(VES, "styles", vesStyle, "style.json"), "utf8"));
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
  const po: PlanOpts = { energia: r.energia, originales: r.originales, broll: r.broll, notas: r.notas, palette: r.palette };
  const beats = await planBeats(job.provider, job.vesStyle, job.project, po);
  const dir = dirOf(job.project);
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
  const dir = dirOf(job.project);
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
  autofix(job.project, job.vesStyle);
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
  const f = join(dirOf(job.project), "out/panel/panel_data.json");
  const beats = JSON.parse(readFileSync(join(dirOf(job.project), "beats.json"), "utf8"));
  const thumbs = existsSync(f) ? JSON.parse(readFileSync(f, "utf8")).thumbs : {};
  return { beats, thumbs };
}

export const flujoFiles = (job: FlujoJob) => projectStatus(job.project);
