// Flujo de plantillas: clip en bruto (ya unido y sin silencios) + plantilla de estilo → edición automática.
// Motor "ves" (Arthur Brooks): proyecto VES → transcripción y captions → la IA planifica por beats con la biblioteca
// de Arthur → plan → validación y storyboard → BORRADOR con sonido. El render FINAL solo con la aprobación de Santiago.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { runVes, waitVes, VES, projectStatus } from "./ves.js";
import { planBeats } from "./beats.js";
import type { ProviderId } from "./providers/index.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
export type Plantilla = { id: string; name: string; description: string; motor: "ves" | "rapido"; vesStyle?: string; styleId?: string; preview?: string; ideal?: string; recomendada?: boolean };
export const plantillas = (): Plantilla[] => JSON.parse(readFileSync(join(ROOT, "plantillas/plantillas.json"), "utf8"));

export type FlujoJob = {
  id: string; project: string; plantilla: string; status: "running" | "review" | "error";
  step: string; steps: string[]; current: number; log: string[]; error?: string; beats?: number; scenes?: number;
};
const jobs = new Map<string, FlujoJob>();
export const getFlujo = (id: string) => jobs.get(id);

const STEPS = ["Preparando el proyecto", "Transcribiendo y cortando a 30 ms", "Tu IA planifica los beats (método Joseph)", "Aplicando el plan", "Subtítulos, validación y storyboard", "Borrador con sonido"];

async function step(job: FlujoJob, i: number, cmds: { script: Parameters<typeof runVes>[0]; args: string[] }[]) {
  job.current = i; job.step = STEPS[i];
  for (const c of cmds) {
    const j = await waitVes(runVes(c.script, c.args));
    job.log.push(`$ ${j.cmd}`, ...j.log.slice(-6));
    job.log = job.log.slice(-60);
    if (j.status === "error") throw new Error(`${j.cmd}: ${j.log.slice(-3).join(" ")}`);
  }
}

export function startFlujo(args: { videoPath: string; plantilla: string; provider: ProviderId; name?: string }) {
  const p = plantillas().find((x) => x.id === args.plantilla);
  if (!p || p.motor !== "ves" || !p.vesStyle) throw new Error("Plantilla desconocida o no es del motor VES");
  const project = (args.name ?? `video-${new Date().toISOString().slice(5, 16).replace(/[-:T]/g, "")}`).replace(/[^\w.-]/g, "-");
  const job: FlujoJob = { id: randomUUID().slice(0, 8), project, plantilla: p.id, status: "running", step: STEPS[0], steps: STEPS, current: 0, log: [] };
  jobs.set(job.id, job);
  (async () => {
    await step(job, 0, [{ script: "ves", args: ["new", project, "--video", args.videoPath, "--style", p.vesStyle!] }]);
    await step(job, 1, [{ script: "ves", args: ["all", project, "--lang", "es"] }]);
    job.current = 2; job.step = STEPS[2];
    const beats = await planBeats(args.provider, p.vesStyle!, project);
    const dir = join(VES, "projects", project);
    writeFileSync(join(dir, "beats.json"), JSON.stringify(beats, null, 1));
    job.beats = beats.beats.length;
    // plan base (el contrato) + aplicar la opción recomendada de cada beat
    if (!existsSync(join(dir, "edit_plan.json")))
      writeFileSync(join(dir, "edit_plan.json"), JSON.stringify({ version: 1, style: p.vesStyle, source: { video: "media/raw_cut.mp4", captions: "captions.json" }, palette: null, scenes: [], assets: [], captions: { enabled: true, hide_during: ["fullscreen"] }, music: { file: null, volume: 0.16 } }, null, 1));
    await afterPlan(job, project);
  })().catch((e) => { job.status = "error"; job.error = (e as Error).message; });
  return job;
}

/** Del plan elegido al borrador: aplicar picks → subtítulos/validación/storyboard → borrador con sonido → panel. */
async function afterPlan(job: FlujoJob, project: string, picksFile?: string) {
  job.status = "running";
  await step(job, 3, [{ script: "beats", args: ["apply", project, ...(picksFile ? ["--picks", picksFile] : [])] }]);
  job.scenes = JSON.parse(readFileSync(join(VES, "projects", project, "edit_plan.json"), "utf8")).scenes.length;
  await step(job, 4, [
    { script: "ves", args: ["captions", project] },
    { script: "ves", args: ["captionsheet", project] },
    { script: "ves", args: ["validate", project] },
    { script: "ves", args: ["storyboard", project] },
  ]);
  await step(job, 5, [
    { script: "ves", args: ["render", project, "--draft"] },
    { script: "ves", args: ["sound", project, "--draft"] },
    { script: "beats", args: ["panel", project, "--out", `projects/${project}/out/panel`] },
  ]);
  job.current = STEPS.length; job.step = "Borrador listo para revisar"; job.status = "review";
}

/** Santiago cambió opciones en el panel ("Copiar plan"): se aplican y se rehace el borrador. */
export function applyPicks(id: string, picksText: string) {
  const job = jobs.get(id);
  if (!job) throw new Error("No existe ese flujo");
  const raw = picksText.slice(picksText.indexOf("{"));
  JSON.parse(raw);
  const file = join(VES, "projects", job.project, "picks.json");
  writeFileSync(file, raw);
  job.error = undefined;
  afterPlan(job, job.project, file).catch((e) => { job.status = "error"; job.error = (e as Error).message; });
  return job;
}

export const flujoFiles = (job: FlujoJob) => projectStatus(job.project);
