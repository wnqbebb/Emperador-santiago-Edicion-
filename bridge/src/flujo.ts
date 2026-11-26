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
import { planBeats, ask, extract, beatsPrompt, sanitize, type Beats, type PlanOpts } from "./beats.js";
import { REELS_DATA, REEL_STEPS, reelDir, reelPrepare, reelPlan, reelBuild, reelStatus, reelEstilo, reelPrompt, reelSanitize, type RBeats } from "./reels.js";
import { pc, SKY_DATA, skyDir, skyPrepare, injectPalette, skyPrompt, skySanitize, skyBuild, skyStatus, skyBroll, type SBeats } from "./skylight.js";
import { isSceneSkill, sceneCfg, kalPrompt, sanitizeKal, type KBeats, type Fuente } from "./beats_kal.js";
import { writeMotionHtml, renderMotionHtml } from "./motion.js";
import { presets as presetsSubs, muestra, subtitular, type Palabra } from "./subtitulos.js";
import { pluginsPrompt, revisar, leerEfectos, aplicarEfectos, type Revision } from "./plugins.js";
import type { ProviderId } from "./providers/index.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const PY = join(ROOT, "tools/.venv/bin/python");

// Plantillas = familias de estilo (Arthur Brooks, Imperial Santi y las que vengan) con sus variantes (formatos)
export type Variante = { id: string; name: string; description: string; enfoque?: string; vesStyle?: string; styleId?: string; preview?: string; ideal?: string; recomendada?: boolean };
export type Familia = { id: string; name: string; description: string; motor: "ves" | "rapido" | "skylight" | "reels"; skill?: string; preview?: string; paletaEstilo?: Record<string, string>; preguntaFuentes?: boolean; variantes: Variante[] };
export const familias = (): Familia[] => JSON.parse(readFileSync(join(ROOT, "plantillas/plantillas.json"), "utf8")).familias;
export type Plantilla = Variante & { motor: "ves" | "rapido" | "skylight" | "reels"; familia: string; familiaName: string; skill?: string };
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
  subtitulos?: string;             // preset de subtitulado que se aplica solo al terminar (opcional)
  fuentes?: string[];              // Kallaway: enlaces de la noticia/producto → capturas reales para la mitad superior
};

export type FlujoJob = {
  id: string; project: string; plantilla: string; status: "running" | "tablero" | "review" | "error";
  step: string; steps: string[]; current: number; log: string[]; error?: string; beats?: number; scenes?: number; assets?: number; originales?: number;
  provider: ProviderId; respuestas: Respuestas; vesStyle: string; skill?: string; evidencia?: Fuente[]; motor?: "ves" | "skylight" | "reels";
  prompts?: { status: "running" | "done" | "error"; base: "sugerencia" | "pedido"; pedido?: string; nuevos?: string[]; error?: string };
  revision?: Revision;   // Katana medido sobre el video terminado
  subtitulos?: { status: "running" | "done" | "error"; preset: string; video?: string; error?: string; paso?: string };
  efectos?: { status: "running" | "done" | "error"; texto: string; aplicados?: string[]; dudas?: string[]; video?: string; error?: string };
};
const jobs = new Map<string, FlujoJob>();
// El flujo se guarda en el proyecto: si el bridge se reinicia, se retoma donde iba
function save(job: FlujoJob) { try { writeFileSync(join(dirOf(job), "flujo.json"), JSON.stringify(job)); } catch { /* aún sin carpeta */ } }
export function getFlujo(id: string) {
  if (jobs.has(id)) return jobs.get(id);
  for (const root of [...skills().map((sk) => join(skillSystem(sk), "projects")), SKY_DATA, REELS_DATA]) {
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
const dirOf = (job: Pick<FlujoJob, "project" | "skill" | "motor">) => (job.motor === "skylight" ? skyDir(job.project) : job.motor === "reels" ? reelDir(job.project) : join(skillSystem(job.skill), "projects", job.project));
const isReel = (job: FlujoJob) => job.motor === "reels";
const isSky = (job: FlujoJob) => job.motor === "skylight";
const SKY_STEPS = ["Preparando el proyecto", "Palabras y cara arriba (9:16 con seguimiento)", "Tu IA propone los beats A/B/C", "Tablero de preedición (tú eliges)", "Imágenes libres (Wikimedia Commons)", "Plan: mundos, animaciones y subtítulos", "Render HyperFrames y mezcla"];
const isKal = (job: FlujoJob) => job.motor !== "skylight" && job.motor !== "reels" && isSceneSkill(job.skill);   // skills por escenas

async function step(job: FlujoJob, i: number, cmds: { script: Parameters<typeof runVes>[0]; args: string[] }[]) {
  job.current = i; job.step = STEPS[i]; save(job);
  for (const c of cmds) {
    const j = await waitVes(runVes(c.script, c.args, isKal(job) ? { VES_STYLE: sceneCfg(job.skill!).style } : {}, job.skill));
    job.log.push(`$ ${j.cmd}`, ...j.log.slice(-6));
    job.log = job.log.slice(-60);
    if (j.status === "error") throw new Error(`${j.cmd}: ${j.log.slice(-3).join(" ")}`);
  }
}

export function startFlujo(args: { videoPath: string; plantilla: string; provider: ProviderId; name?: string; respuestas: Respuestas; brollFiles?: { path: string; desc: string }[] }) {
  const p = plantillas().find((x) => x.id === args.plantilla);
  if (!p || (p.motor === "ves" && !p.vesStyle) || p.motor === "rapido") throw new Error("Plantilla desconocida o no es una edición por flujo");
  if (p.motor === "skylight") return startSky(p, args);
  if (p.motor === "reels") return startReel(p, args);
  const project = (args.name ?? `video-${new Date().toISOString().slice(5, 16).replace(/[-:T]/g, "")}`).replace(/[^\w.-]/g, "-");
  const job: FlujoJob = { id: randomUUID().slice(0, 8), project, plantilla: p.id, status: "running", step: STEPS[0], steps: STEPS, current: 0, log: [], provider: args.provider, respuestas: args.respuestas, vesStyle: p.vesStyle!, skill: p.skill };
  jobs.set(job.id, job);
  (async () => {
    await step(job, 0, [{ script: "ves", args: ["new", project, "--video", args.videoPath, "--style", p.vesStyle!] }]);
    await step(job, 1, [{ script: "ves", args: ["all", project, "--lang", "es"] }]);
    const dir = dirOf(job);
    // Skills por escenas: las fuentes que pegó Santiago → capturas reales (1080×940) para la mitad superior
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

/** Skylight: el clip completo → palabras, cara arriba con seguimiento, paleta; después el plan con la IA. */
function startSky(p: Plantilla, args: { videoPath: string; provider: ProviderId; name?: string; respuestas: Respuestas; brollFiles?: { path: string; desc: string }[] }) {
  const project = (args.name ?? `sky-${new Date().toISOString().slice(5, 16).replace(/[-:T]/g, "")}`).replace(/[^\w.-]/g, "-");
  const job: FlujoJob = { id: randomUUID().slice(0, 8), project, plantilla: p.id, status: "running", step: SKY_STEPS[0], steps: SKY_STEPS, current: 0, log: [], provider: args.provider, respuestas: args.respuestas, vesStyle: "", skill: p.skill, motor: "skylight" };
  jobs.set(job.id, job);
  (async () => {
    const dir = await skyPrepare(project, args.videoPath, job.log, (i) => { job.current = i; job.step = SKY_STEPS[i]; save(job); });
    const pal = job.respuestas.palette ?? paletaDeVideo(join(dir, "raw/podcast.mp4"), join(dir, "_paleta")).options[0]?.colors;
    injectPalette(dir, pal);
    const broll = skyBroll(project, args.brollFiles ?? []);
    job.respuestas = { ...job.respuestas, palette: pal, broll };
    await plan(job);
  })().catch(fail(job));
  return job;
}

/** Reels Instagram: clip a 1080×1920, palabras y cara; después el plan con la IA. */
function startReel(p: Plantilla, args: { videoPath: string; provider: ProviderId; name?: string; respuestas: Respuestas }) {
  const project = (args.name ?? `reel-${new Date().toISOString().slice(5, 16).replace(/[-:T]/g, "")}`).replace(/[^\w.-]/g, "-");
  const job: FlujoJob = { id: randomUUID().slice(0, 8), project, plantilla: p.id, status: "running", step: REEL_STEPS[0], steps: REEL_STEPS, current: 0, log: [], provider: args.provider, respuestas: args.respuestas, vesStyle: "", skill: p.skill, motor: "reels" };
  jobs.set(job.id, job);
  (async () => {
    const dir = await reelPrepare(project, args.videoPath, job.log, (i) => { job.current = i; job.step = REEL_STEPS[i]; save(job); });
    const pal = job.respuestas.palette ?? paletaDeVideo(join(dir, "work/base.mp4"), join(dir, "_paleta")).options[0]?.colors;
    job.respuestas = { ...job.respuestas, palette: pal, broll: [] };
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
  job.status = "running"; job.current = 2; job.step = job.steps[2];
  const r = job.respuestas;
  const fam = plantillas().find((x) => x.id === job.plantilla);
  const plugins = pluginsPrompt({ energia: r.energia, familia: fam?.familia ?? "", variante: job.plantilla, notas: r.notas });
  if (isReel(job)) {
    const enfoque = plantillas().find((x) => x.id === job.plantilla)?.enfoque;
    const po: PlanOpts = { energia: r.energia, originales: false, broll: r.broll, notas: [enfoque, r.notas].filter(Boolean).join("\n") || undefined, palette: r.palette, plugins };
    const beats = await reelPlan(job.project, reelEstilo(job.plantilla), po, job.provider);
    writeFileSync(join(dirOf(job), "beats.json"), JSON.stringify(beats, null, 1));
    job.beats = beats.beats.length; job.assets = 0;
    if (r.rapido) return build(job, {});
    job.current = 3; job.status = "tablero"; job.step = "Tablero de preedición: elige A/B/C en cada beat"; save(job);
    return;
  }
  if (isSky(job)) {
    const enfoque = plantillas().find((x) => x.id === job.plantilla)?.enfoque;
    const po: PlanOpts = { energia: r.energia, originales: false, broll: r.broll, notas: [enfoque, r.notas].filter(Boolean).join("\n") || undefined, palette: r.palette, plugins };
    const { system, user, duration } = skyPrompt(job.project, po);
    const beats = skySanitize(extract(await ask(job.provider, system, user)) as unknown as SBeats, duration, r.broll);
    writeFileSync(join(dirOf(job), "beats.json"), JSON.stringify(beats, null, 1));
    job.beats = beats.beats.length; job.assets = beats.assets?.length ?? 0;
    if (r.rapido) return build(job, {});
    job.current = 3; job.status = "tablero"; job.step = "Tablero de preedición: elige A/B/C en cada beat"; save(job);
    return;
  }
  const enfoque = plantillas().find((x) => x.id === job.plantilla)?.enfoque;
  const po: PlanOpts = { energia: r.energia, originales: r.originales, broll: r.broll, notas: [enfoque, r.notas].filter(Boolean).join("\n") || undefined, palette: r.palette, fuentes: job.evidencia, plugins };
  const beats = await planBeats(job.provider, job.vesStyle, job.project, po, job.skill);
  const dir = dirOf(job);
  writeFileSync(join(dir, "beats.json"), JSON.stringify(beats, null, 1));
  job.beats = beats.beats.length; job.assets = beats.assets?.length ?? 0;
  writeFileSync(join(dir, "edit_plan.json"), JSON.stringify({
    version: 1, style: job.vesStyle, source: { video: "media/raw_cut.mp4", captions: "captions.json" },
    palette: r.palette ?? null, texture_amount: r.texturas, scenes: [], assets: beats.assets ?? [],
    captions: { enabled: true, hide_during: ["fullscreen"], special_words: (beats as KBeats).special_words ?? [] }, music: { file: null, volume: 0.16 },
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
  if (isReel(job)) {
    const beats = JSON.parse(readFileSync(join(dir, "beats.json"), "utf8")) as RBeats;
    for (const b of beats.beats) if (picks[b.id]) b.pick = picks[b.id] as "A" | "B" | "C";
    writeFileSync(join(dir, "beats.json"), JSON.stringify(beats, null, 1));
    const gf = join(dir, "work/graphics.json");
    if (existsSync(gf) && Object.keys(picks).length) (await import("node:fs")).rmSync(gf);   // elecciones nuevas → gráficos nuevos
    const r = await reelBuild(job.project, beats, job.log, (i) => { job.current = i; job.step = job.steps[i]; save(job); }, job.provider, job.respuestas.palette);
    job.scenes = r.scenes; job.originales = r.graficos;
    job.current = job.steps.length; job.step = "Video listo para revisar"; job.status = "review"; katana(job); save(job); if (job.respuestas.subtitulos) subtitulos(job.id, job.respuestas.subtitulos).catch?.(() => null);
    return;
  }
  if (isSky(job)) {
    const beats = JSON.parse(readFileSync(join(dir, "beats.json"), "utf8")) as SBeats;
    for (const b of beats.beats) if (picks[b.id]) b.pick = picks[b.id] as "A" | "B" | "C";
    writeFileSync(join(dir, "beats.json"), JSON.stringify(beats, null, 1));
    const r = await skyBuild(job.project, beats, job.log, (i) => { job.current = i; job.step = job.steps[i]; save(job); }, job.provider);
    job.scenes = r.scenes;
    job.current = job.steps.length; job.step = "Video listo para revisar"; job.status = "review"; katana(job); save(job); if (job.respuestas.subtitulos) subtitulos(job.id, job.respuestas.subtitulos).catch?.(() => null);
    return;
  }
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
  job.current = STEPS.length; job.step = "Borrador listo para revisar"; job.status = "review"; katana(job); save(job); if (job.respuestas.subtitulos) subtitulos(job.id, job.respuestas.subtitulos).catch?.(() => null);
}

/** Skills por escenas (Kallaway, Nick, Lobo…): originales arriba (1080×940), cara medida, revisión de reglas y borrador. */
async function buildKal(job: FlujoJob, picks: Record<string, string>) {
  const dir = dirOf(job);
  const cfg = sceneCfg(job.skill!);
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
    const brief = `Motion graphic ORIGINAL de ${secs} s para la parte de ARRIBA de un reel estilo ${cfg.nombre} (la cara va aparte, no la dibujes).
Idea: ${top.original}
Lo que se dice (sincroniza a estas palabras, tiempos desde 0): ${said}
Paleta: resaltado ${pal.highlight ?? pal.vibrant_bright}, franja ${pal.vibrant_dark}, blanco ${pal.dull_white}, fondo casi negro ${pal.dull_black}.
Look ${cfg.nombre}: Inter 900, sólidos planos, cifras gigantes, etiquetas limpias, flechas. Sin texturas, sin degradados decorativos.
Que se lea en el teléfono y algo cambie cada 0.6–1 s; entrada fuerte en el primer cuarto de segundo. Todo el texto con margen de 60 px a cada borde (no se puede cortar nada).`;
    try {
      const html = await writeMotionHtml(job.provider, motionBrief(brief, secs, { caption: { highlight: pal.highlight ?? pal.vibrant_bright ?? "#F5B942" } } as never, pal.dull_black ?? "#0B0B0D", cfg.topSizeFor?.(s.props ?? {}) ?? cfg.topSize ?? { w: 1080, h: 940 }));
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
    ...(cfg.face ? [{ script: "kal" as const, args: ["face", job.project] }] : []),
  ]);
  autofix(job);
  await step(job, 5, [
    ...(job.assets ? [{ script: "assets" as const, args: [job.project] }] : []),
    { script: "ves", args: ["captions", job.project] },
    { script: "ves", args: ["captionsheet", job.project] },
    { script: "ves", args: ["validate", job.project] },
    { script: "ves", args: ["storyboard", job.project] },
    ...(cfg.check ? [{ script: "kal" as const, args: ["check", job.project] }] : []),
  ]);
  job.scenes = JSON.parse(readFileSync(join(dir, "edit_plan.json"), "utf8")).scenes.length;
  await step(job, 6, [
    { script: "ves", args: ["render", job.project, "--draft", "--force"] },
    { script: "ves", args: ["sound", job.project, "--draft"] },
  ]);
  job.current = STEPS.length; job.step = "Borrador listo para revisar"; job.status = "review"; katana(job); save(job); if (job.respuestas.subtitulos) subtitulos(job.id, job.respuestas.subtitulos).catch?.(() => null);
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
  return { beats, thumbs, faltan: faltan(job, beats) };
}

export const flujoFiles = (job: FlujoJob) => (isReel(job) ? reelStatus(job.project) : isSky(job) ? skyStatus(job.project) : projectStatus(job.project, job.skill));

/** Cuadro real del video en un segundo (para "quedarse en la cara" en el tablero). */
export function cuadro(id: string, t: number) {
  const job = getFlujo(id);
  if (!job) throw new Error("No existe ese flujo");
  const dir = join(dirOf(job), "_cuadros");
  mkdirSync(dir, { recursive: true });
  const f = join(dir, `${t.toFixed(1)}.jpg`);
  if (!existsSync(f)) execFileSync("ffmpeg", ["-v", "error", "-y", "-ss", t.toFixed(2), "-i", join(dirOf(job), isSky(job) ? "work/aroll.mp4" : isReel(job) ? "work/base.mp4" : "media/raw_cut.mp4"), "-frames:v", "1", "-vf", "scale=180:-2", "-q:v", "4", f]);
  return f;
}

/** Pedir prompts: de lo que SUGIERE el plan (las opciones elegidas) o de lo que Santiago PIDE con sus palabras.
 *  La IA escribe encargos profesionales en 7 bloques (no genera nada: regla 2) y se suman a la lista de assets. */
export function pedirPrompts(id: string, base: "sugerencia" | "pedido", pedido = "", beatId?: string) {
  const job = getFlujo(id);
  if (!job) throw new Error("No existe ese flujo");
  if (job.prompts?.status === "running") throw new Error("Ya estoy escribiendo prompts");
  if (base === "pedido" && !pedido.trim()) throw new Error("Escribe qué prompts quieres");
  job.prompts = { status: "running", base, pedido: pedido.slice(0, 2000) }; save(job);
  (async () => {
    const dir = dirOf(job);
    const bf = join(dir, "beats.json");
    const beats = JSON.parse(readFileSync(bf, "utf8")) as { title: string; beats: { id: string; start: number; end: number; script: string; pick: string; opts: unknown[] }[]; assets?: { id: string; name?: string; resumen?: string }[] };
    const wf = isSky(job) || isReel(job) ? join(dir, "work/words.json") : join(dir, "transcript_cut.json");
    const words = existsSync(wf) ? (JSON.parse(readFileSync(wf, "utf8")).words as { w: string }[]).map((w) => w.w).join(" ") : "";
    const elegidas = beats.beats.filter((b) => !beatId || b.id === beatId).map((b) => `${b.id} ${b.start.toFixed(1)}–${b.end.toFixed(1)} s «${b.script}» → opción ${b.pick}: ${JSON.stringify(b.opts["ABC".indexOf(b.pick)]).slice(0, 900)}`).join("\n");
    const pal = job.respuestas.palette ?? {};
    const ya = (beats.assets ?? []).map((a) => `${a.id} ${a.name ?? ""}: ${a.resumen ?? ""}`).join("\n") || "(ninguno)";
    const fam = plantillas().find((x) => x.id === job.plantilla);
    const system = `Eres director de arte y prompt engineer de "Emperador Santiago · Edición de Videos". Escribes encargos de material (imagen o video) PROFESIONALES y específicos, listos para copiar en el modelo indicado. Nunca generas nada tú (lo genera Santiago).
Formato de cada asset (JSON): {"id":"P01","name","kind":"image|video|illustration|texture","modelo":"el más adecuado: imagen Nano Banana Pro / GPT Image; video Seedance 2.5 / Kling / Veo",
 "ar":"9:16|4:5|1:1|1080x940","resolucion","duracion":"solo video: el doble de lo que sale en pantalla, mín. 4 s","en_pantalla":"b03 · 7.2–8.4 s","referencia":"qué usar de referencia para la consistencia","is_ref":true|false,
 "bloques":{"referencias":"función de cada referencia","contexto":"qué es, para qué marca y video, estilo","mapa_espacial":"dónde va cada cosa en el cuadro","accion":"UNA acción concreta","camara":"lente, plano, movimiento + dosis + límite","luz_textura":"luz, paleta con HEX, textura y grano","bloqueos":"lo que no puede cambiar"},
 "prompt":"el prompt completo EN INGLÉS uniendo los 7 bloques en un párrafo fluido","resumen":"una línea en español","negative":"en inglés","archivo":"P01_nombre.png","for_beat":"b03"}`;
    const user = `Video: «${beats.title}» · estilo ${fam?.familiaName ?? ""} · ${fam?.name ?? ""}
Paleta del video: ${JSON.stringify(pal)}
Lo que se dice: ${words.slice(0, 6000)}
Lo elegido en el tablero:
${elegidas}
Assets que ya tienen prompt (no los repitas):
${ya}

${base === "pedido" ? `PEDIDO DE SANTIAGO (manda; haz exactamente esto, con el número de prompts que pida): ${pedido}` : "Escribe los prompts del material que SUGIERE el plan elegido y que todavía no tiene prompt: b-roll, objetos, fondos, mundos, capturas a recrear, planos que le darían más fuerza viral. Máximo 6, los más importantes primero."}
Devuelve SOLO {"assets": [ … ]} en un bloque \`\`\`json.`;
    const out = extract(await ask(job.provider, system, user)) as unknown as { assets?: Record<string, unknown>[] };
    const n0 = (beats.assets ?? []).length;
    const nuevos = (out.assets ?? []).slice(0, 10).map((a, i) => {
      const idn = `P${String(n0 + i + 1).padStart(2, "0")}`;
      const bl = a.bloques as Record<string, string> | undefined;
      const prompt = (a.prompt as string) || (bl ? Object.values(bl).filter(Boolean).join(" ") : "");
      const ar = String(a.ar ?? "").match(/\d+\s*[:x/]\s*\d+/)?.[0]?.replace(/\s/g, "") ?? "9:16";
      return { ...a, id: idn, ar, prompt, origen: base, archivo: (a.archivo as string)?.replace(/^\w+?_/, `${idn}_`) || `${idn}_${String(a.name ?? "asset").replace(/[^\w-]+/g, "-")}.${/video/.test(String(a.kind)) ? "mp4" : "png"}` };
    });
    beats.assets = [...(beats.assets ?? []), ...nuevos] as typeof beats.assets;
    writeFileSync(bf, JSON.stringify(beats, null, 1));
    job.assets = beats.assets!.length;
    job.prompts = { ...job.prompts!, status: "done", nuevos: nuevos.map((a) => a.id) }; save(job);
  })().catch((e) => { job.prompts = { ...job.prompts!, status: "error", error: (e as Error).message }; save(job); });
  return job;
}

/** El video terminado de cada motor (para los plugins que trabajan después del render). */
function videoFinal(job: FlujoJob) {
  const dir = dirOf(job);
  const c = isSky(job) || isReel(job) ? [`out/${job.project}.mp4`] : ["out/master.mp4", "out/BORRADOR.mp4", "out/BORRADOR_web.mp4"];
  const f = c.map((x) => join(dir, x)).find((x) => existsSync(x));
  if (!f) throw new Error("Todavía no hay un video terminado");
  return f;
}

/** Plugin Katana: revisión medida del video terminado (energía, tramos quietos, gancho, pausas, volumen). */
function katana(job: FlujoJob) {
  try {
    job.revision = revisar(videoFinal(job), job.respuestas.energia);
    writeFileSync(join(dirOf(job), "revision_katana.json"), JSON.stringify(job.revision, null, 1));
  } catch (e) { job.log.push(`⚠ revisión Katana: ${(e as Error).message}`); }
}

/** Palabras con su tiempo, sea cual sea el motor (para «donde dice …»). */
function palabras(job: FlujoJob): { w: string; t: number }[] {
  const dir = dirOf(job);
  const f = [join(dir, "work/words.json"), join(dir, "transcript_cut.json")].find((x) => existsSync(x));
  if (!f) return [];
  const j = JSON.parse(readFileSync(f, "utf8"));
  return ((Array.isArray(j) ? j : j.words) as { w: string; t0?: number; s?: number; start?: number }[]).map((w) => ({ w: w.w, t: w.t0 ?? w.s ?? w.start ?? 0 }));
}

/** Plugin Edit Studio: efectos con nombre en un momento exacto sobre el video terminado → versión nueva. */
export function efectos(id: string, texto: string) {
  const job = getFlujo(id);
  if (!job) throw new Error("No existe ese flujo");
  if (job.efectos?.status === "running") throw new Error("Ya estoy aplicando efectos");
  const { efectos: lista, dudas } = leerEfectos(texto, palabras(job));
  if (!lista.length) throw new Error(dudas[0] ?? "No entendí qué efecto poner. Ej.: «crash zoom en 0:07»");
  job.efectos = { status: "running", texto, aplicados: lista.map((e) => `${e.nombre} en ${e.at.toFixed(2)} s`), dudas }; save(job);
  (async () => {
    const out = await aplicarEfectos(videoFinal(job), lista, job.log);
    job.efectos = { ...job.efectos!, status: "done", video: out.slice(dirOf(job).length + 1) };
    save(job);
  })().catch((e) => { job.efectos = { ...job.efectos!, status: "error", error: (e as Error).message.slice(0, 300) }; save(job); });
  return job;
}

// ── Paso de assets (obligatorio antes de construir) ─────────────────────────────────────────────────────────────
type AnyBeats = { beats: { id: string; pick: string; opts: unknown[] }[]; assets?: { id: string; subido?: string; [k: string]: unknown }[] };

/** Assets que piden las opciones elegidas y que Santiago todavía no subió. */
function faltan(job: FlujoJob, beats: AnyBeats) {
  const elegido = JSON.stringify(beats.beats.map((b) => b.opts["ABC".indexOf(b.pick)]));
  return (beats.assets ?? []).filter((a) => !a.subido && new RegExp(`(^|[^\\w])${a.id}([^\\w]|$)`).test(elegido)).map((a) => a.id);
}

/** El archivo subido reemplaza su marcador en el plan: placeholder «A03 · …», media/assets/A03.*, assets/img/<id>.* */
function ponerMedia(node: unknown, aid: string, rel: string): void {
  if (Array.isArray(node)) { node.forEach((x) => ponerMedia(x, aid, rel)); return; }
  if (!node || typeof node !== "object") return;
  const o = node as Record<string, unknown>;
  const marca = (v: unknown) => typeof v === "string" && new RegExp(`^${aid}\\b`).test(v.trim());
  if (marca(o.placeholder)) o.media = Array.isArray(o.media) || "kind" in o ? [rel] : rel;
  if (marca(o.label) && "t" in o && !o.media) o.media = rel;
  for (const [k, v] of Object.entries(o)) {
    if (typeof v === "string" && new RegExp(`^media/assets/${aid}\\.\\w+$`).test(v)) o[k] = rel;
    else if (Array.isArray(v) && v.every((x) => typeof x === "string")) o[k] = v.map((x) => (new RegExp(`^media/assets/${aid}\\.\\w+$`).test(x as string) ? rel : x));
    else ponerMedia(v, aid, rel);
  }
}

export async function subirAsset(id: string, aid: string, archivo: string) {
  const job = getFlujo(id);
  if (!job) throw new Error("No existe ese flujo");
  if (!/^[\w-]+$/.test(aid)) throw new Error("Asset inválido");
  if (isReel(job)) throw new Error("Este estilo dibuja sus gráficos en código: no usa assets");
  const dir = dirOf(job);
  const bf = join(dir, "beats.json");
  const beats = JSON.parse(readFileSync(bf, "utf8")) as AnyBeats;
  const a = beats.assets?.find((x) => x.id === aid);
  if (!a) throw new Error(`No hay un asset ${aid} en este plan`);
  const ext = (archivo.match(/\.\w+$/)?.[0] ?? ".png").toLowerCase();
  const video = /\.(mp4|mov|webm|m4v)$/.test(ext);
  let rel: string;
  if (isSky(job)) {
    const img = join(dir, "scenes/assets/img");
    mkdirSync(img, { recursive: true });
    const como = String(a.como ?? (video ? "video" : "white"));
    if (video) { rel = `assets/img/${aid}.mp4`; copyFileSync(archivo, join(dir, "scenes", rel)); }
    else { await pc(["prep", dir, `${aid}=${archivo}:${como === "video" ? "cover" : como}`], job.log); rel = `assets/img/${aid}.${como === "cover" ? "jpg" : "png"}`; }
  } else {
    mkdirSync(join(dir, "media/assets"), { recursive: true });
    rel = `media/assets/${aid}${ext}`;
    copyFileSync(archivo, join(dir, rel));
    ponerMedia(beats.beats, aid, rel);
  }
  a.subido = rel;
  writeFileSync(bf, JSON.stringify(beats, null, 1));
  job.log.push(`✓ asset ${aid} → ${rel}`); save(job);
  return { aid, rel, faltan: faltan(job, beats) };
}

// ── Dirección: Santiago le dice al editor qué cambiar del plan antes de construir ───────────────────────────────
export function dirigir(id: string, texto: string) {
  const job = getFlujo(id);
  if (!job) throw new Error("No existe ese flujo");
  if (job.status === "running") throw new Error("Este flujo todavía está trabajando");
  if (!texto.trim()) throw new Error("Escribe qué quieres cambiar");
  const prev = job.status;
  job.status = "running"; job.step = "Aplicando tu dirección al plan"; save(job);
  (async () => {
    const dir = dirOf(job);
    const actual = readFileSync(join(dir, "beats.json"), "utf8");
    const system = `Eres el editor de "Emperador Santiago · Edición de Videos". Recibes el plan del tablero (JSON) y la DIRECCIÓN de Santiago.
Aplica la dirección exactamente y conserva todo lo demás (formato, ids, tiempos, escenas, assets ya subidos con "subido"). Si pide otra opción, cambia "pick"; si pide algo nuevo, edita la opción elegida o crea la escena que haga falta (con el mismo formato) y añade su asset con prompt en 7 bloques si necesita material. Actualiza "brief" si cambia la idea. Devuelve SOLO el JSON completo en un bloque \`\`\`json.`;
    const out = extract(await ask(job.provider, system, `DIRECCIÓN DE SANTIAGO: ${texto}\n\nPLAN ACTUAL:\n${actual}`)) as unknown as Record<string, unknown>;
    const r = job.respuestas;
    let limpio: unknown;
    if (isReel(job)) limpio = reelSanitize(out as unknown as RBeats, reelEstilo(job.plantilla), reelPrompt(job.project, reelEstilo(job.plantilla), { energia: r.energia, originales: false, broll: [] }).duration);
    else if (isSky(job)) limpio = skySanitize(out as unknown as SBeats, skyPrompt(job.project, { energia: r.energia, originales: false, broll: r.broll }).duration, r.broll);
    else if (isKal(job)) limpio = sanitizeKal(out as unknown as KBeats, kalPrompt(job.project, { energia: r.energia, originales: r.originales, broll: r.broll }, job.skill).duration, dir, r.originales, job.skill);
    else { const bp = beatsPrompt(job.vesStyle, job.project, { energia: r.energia, originales: r.originales, broll: r.broll }); limpio = sanitize(out as unknown as Beats, bp.allowed, bp.duration, r.originales); }
    // los assets ya subidos se conservan
    const viejos = (JSON.parse(actual).assets ?? []) as { id: string; subido?: string }[];
    const nuevo = limpio as AnyBeats;
    for (const v of viejos) if (v.subido) { const n = nuevo.assets?.find((x) => x.id === v.id); if (n) n.subido = v.subido; else (nuevo.assets ??= []).push(v as never); ponerMedia(nuevo.beats, v.id, v.subido); }
    writeFileSync(join(dir, "beats.json"), JSON.stringify(nuevo, null, 1));
    (job as FlujoJob & { direcciones?: string[] }).direcciones = [...((job as FlujoJob & { direcciones?: string[] }).direcciones ?? []), texto];
    job.status = "tablero"; job.step = "Tablero de preedición: elige A/B/C en cada beat"; save(job);
  })().catch((e) => { job.status = prev === "review" ? "review" : "tablero"; job.error = `Dirección: ${(e as Error).message.slice(0, 200)}`; save(job); });
  return job;
}

// ── Presets de subtitulado: se aplican a TODO el video, sea cual sea el estilo ─────────────────────────────────
/** Palabras con inicio y fin (para los subtítulos), sea cual sea el motor. */
function palabrasConFin(job: FlujoJob): Palabra[] {
  const dir = dirOf(job);
  const f = [join(dir, "work/words.json"), join(dir, "transcript_cut.json")].find((x) => existsSync(x));
  if (!f) return [];
  const j = JSON.parse(readFileSync(f, "utf8"));
  return ((Array.isArray(j) ? j : j.words) as Record<string, number & string>[]).map((w) => ({ w: String(w.w), t0: Number(w.t0 ?? w.s ?? w.start ?? 0), t1: Number(w.t1 ?? w.e ?? w.end ?? 0) }));
}
/** Las palabras clave que ya decidió el plan (resaltado), si las hay. */
function clavesDe(job: FlujoJob): string[] {
  try { const b = JSON.parse(readFileSync(join(dirOf(job), "beats.json"), "utf8")); return [...(b.keywords ?? []), ...(b.special_words ?? [])]; } catch { return []; }
}

/** La versión del video SIN subtítulos (se hace una vez y se guarda; después cambiar de preset es rápido). */
async function baseSinSubs(job: FlujoJob): Promise<string> {
  const dir = dirOf(job);
  if (isReel(job)) {
    const f = join(dir, `out/${job.project}_sinsubs.mp4`);
    if (!existsSync(f)) await reelBuild(job.project, JSON.parse(readFileSync(join(dir, "beats.json"), "utf8")) as RBeats, job.log, () => null, job.provider, job.respuestas.palette, true);
    return f;
  }
  if (isSky(job)) {
    const f = join(dir, `out/${job.project}_sinsubs.mp4`);
    if (!existsSync(f)) {
      const pf = join(dir, "work/plan.json"), orig = readFileSync(pf, "utf8");
      writeFileSync(pf, JSON.stringify({ ...JSON.parse(orig), captions: [] }));
      try { await pc(["all", dir, `${job.project}_sinsubs`], job.log); } finally { writeFileSync(pf, orig); }
    }
    return f;
  }
  // VES (Arthur, Kallaway, Nick, Lobo): render del borrador con los subtítulos apagados, sin tocar el borrador que ya tienes
  const f = join(dir, "out/BORRADOR_sinsubs.mp4");
  if (!existsSync(f)) {
    const pf = join(dir, "edit_plan.json"), orig = readFileSync(pf, "utf8");
    const guarda = ["out/BORRADOR.mp4", "out/BORRADOR_web.mp4"].filter((x) => existsSync(join(dir, x)));
    for (const g of guarda) copyFileSync(join(dir, g), join(dir, g.replace(".mp4", ".guardado.mp4")));
    const plan = JSON.parse(orig); plan.captions = { ...(plan.captions ?? {}), enabled: false };
    writeFileSync(pf, JSON.stringify(plan, null, 1));
    try {
      for (const args of [["render", job.project, "--draft", "--force"], ["sound", job.project, "--draft"]]) {
        const j = await waitVes(runVes("ves", args, isKal(job) ? { VES_STYLE: sceneCfg(job.skill!).style } : {}, job.skill));
        if (j.status === "error") throw new Error(`${j.cmd}: ${j.log.slice(-2).join(" ")}`);
      }
      copyFileSync(join(dir, "out/BORRADOR.mp4"), f);
    } finally {
      writeFileSync(pf, orig);
      for (const g of guarda) copyFileSync(join(dir, g.replace(".mp4", ".guardado.mp4")), join(dir, g));
    }
  }
  return f;
}

export const listaPresets = () => presetsSubs();

/** Vista previa de un preset sobre un cuadro del propio video (PNG en caché). */
export async function muestraSubtitulos(id: string, preset: string) {
  const job = getFlujo(id);
  if (!job) throw new Error("No existe ese flujo");
  if (!/^[\w-]+$/.test(preset)) throw new Error("Preset inválido");
  const out = join(dirOf(job), "_subs", `${preset}.png`);
  if (existsSync(out)) return out;
  mkdirSync(dirname(out), { recursive: true });
  const video = isSky(job) ? join(dirOf(job), "work/aroll.mp4") : isReel(job) ? join(dirOf(job), "work/base.mp4") : join(dirOf(job), "media/raw_cut.mp4");
  return muestra(video, palabrasConFin(job), preset, clavesDe(job), out);
}

/** Aplica el preset a todo el video terminado → versión nueva «…_subs_<preset>.mp4». */
export async function subtitulos(id: string, preset: string) {
  const job = getFlujo(id);
  if (!job) throw new Error("No existe ese flujo");
  if (!presetsSubs().some((p) => p.id === preset)) throw new Error("Ese preset no existe");
  if (job.subtitulos?.status === "running") throw new Error("Ya estoy aplicando subtítulos");
  job.subtitulos = { status: "running", preset, paso: "Preparando la versión sin subtítulos (solo la primera vez)" }; save(job);
  (async () => {
    const base = await baseSinSubs(job);
    job.subtitulos = { ...job.subtitulos!, paso: "Dibujando los subtítulos en todo el video" }; save(job);
    const salida = base.replace(/_sinsubs\.mp4$/, `_subs_${preset}.mp4`);
    await subtitular(base, palabrasConFin(job), preset, clavesDe(job), salida, job.log);
    job.subtitulos = { status: "done", preset, video: salida.slice(dirOf(job).length + 1) }; save(job);
  })().catch((e) => { job.subtitulos = { ...job.subtitulos!, status: "error", error: (e as Error).message.slice(0, 300) }; save(job); });
  return job;
}
