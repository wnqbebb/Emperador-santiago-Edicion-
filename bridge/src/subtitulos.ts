// Presets de subtitulado (presets/subtitulos): con el video terminado, Santiago elige un preset y se aplica a TODO el video.
// Funciona igual con cualquier estilo: se dibuja sobre una versión sin subtítulos (que se guarda; cambiar de preset es rápido).
// Cada preset = 2 fuentes + estilo + animación, sacados de sus referencias; las palabras entran justo con la voz.
import { spawn, execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { PassThrough } from "node:stream";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const DIR = join(ROOT, "presets/subtitulos");
const PY = join(ROOT, "tools/.venv/bin/python");
const SEG = [join(ROOT, ".claude/skills/edit-director/engine/models/human_segmentation_pphumanseg_2023mar.onnx"),
  join(ROOT, ".claude/skills/arthur-brooks-editing/plugins/edit-studio/skills/edit-director/engine/models/human_segmentation_pphumanseg_2023mar.onnx")].find(existsSync);

export type Preset = { id: string; nombre: string; desc: string; palabras: number; silueta?: boolean };
export const presets = (): Preset[] => JSON.parse(readFileSync(join(DIR, "presets.json"), "utf8")).presets;
export type Palabra = { w: string; t0: number; t1: number };
type Frase = { t0: number; t1: number; words: { w: string; t: number; key: boolean }[] };

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\w]/g, "");

/** Frases del tamaño del preset (corta en pausas y puntuación) con UNA palabra clave por frase. */
export function frases(words: Palabra[], preset: Preset, claves: string[] = []): Frase[] {
  const set = new Set(claves.flatMap((k) => k.split(/\s+/)).map(norm).filter(Boolean));
  const out: Frase[] = [];
  let cur: Palabra[] = [];
  const cierra = (fin: number) => {
    if (!cur.length) return;
    const ws = cur.map((w) => ({ w: w.w.replace(/[.,;:¿?¡!"]+/g, ""), t: w.t0, key: false }));
    const k = ws.findIndex((w) => set.has(norm(w.w))) >= 0 ? ws.findIndex((w) => set.has(norm(w.w)))
      : ws.reduce((b, w, i) => (/\d/.test(w.w) || w.w.length > (ws[b]?.w.length ?? 0) ? i : b), 0);   // cifra o palabra más larga
    if (ws[k] && ws[k].w.length > 2) ws[k].key = true;
    out.push({ t0: cur[0].t0, t1: fin, words: ws });
    cur = [];
  };
  words.forEach((w, i) => {
    const prev = words[i - 1];
    if (cur.length && (cur.length >= preset.palabras || (prev && w.t0 - prev.t1 > 0.35) || /[.,;:?!]$/.test(prev?.w ?? ""))) cierra(w.t0);
    cur.push(w);
  });
  cierra((words.at(-1)?.t1 ?? 0) + 0.4);
  for (let i = 0; i < out.length - 1; i++) out[i].t1 = Math.min(out[i].t1, out[i + 1].t0, out[i].words.at(-1)!.t + 1.4);
  return out;
}

const dur = (v: string) => Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", v]).toString());

function ff(args: string[], input?: NodeJS.ReadableStream) {
  return new Promise<void>((ok, ko) => {
    const p = spawn("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", ...args]);
    let err = ""; p.stderr.on("data", (d) => (err += d));
    p.stdin.on("error", () => { /* el error real llega en close */ });
    p.on("close", (c) => (c === 0 ? ok() : ko(new Error(`ffmpeg: ${err.slice(-300)}`))));
    if (input) input.pipe(p.stdin);
  });
}

async function pagina(tl: object) {
  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ args: ["--allow-file-access-from-files"] });
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
  await page.addInitScript((d) => { (window as unknown as { TL: unknown }).TL = d; }, tl);
  await page.goto(pathToFileURL(join(DIR, "subtitulos.html")).href);
  await page.evaluate(() => (window as unknown as { ready: Promise<unknown> }).ready);
  return { browser, page };
}

/** Vista previa de un preset sobre un cuadro del propio video (PNG), sin renderizar nada. */
export async function muestra(video: string, words: Palabra[], presetId: string, claves: string[], out: string) {
  const p = presets().find((x) => x.id === presetId) ?? presets()[0];
  const fr = frases(words, p, claves);
  const f = fr.find((x) => x.words.some((w) => w.key) && x.t0 > 1.5) ?? fr[0];
  const t = f ? Math.min(f.t1 - 0.05, (f.words.at(-1)?.t ?? f.t0) + 0.3) : 1;
  const cuadro = out.replace(/\.png$/, "_fondo.jpg");
  execFileSync("ffmpeg", ["-v", "error", "-y", "-ss", t.toFixed(2), "-i", video, "-frames:v", "1", "-vf", "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920", "-q:v", "3", cuadro]);
  let persona: string | undefined;
  if (p.silueta && SEG) { persona = out.replace(/\.png$/, "_persona.png"); execFileSync(PY, [join(ROOT, "tools/silueta.py"), cuadro, SEG, persona]); }
  const { browser, page } = await pagina({ preset: p.id, capa: "todo", frases: fr, fondo: pathToFileURL(cuadro).href, persona: persona && pathToFileURL(persona).href });
  await page.evaluate((tt) => (window as unknown as { renderAt: (t: number) => void }).renderAt(tt), t);
  await page.locator("#c").screenshot({ path: out });
  await browser.close();
  return out;
}

/** Pasa la capa de subtítulos (cuadro a cuadro) por FFmpeg encima del video. filtro: cómo se mezcla [base][1:v]. */
async function capa(base: string, extra: string[], tl: object, filtro: string, salida: string, log: string[]) {
  const n = Math.round(dur(base) * 30);
  const { browser, page } = await pagina(tl);
  const pipe = new PassThrough();
  const inputs = ["-i", base, ...extra, "-f", "image2pipe", "-framerate", "30", "-c:v", "png", "-i", "-"];
  const render = ff([...inputs, "-filter_complex", filtro, "-map", "[v]", "-map", "0:a?", "-frames:v", String(n), "-c:v", "libx264", "-crf", "18", "-preset", "medium", "-pix_fmt", "yuv420p", "-c:a", "copy", "-movflags", "+faststart", salida], pipe);
  let dead: Error | null = null;
  render.catch((e) => { dead = e; });
  for (let i = 0; i < n && !dead; i++) {
    const b64 = await page.evaluate((t) => { (window as unknown as { renderAt: (t: number) => void }).renderAt(t); return (document.getElementById("c") as HTMLCanvasElement).toDataURL("image/png").split(",")[1]; }, i / 30);
    if (!pipe.write(Buffer.from(b64, "base64"))) await Promise.race([new Promise((r) => pipe.once("drain", r)), render.catch(() => null)]);
    if (i % 300 === 0) log.push(`  subtítulos: cuadro ${i}/${n}`);
  }
  pipe.end(); await browser.close(); await render;
}

/** Aplica el preset a TODO el video (base = versión sin subtítulos). Devuelve la ruta del video nuevo. */
export async function subtitular(base: string, words: Palabra[], presetId: string, claves: string[], salida: string, log: string[] = []) {
  const p = presets().find((x) => x.id === presetId);
  if (!p) throw new Error(`No existe el preset ${presetId}`);
  const fr = frases(words, p, claves);
  if (!p.silueta) {
    await capa(base, [], { preset: p.id, capa: "todo", frases: fr }, "[0:v][1:v]overlay=0:0:format=auto[v]", salida, log);
    return salida;
  }
  // «detrás de tu cabeza»: palabra gigante → persona recortada encima → resto de palabras delante
  if (!SEG) throw new Error("Falta el modelo de recorte de persona (npm run setup:ves)");
  const mask = salida.replace(/\.mp4$/, "_silueta.mp4");
  if (!existsSync(mask)) { log.push("  recortando a la persona cuadro a cuadro…"); execFileSync(PY, [join(ROOT, "tools/silueta.py"), base, SEG, mask], { maxBuffer: 64 << 20 }); }
  const medio = salida.replace(/\.mp4$/, "_detras.mp4");
  await capa(base, ["-i", mask], { preset: p.id, capa: "detras", frases: fr },
    "[0:v]split[b0][b1];[1:v]format=gray,scale=1080:1920[m];[b1][m]alphamerge[persona];[b0][2:v]overlay=0:0:format=auto[t];[t][persona]overlay=0:0[v]", medio, log);
  await capa(medio, [], { preset: p.id, capa: "delante", frases: fr }, "[0:v][1:v]overlay=0:0:format=auto[v]", salida, log);
  return salida;
}
