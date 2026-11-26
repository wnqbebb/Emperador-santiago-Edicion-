// Unión de clips y recortes de silencio desde la terminal:
//   npm run unir -- carpeta/  [--ritmo natural|dinamico|agresivo] [--muletillas] [--formato vertical|original]
//   npm run unir -- "clip 1.mp4" "clip 2.mp4" …
//   npm run unir -- video.webm --instagram [--salida carpeta/] [--look cine]
//     --instagram = todo para entregar: tomas repetidas, muletillas, voz mejorada, corrección de color «pro»,
//                   9:16, volumen de redes y subtítulos .srt (sin agrandar videos pequeños)
import { readdirSync, statSync, copyFileSync } from "node:fs";
import { join, resolve, basename } from "node:path";
import { startMontaje, getMontaje, type Ritmo, type Formato } from "./montaje.js";

const args = process.argv.slice(2);
const opt = (k: string) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };
const conValor = ["--ritmo", "--formato", "--velocidad", "--look", "--salida"];
const inputs = args.filter((a, i) => !a.startsWith("--") && !conValor.includes(args[i - 1]));
const ig = args.includes("--instagram");
if (!inputs.length) { console.error("Uso: npm run unir -- carpeta/ [--ritmo dinamico] [--muletillas] [--repetidas] [--mejorar-audio] [--velocidad 1.1] [--srt] [--formato vertical]"); process.exit(1); }
const CWD = process.env.INIT_CWD ?? process.cwd(); // npm ejecuta el workspace en bridge/: usamos la carpeta desde donde lo llamaste
const coll = new Intl.Collator("es", { numeric: true, sensitivity: "base" });
let files = inputs.map((p) => resolve(CWD, p));
if (files.length === 1 && statSync(files[0]).isDirectory()) {
  const dir = files[0];
  files = readdirSync(dir).filter((f) => /\.(mp4|mov|m4v|webm|mkv)$/i.test(f)).sort(coll.compare).map((f) => join(dir, f));
}
console.log("Orden:\n" + files.map((f, i) => `  ${i + 1}. ${basename(f)}`).join("\n"));
const job = startMontaje(files.map((p) => ({ path: p, name: basename(p) })), {
  ritmo: (opt("--ritmo") as Ritmo) ?? "dinamico", muletillas: ig || args.includes("--muletillas"), formato: (opt("--formato") as Formato) ?? "vertical",
  repetidas: ig || args.includes("--repetidas"), mejorarAudio: ig || args.includes("--mejorar-audio"), velocidad: Number(opt("--velocidad") ?? 1), srt: ig || args.includes("--srt"),
  look: opt("--look") ?? (ig ? "pro" : undefined),
});
let last = "";
while (getMontaje(job.id)!.status === "running") {
  await new Promise((r) => setTimeout(r, 500));
  const line = `${job.step} · ${Math.round(job.progress * 100)}%`;
  if (line !== last) { process.stdout.write(`\r${line.padEnd(60)}`); last = line; }
}
if (job.status === "error") { console.error(`\nError: ${job.error}`); process.exit(1); }
const SAL = resolve(CWD, opt("--salida") ?? ".");
(await import("node:fs")).mkdirSync(SAL, { recursive: true });
const base = basename(files[0]).replace(/\.\w+$/, "");
const out = resolve(SAL, `${base}_master.mp4`), outWeb = resolve(SAL, `${base}_instagram.mp4`);
copyFileSync(job.master!, out); copyFileSync(job.web!, outWeb);
if (job.srt) copyFileSync(job.srt, resolve(SAL, `${base}.srt`));
const b = job.clips.reduce((t, c) => t + c.before, 0), a = job.clips.reduce((t, c) => t + c.after, 0);
console.log(`\n✓ ${b.toFixed(1)} s → ${a.toFixed(1)} s (−${(b - a).toFixed(1)} s)\n  ${out} (${job.masterMB} MB)\n  ${outWeb} (${job.webMB} MB)`);
process.exit(0);
