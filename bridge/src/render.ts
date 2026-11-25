// Renders en el equipo: Remotion (React, cuadro a cuadro) o HyperFrames (HTML + GSAP, proyecto editable).
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { DATA } from "./store.js";
import { buildHyperframesProject } from "./hyperframes.js";
import { bakePlanFx, FX_DIR } from "./fxbake.js";
import { loudnorm } from "./post.js";
import type { Plan, Style, Word } from "../../shared/types.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
export type Engine = "remotion" | "hyperframes";
export type RenderJob = {
  id: string; engine: Engine; status: "queued" | "rendering" | "done" | "error";
  progress: number; output?: string; projectDir?: string; error?: string; log: string[];
};
const jobs = new Map<string, RenderJob>();
export const getRender = (id: string) => jobs.get(id);

export function startRender(args: { engine: Engine; videoPath: string; videoUrl: string; plan: Plan; words: Word[]; style: Style }) {
  const id = randomUUID().slice(0, 8);
  const dir = join(DATA, "renders", id);
  mkdirSync(dir, { recursive: true });
  const job: RenderJob = { id, engine: args.engine, status: "queued", progress: 0, log: [] };
  jobs.set(id, job);
  const run = args.engine === "remotion" ? renderRemotion(job, dir, args) : renderHyperframes(job, dir, args);
  run.catch((e) => { job.status = "error"; job.error = (e as Error).message; });
  return job;
}

let bundleCache: Promise<string> | null = null;
async function renderRemotion(job: RenderJob, dir: string, a: { videoUrl: string; plan: Plan; words: Word[]; style: Style }) {
  const { bundle } = await import("@remotion/bundler");
  const { selectComposition, renderMedia } = await import("@remotion/renderer");
  job.status = "rendering";
  job.log.push("Horneando efectos con Playwright…");
  const baked = await bakePlanFx(a.plan.motion, a.style.caption.highlight);
  const port = process.env.SANTI_PORT ?? 8787;
  const fx = Object.fromEntries(Object.entries(baked).map(([k, f]) => [k, `http://localhost:${port}/fx/${f}`]));
  bundleCache ??= bundle({ entryPoint: join(ROOT, "remotion/src/index.ts") });
  const serveUrl = await bundleCache;
  // los b-roll del editor llegan con ruta relativa (/motion/…): Remotion necesita la URL completa del bridge
  const plan = { ...a.plan, motion: a.plan.motion.map((m) => (m.kind === "broll" && m.text.startsWith("/") ? { ...m, text: `http://localhost:${port}${m.text}` } : m)) };
  const inputProps = { videoSrc: a.videoUrl, plan, words: a.words, style: a.style, fx };
  const browserExecutable = process.env.SANTI_CHROME || null;
  const composition = await selectComposition({ serveUrl, id: "SantiEdit", inputProps, browserExecutable });
  const output = join(dir, "santi-remotion.mp4");
  await renderMedia({
    composition, serveUrl, codec: "h264", outputLocation: output, inputProps, browserExecutable,
    onProgress: ({ progress }) => (job.progress = progress),
  });
  loudnorm(output);
  Object.assign(job, { status: "done", progress: 1, output });
}

async function renderHyperframes(job: RenderJob, dir: string, a: { videoPath: string; plan: Plan; words: Word[]; style: Style }) {
  const projectDir = join(dir, "hyperframes");
  const baked = await bakePlanFx(a.plan.motion, a.style.caption.highlight);
  const fx = Object.fromEntries(Object.entries(baked).map(([k, f]) => [k, join(FX_DIR, f)]));
  const brolls = Object.fromEntries(a.plan.motion.filter((m) => m.kind === "broll").map((m) => [m.text, localBroll(m.text)]).filter(([, p]) => p)) as Record<string, string>;
  buildHyperframesProject(projectDir, { ...a, fx, brolls });
  job.projectDir = projectDir;
  job.status = "rendering";
  const output = join(dir, "santi-hyperframes.mp4");
  await new Promise<void>((resolve, reject) => {
    const bin = join(ROOT, "node_modules/.bin/hyperframes");
    const child = spawn(bin, ["render", projectDir, "-o", output, "--quality", "looks"], {
      env: { ...process.env, HYPERFRAMES_NO_TELEMETRY: "1", DO_NOT_TRACK: "1" },
    });
    const onData = (d: Buffer) => {
      const s = d.toString();
      job.log.push(...s.split("\n").filter(Boolean));
      job.log = job.log.slice(-40);
      const pct = [...s.matchAll(/(\d{1,3})%/g)].pop();
      if (pct) job.progress = Math.min(0.99, +pct[1] / 100);
    };
    child.stdout.on("data", onData);
    child.stderr.on("data", onData);
    child.on("error", reject);
    child.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`hyperframes render salió con ${code}: ${job.log.slice(-5).join(" | ")}`))));
  });
  loudnorm(output);
  Object.assign(job, { status: "done", progress: 1, output });
}

/** Un b-roll servido por el bridge (/motion/<archivo>) → su ruta local. */
function localBroll(url: string) {
  const m = url.match(/\/motion\/([\w.-]+)$/);
  return m ? join(DATA, "motion", m[1]) : "";
}
