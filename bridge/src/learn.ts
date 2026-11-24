// "Entrenar" un estilo a partir de videos de referencia:
//   npm run learn -- ref1.mp4 ref2.mp4 --name "Mi estilo"
// 1) Mide el ritmo con ffmpeg (cortes por minuto, silencios).
// 2) Extrae fotogramas y, si hay ANTHROPIC_API_KEY, Claude Fable describe tipografía, colores y animación.
// 3) Guarda un Style DNA en data/styles/ que la web y el MCP usan de inmediato.
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getStyle, saveStyle } from "./store.js";
import { describeFrames } from "./providers/anthropic.js";
import { extractJson } from "./prompt.js";
import type { Style } from "./schema.js";

const args = process.argv.slice(2);
const nameIdx = args.indexOf("--name");
const name = nameIdx >= 0 ? args[nameIdx + 1] : "Estilo aprendido";
const files = args.filter((a, i) => !a.startsWith("--") && i !== nameIdx + 1);
if (!files.length) {
  console.error('Uso: npm run learn -- video1.mp4 [video2.mp4] --name "Mi estilo"');
  process.exit(1);
}

function probeDuration(f: string) {
  return Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f]).toString());
}
function sceneCuts(f: string) {
  const r = spawnSync("ffmpeg", ["-i", f, "-filter:v", "select='gt(scene,0.3)',showinfo", "-f", "null", "-"], { encoding: "utf8" });
  return (r.stderr.match(/pts_time:[\d.]+/g) ?? []).length;
}
function silences(f: string) {
  const r = spawnSync("ffmpeg", ["-i", f, "-af", "silencedetect=n=-35dB:d=0.25", "-f", "null", "-"], { encoding: "utf8" });
  return (r.stderr.match(/silence_duration: ([\d.]+)/g) ?? []).map((s) => Number(s.split(": ")[1]));
}

let totalDur = 0, totalCuts = 0, longestSilence = 0;
const frames: string[] = [];
for (const f of files) {
  const d = probeDuration(f);
  totalDur += d;
  totalCuts += sceneCuts(f);
  longestSilence = Math.max(longestSilence, ...silences(f), 0);
  const dir = mkdtempSync(join(tmpdir(), "santi-"));
  execFileSync("ffmpeg", ["-v", "error", "-i", f, "-vf", `fps=${(4 / d).toFixed(4)},scale=540:-1`, "-q:v", "4", join(dir, "f%02d.jpg")]);
  for (const img of readdirSync(dir).slice(0, 4)) frames.push(readFileSync(join(dir, img)).toString("base64"));
}
const cutsPerMinute = Math.round((totalCuts / totalDur) * 60);
const base = getStyle("impacto")!;
let style: Style = {
  ...base,
  id: name.toLowerCase().normalize("NFD").replace(/[^\w]+/g, "-").replace(/^-|-$/g, ""),
  name,
  description: `Aprendido de ${files.length} referencia(s): ${cutsPerMinute} cortes/min.`,
  pacing: { maxSilence: Math.min(0.6, Math.max(0.15, longestSilence || 0.35)), cutsPerMinute, zoomEvery: cutsPerMinute > 20 ? 2.5 : 4 },
};

if (process.env.ANTHROPIC_API_KEY && frames.length) {
  console.log("Claude analiza los fotogramas…");
  const answer = await describeFrames(
    frames.slice(0, 12),
    `Son fotogramas de videos cortos de referencia. Describe su estilo de edición y devuelve SOLO un JSON con:
{"caption":{"font":"familia de Google Fonts más parecida","weight":400-900,"size":0.03-0.08,"color":"#hex","highlight":"#hex","stroke":"#hex o transparent","uppercase":bool,"wordsPerChunk":1-6,"animation":"pop|karaoke|fade|bounce","position":0-1},
"motion":{"emojis":bool,"hookTitle":bool,"progress":bool,"lowerThird":bool},
"grade":{"contrast":0.8-1.4,"saturate":0.6-1.6,"brightness":0.8-1.2},
"notes":"guía de 3-5 frases para que un editor replique el estilo"}`,
  );
  const learned = extractJson(answer) as Partial<Style>;
  style = { ...style, ...learned, caption: { ...style.caption, ...learned.caption } } as Style;
}
console.log("Guardado:", saveStyle(style).id, JSON.stringify(style.pacing));
