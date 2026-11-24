// Entrenar un Estilo de Santi a partir de un video de referencia:
//   npm run learn -- referencia.mp4 --name "Mi estilo" [--ai claude-api|claude-cli|codex-cli|gemini-cli]
// 1) rea-video desarma el video (tomas, ritmo, subtítulos, sonido, look) → data/analysis/<nombre>/VIDEO.md
// 2) Sin --ai: toma el ritmo medido. Con --ai: la IA lee el desglose y escribe el Style DNA completo.
import { join, resolve } from "node:path";
import { DATA, saveStyle } from "./store.js";
import { runReaVideo, heuristicStyle, aiStyle, slug, reaInstalled, REA_BIN } from "./analyze.js";
import type { ProviderId } from "./providers/index.js";

const args = process.argv.slice(2);
const opt = (k: string) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };
const name = opt("--name") ?? "Estilo aprendido";
const ai = opt("--ai") as ProviderId | undefined;
const file = args.find((a, i) => !a.startsWith("--") && !args[i - 1]?.startsWith("--"));
if (!file) { console.error('Uso: npm run learn -- video.mp4 --name "Mi estilo" [--ai claude-cli]'); process.exit(1); }
if (!reaInstalled()) { console.error(`Falta rea-video en ${REA_BIN}. Instálalo con: npm run setup:rea`); process.exit(1); }

const outDir = join(DATA, "analysis", slug(name));
console.log("rea-video está desarmando el video… (la primera vez descarga sus modelos)");
await runReaVideo(resolve(file), outDir, (l) => process.stdout.write(`  ${l}\n`));
let style = heuristicStyle(outDir, name);
if (ai) { console.log(`La IA (${ai}) convierte el desglose en estilo…`); style = { ...(await aiStyle(ai, outDir, name)), id: style.id, name }; }
saveStyle(style);
console.log(`\n✓ Estilo guardado: ${style.id}\n  Desglose completo: ${outDir}/VIDEO.md  ·  informe: ${outDir}/report.html`);
