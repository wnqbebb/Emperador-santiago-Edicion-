// Ingeniería inversa de videos de referencia con rea-video (JuneYaooo/rea-video, Apache-2.0).
// rea-video desarma el video toma por toma (cortes, ritmo, subtítulos, sonido, look) en un paquete VIDEO.md;
// aquí lo convertimos en un Estilo de Santi (Style DNA) que el editor y la IA usan de inmediato.
import { spawn } from "node:child_process";
import { existsSync, readFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { DATA, getStyle, saveStyle } from "./store.js";
import { StyleSchema, type Style } from "./schema.js";
import { extractJson } from "./prompt.js";
import { ANTHROPIC_MODEL } from "./providers/anthropic.js";
import { planWithOpenAI, planWithGemini } from "./providers/keys.js";
import { runCli } from "./providers/subscriptions.js";
import type { ProviderId } from "./providers/index.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
export const REA_BIN = process.env.SANTI_REA_VIDEO ?? join(ROOT, "tools/.venv/bin/rea-video");
export const reaInstalled = () => existsSync(REA_BIN);

export function runReaVideo(videoPath: string, outDir: string, onLine?: (l: string) => void): Promise<void> {
  mkdirSync(outDir, { recursive: true });
  return new Promise((resolve, reject) => {
    const child = spawn(REA_BIN, ["decompose", videoPath, "-o", outDir, "--lang", "en"], { env: process.env });
    const feed = (d: Buffer) => d.toString().split("\n").filter(Boolean).forEach((l) => onLine?.(l));
    child.stdout.on("data", feed);
    child.stderr.on("data", feed);
    child.on("error", (e) => reject(new Error(`rea-video no está instalado (npm run setup:rea): ${e.message}`)));
    child.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`rea-video salió con código ${code}`))));
  });
}

/** Lo esencial del paquete VIDEO.md, en pocas miles de tokens. */
export function readDigest(outDir: string) {
  const part = (p: string, max = 6000) => (existsSync(join(outDir, p)) ? readFileSync(join(outDir, p), "utf8").slice(0, max) : "");
  return [part("VIDEO.md", 4000), part("video/rhythm.md"), part("video/packaging.md"), part("video/sound.md", 3000), part("video/look.md", 3000), part("video/timeline.md", 4000)]
    .filter(Boolean).join("\n\n---\n\n");
}

/** Sin IA: ritmo medido por rea-video (cortes por minuto, silencios). */
export function heuristicStyle(outDir: string, name: string): Style {
  const b = JSON.parse(readFileSync(join(outDir, "breakdown.json"), "utf8"));
  const dur = b.audio?.duration || b.shots?.at(-1)?.end || 1;
  const cuts = Math.max(0, (b.shots?.length ?? 1) - 1);
  const cpm = Math.round((cuts / dur) * 60);
  const base = getStyle("imperial")!;
  return {
    ...base,
    id: slug(name), name,
    description: `Aprendido con rea-video: ${b.shots?.length ?? 1} tomas en ${dur.toFixed(0)}s (${cpm} cortes/min).`,
    pacing: { maxSilence: cpm > 20 ? 0.25 : 0.45, cutsPerMinute: cpm, zoomEvery: cpm > 20 ? 2.5 : 4.5 },
  };
}

const STYLE_PROMPT = (name: string, digest: string) => `Eres el director de arte de "Emperador Santiago · Edición de Videos".
Abajo está el desglose (formato VIDEO.md, generado por rea-video) de un video de referencia que Santiago quiere imitar.
Conviértelo en un Style DNA llamado "${name}" (id en minúsculas con guiones). Toma el ritmo de cortes, cómo aparecen
los subtítulos (tamaño, color, contorno, mayúsculas, palabras por bloque, animación, posición), los gráficos y el color
de lo que dice el desglose; donde no diga nada, elige lo que mejor encaje con lo que sí se ve. En "notes" escribe 4-6
frases de guía para que un editor replique el estilo. Fuentes disponibles: Anton, Oswald, Inter, Playfair Display, Space Grotesk.

${digest}`;

export async function aiStyle(provider: ProviderId, outDir: string, name: string): Promise<Style> {
  const prompt = STYLE_PROMPT(name, readDigest(outDir));
  if (provider === "claude-api") {
    const client = new Anthropic();
    const msg = await client.beta.messages.parse({
      model: ANTHROPIC_MODEL, max_tokens: 8000,
      betas: ["server-side-fallback-2026-07-01"], fallbacks: "default",
      output_config: { effort: "high", format: betaZodOutputFormat(StyleSchema) },
      messages: [{ role: "user", content: prompt }],
    });
    if (msg.stop_reason === "refusal" || !msg.parsed_output) throw new Error("Claude no devolvió un estilo válido");
    return msg.parsed_output;
  }
  const { z } = await import("zod");
  const hint = `\n\nResponde SOLO con un JSON que cumpla este JSON Schema:\n${JSON.stringify(z.toJSONSchema(StyleSchema))}`;
  const raw = provider === "openai-api" ? await planWithOpenAI(hint, prompt)
    : provider === "gemini-api" ? await planWithGemini(hint, prompt)
    : await runCli(provider, prompt + hint);
  return StyleSchema.parse(extractJson(raw));
}

export const slug = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\w]+/g, "-").replace(/^-|-$/g, "") || "estilo";

// ---------- Trabajos de análisis (para la web)
export type Analysis = { id: string; status: "running" | "done" | "error"; log: string[]; outDir: string; style?: Style; error?: string };
const analyses = new Map<string, Analysis>();
export const getAnalysis = (id: string) => analyses.get(id);

export function startAnalysis(videoPath: string, name: string, provider?: ProviderId) {
  const id = randomUUID().slice(0, 8);
  const a: Analysis = { id, status: "running", log: [], outDir: join(DATA, "analysis", id) };
  analyses.set(id, a);
  (async () => {
    await runReaVideo(videoPath, a.outDir, (l) => { a.log.push(l); a.log = a.log.slice(-30); });
    let style = heuristicStyle(a.outDir, name);
    if (provider) style = { ...(await aiStyle(provider, a.outDir, name)), id: style.id, name };
    a.style = saveStyle(style);
    a.status = "done";
  })().catch((e) => { a.status = "error"; a.error = (e as Error).message; });
  return a;
}
