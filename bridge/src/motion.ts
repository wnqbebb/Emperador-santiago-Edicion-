// Generador de motion graphics: una idea (o un prompt de la biblioteca) → la IA escribe una composición
// HyperFrames (HTML + GSAP) → HyperFrames la renderiza a MP4 → se inserta en el video como b-roll.
import { spawn } from "node:child_process";
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";
import Anthropic from "@anthropic-ai/sdk";
import { DATA } from "./store.js";
import { ANTHROPIC_MODEL } from "./providers/anthropic.js";
import { planWithOpenAI, planWithGemini } from "./providers/keys.js";
import { runCli } from "./providers/subscriptions.js";
import type { ProviderId } from "./providers/index.js";
import type { Style } from "./schema.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const require = createRequire(import.meta.url);
export const MOTION_DIR = join(DATA, "motion");
mkdirSync(MOTION_DIR, { recursive: true });

type Idea = { id: string; category: string; tech: string[]; author: string; post: string; prompt: string };
let ideas: Idea[] | null = null;
export function searchIdeas(q = "", category = "", limit = 60) {
  ideas ??= JSON.parse(readFileSync(join(ROOT, "library/motion-ideas.json"), "utf8")) as Idea[];
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  return ideas
    .filter((i) => (!category || i.category === category) && words.every((w) => i.prompt.toLowerCase().includes(w)))
    .slice(0, limit);
}

export function motionBrief(idea: string, seconds: number, style: Style, fondo = "#0b0b0f") {
  return `Escribe UNA composición HyperFrames (un solo archivo index.html) para un motion graphic vertical de la marca
"Emperador Santiago". Idea: ${idea}

Reglas de HyperFrames (obligatorias):
- <div id="root" data-composition-id="main" data-start="0" data-duration="${seconds}" data-width="1080" data-height="1920">
- Todo elemento con tiempo lleva class="clip", data-start y data-duration (segundos) y un id único.
- Carga GSAP con <script src="assets/gsap.min.js"></script>. Construye UNA línea de tiempo pausada y regístrala al final:
  const tl = gsap.timeline({ paused: true }); …tweens…; window.__timelines["main"] = tl;
- Nada de Date.now(), Math.random() sin semilla, fetch, setTimeout/setInterval ni repeat: -1. Todo depende del tiempo de la línea.
- Usa fromTo (no from). Anima transform/opacity, no left/top/width/height. No animes display/visibility de un .clip.
- Canvas 2D y SVG están permitidos (dibuja en un onUpdate del timeline según tl.time()). Sin imágenes ni fuentes externas.
- Fuentes: Inter, Oswald o Playfair Display por nombre. Fondo: ${fondo}. Acento de marca: ${style.caption.highlight}. Texto en español.
- Todo dentro del 90% central del cuadro. Que se lea en un teléfono: textos grandes (60px o más).

Devuelve SOLO el HTML completo, sin explicaciones.`;
}

export async function writeMotionHtml(provider: ProviderId, brief: string): Promise<string> {
  let raw: string;
  if (provider === "claude-api") {
    const client = new Anthropic();
    const msg = await client.beta.messages.stream({
      model: ANTHROPIC_MODEL, max_tokens: 32000,
      betas: ["server-side-fallback-2026-07-01"], fallbacks: "default",
      output_config: { effort: "high" },
      messages: [{ role: "user", content: brief }],
    }).finalMessage();
    if (msg.stop_reason === "refusal") throw new Error("Claude rechazó la petición");
    raw = msg.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
  } else if (provider === "openai-api") raw = await planWithOpenAI("Eres un experto en motion design con HTML y GSAP.", brief);
  else if (provider === "gemini-api") raw = await planWithGemini("Eres un experto en motion design con HTML y GSAP.", brief);
  else raw = await runCli(provider, brief);
  const html = raw.match(/```html?\s*([\s\S]*?)```/)?.[1] ?? raw;
  if (!html.includes("__timelines")) throw new Error("La IA no devolvió una composición HyperFrames válida");
  return html.trim();
}

export type MotionJob = { id: string; status: "writing" | "rendering" | "done" | "error"; seconds: number; url?: string; error?: string; projectDir: string };
const jobs = new Map<string, MotionJob>();
export const getMotion = (id: string) => jobs.get(id);

/** Renderiza un index.html de HyperFrames a data/motion/<id>.mp4. */
export function renderMotionHtml(html: string, seconds: number, job?: MotionJob): Promise<MotionJob> {
  const j = job ?? { id: randomUUID().slice(0, 8), status: "rendering" as const, seconds, projectDir: "" };
  j.projectDir = join(MOTION_DIR, j.id);
  jobs.set(j.id, j);
  mkdirSync(join(j.projectDir, "assets"), { recursive: true });
  writeFileSync(join(j.projectDir, "index.html"), html);
  copyFileSync(require.resolve("gsap/dist/gsap.min.js"), join(j.projectDir, "assets/gsap.min.js"));
  j.status = "rendering";
  const out = join(MOTION_DIR, `${j.id}.mp4`);
  return new Promise((resolve, reject) => {
    const child = spawn(join(ROOT, "node_modules/.bin/hyperframes"), ["render", j.projectDir, "-o", out, "--quality", "looks"], {
      env: { ...process.env, HYPERFRAMES_NO_TELEMETRY: "1", DO_NOT_TRACK: "1" },
    });
    let log = "";
    child.stdout.on("data", (d) => (log += d));
    child.stderr.on("data", (d) => (log += d));
    child.on("close", (code) => {
      if (code === 0) { j.status = "done"; j.url = `/motion/${j.id}.mp4`; /* relativa al bridge */ resolve(j); }
      else { j.status = "error"; j.error = log.slice(-600); reject(new Error(j.error)); }
    });
  });
}

export function startMotion(provider: ProviderId, idea: string, seconds: number, style: Style) {
  const j: MotionJob = { id: randomUUID().slice(0, 8), status: "writing", seconds, projectDir: "" };
  jobs.set(j.id, j);
  writeMotionHtml(provider, motionBrief(idea, seconds, style))
    .then((html) => renderMotionHtml(html, seconds, j))
    .catch((e) => { j.status = "error"; j.error = (e as Error).message; });
  return j;
}
