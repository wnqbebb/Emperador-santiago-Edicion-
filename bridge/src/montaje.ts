// Unión de clips y recortes de silencio.
// Evolución de la V4 de Santiago (que medía el volumen con un umbral fijo en el navegador), ahora con FFmpeg:
//  1. Umbral ADAPTATIVO por clip: mide el ruido de fondo y el nivel de voz de cada clip (no un −42 dB fijo).
//  2. Cortes que respetan las palabras: con Whisper nunca corta a mitad de palabra y puede quitar muletillas (eh, mmm…).
//  3. Cada corte se ajusta al punto más silencioso cercano y lleva un fundido de 8 ms: sin clics ni "pop".
//  4. Une todos los clips en orden, al mismo tamaño y 30 fps, normaliza a −14 LUFS y entrega master + versión comprimida.
import { spawn, execFileSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { DATA } from "./store.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const PY = join(ROOT, "tools/.venv/bin/python");
export const MONTAJE_DIR = join(DATA, "montaje");
mkdirSync(MONTAJE_DIR, { recursive: true });

export type Ritmo = "natural" | "dinamico" | "agresivo";
export type Formato = "vertical" | "original";
export type MontajeOpts = { ritmo: Ritmo; muletillas: boolean; formato: Formato; idioma?: string };
type Range = [number, number];
export type ClipReport = { name: string; before: number; after: number; cuts: number; keep: Range[]; threshold: number; fillers: number };
export type MontajeJob = {
  id: string; status: "running" | "done" | "error"; step: string; progress: number;
  clips: ClipReport[]; master?: string; web?: string; masterMB?: number; webMB?: number; error?: string;
};
const jobs = new Map<string, MontajeJob>();
export const getMontaje = (id: string) => jobs.get(id);

// Parámetros por ritmo: pausa mínima que se corta y aire que se deja antes/después de la voz
const RITMOS: Record<Ritmo, { minGap: number; pre: number; post: number }> = {
  natural: { minGap: 0.42, pre: 0.1, post: 0.16 },
  dinamico: { minGap: 0.24, pre: 0.06, post: 0.1 },
  agresivo: { minGap: 0.14, pre: 0.035, post: 0.06 },
};
const FRAME = 0.01; // 10 ms
const FILLER = /^(e+h*|e+m+|m+|m+h+|a+h+|u+m+|u+h+|ehm+|mmm+)$/i;

const r3 = (x: number) => Math.round(x * 1000) / 1000;

function probe(file: string) {
  const out = JSON.parse(execFileSync("ffprobe", ["-v", "error", "-show_entries", "stream=codec_type,width,height:format=duration", "-of", "json", file]).toString());
  const v = out.streams.find((s: { codec_type: string }) => s.codec_type === "video");
  return { duration: Number(out.format.duration), width: v?.width ?? 1080, height: v?.height ?? 1920, audio: out.streams.some((s: { codec_type: string }) => s.codec_type === "audio") };
}

/** Energía (dB) cada 10 ms, del audio en mono 16 kHz. */
function levels(file: string): Float32Array {
  const pcm = execFileSync("ffmpeg", ["-v", "error", "-i", file, "-vn", "-ac", "1", "-ar", "16000", "-f", "s16le", "-"], { maxBuffer: 1 << 30 });
  const samples = new Int16Array(pcm.buffer, pcm.byteOffset, Math.floor(pcm.length / 2));
  const n = 160, out = new Float32Array(Math.ceil(samples.length / n));
  for (let i = 0; i < out.length; i++) {
    let p = 0;
    const a = i * n, b = Math.min(samples.length, a + n);
    for (let k = a; k < b; k++) p += (samples[k] / 32768) ** 2;
    out[i] = 10 * Math.log10(p / Math.max(1, b - a) + 1e-10);
  }
  return out;
}

const pct = (arr: Float32Array, q: number) => { const s = Float32Array.from(arr).sort(); return s[Math.min(s.length - 1, Math.floor(q * s.length))]; };

/** Rangos de voz con umbral adaptativo (ruido de fondo vs. nivel de voz del propio clip). */
export function speechRanges(db: Float32Array, duration: number, ritmo: Ritmo) {
  const { minGap, pre, post } = RITMOS[ritmo];
  const floor = pct(db, 0.12), voice = pct(db, 0.92);
  const thr = Math.max(-62, Math.min(-18, Math.max(floor + 7, floor + 0.32 * (voice - floor))));
  // voz = por encima del umbral, con 60 ms de "retención" para no cortar finales de sílaba
  const on = Array.from(db, (v) => v > thr);
  for (let i = 0, hold = 0; i < on.length; i++) { if (on[i]) hold = 6; else if (hold-- > 0) on[i] = true; }
  let ranges: Range[] = [];
  for (let i = 0; i < on.length; i++) {
    if (!on[i]) continue;
    let j = i; while (j < on.length && on[j]) j++;
    ranges.push([i * FRAME, j * FRAME]); i = j;
  }
  // fuera "islas" de ruido: < 100 ms y sin fuerza
  ranges = ranges.filter(([a, b]) => b - a >= 0.1 || Math.max(...db.slice(Math.floor(a / FRAME), Math.ceil(b / FRAME))) > thr + 10);
  // unir pausas más cortas que la pausa mínima del ritmo
  const merged: Range[] = [];
  for (const r of ranges) {
    const last = merged[merged.length - 1];
    if (last && r[0] - last[1] < minGap) last[1] = r[1]; else merged.push([...r] as Range);
  }
  // aire antes/después y ajuste al punto más silencioso cercano (±40 ms)
  const quietest = (t: number) => {
    const c = Math.round(t / FRAME); let best = c;
    for (let k = c - 4; k <= c + 4; k++) if (k >= 0 && k < db.length && db[k] < db[best]) best = k;
    return best * FRAME;
  };
  const keep: Range[] = merged.map(([a, b]) => [Math.max(0, quietest(a - pre)), Math.min(duration, quietest(b + post))]);
  const out: Range[] = [];
  for (const r of keep) { const last = out[out.length - 1]; if (last && r[0] <= last[1] + 0.02) last[1] = Math.max(last[1], r[1]); else out.push(r); }
  return { keep: out.map(([a, b]) => [r3(a), r3(b)] as Range), threshold: Math.round(thr) };
}

/** Con palabras: nunca cortar dentro de una palabra y quitar muletillas.
 *  Ojo: Whisper suele dar tiempos imprecisos en los bordes (p. ej. la 1.ª palabra "empieza" en 0.0 aunque haya silencio),
 *  así que una palabra solo alarga un corte hasta donde la energía confirma que hay voz. */
function refineWithWords(keep: Range[], words: { w: string; t0: number; t1: number }[], quitarMuletillas: boolean, db: Float32Array, thr: number) {
  const voiced = (t: number) => (db[Math.round(t / FRAME)] ?? -100) > thr - 6;
  let out = keep.map((r) => [...r] as Range);
  for (const w of words) {
    for (const r of out) {
      if (w.t0 < r[0] && w.t1 > r[0]) { let t = r[0]; while (t - FRAME >= Math.max(0, w.t0) && voiced(t - FRAME)) t -= FRAME; r[0] = Math.max(0, t - 0.03); }
      if (w.t0 < r[1] && w.t1 > r[1]) { let t = r[1]; while (t + FRAME <= w.t1 && voiced(t + FRAME)) t += FRAME; r[1] = t + 0.04; }
    }
  }
  const clean = (w: string) => w.toLowerCase().normalize("NFD").replace(/[^a-z]/g, "");
  let fillers = 0;
  if (quitarMuletillas) {
    for (const w of words) {
      if (!FILLER.test(clean(w.w))) continue;
      fillers++;
      const a = w.t0 - 0.02, b = w.t1 + 0.02;
      out = out.flatMap(([x, y]): Range[] => (b <= x || a >= y ? [[x, y] as Range] : ([[x, a], [b, y]] as Range[]).filter(([p, q]) => q - p > 0.08)));
    }
    // fuera los restos que ya no contienen ninguna palabra real (el "aire" que quedaba alrededor de la muletilla)
    const real = words.filter((w) => clean(w.w) && !FILLER.test(clean(w.w)));
    out = out.filter(([x, y]) => real.some((w) => Math.min(y, w.t1) - Math.max(x, w.t0) > 0.05));
  }
  return { keep: out.map(([a, b]) => [r3(a), r3(b)] as Range), fillers };
}

function ffmpeg(args: string[], onTime?: (t: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const c = spawn("ffmpeg", ["-hide_banner", "-y", ...args]);
    let err = "";
    c.stderr.on("data", (d) => {
      const s = d.toString(); err = (err + s).slice(-3000);
      const m = s.match(/time=(\d+):(\d+):([\d.]+)/);
      if (m && onTime) onTime(+m[1] * 3600 + +m[2] * 60 + +m[3]);
    });
    c.on("close", (code) => (code === 0 ? resolve() : reject(new Error(err.split("\n").slice(-4).join(" ")))));
  });
}

export function startMontaje(files: { path: string; name: string }[], opts: MontajeOpts) {
  const id = randomUUID().slice(0, 8);
  const dir = join(MONTAJE_DIR, id);
  mkdirSync(dir, { recursive: true });
  const job: MontajeJob = { id, status: "running", step: "Preparando", progress: 0, clips: [] };
  jobs.set(id, job);
  run(job, dir, files, opts).catch((e) => { job.status = "error"; job.error = (e as Error).message; });
  return job;
}

async function run(job: MontajeJob, dir: string, files: { path: string; name: string }[], opts: MontajeOpts) {
  const infos = files.map((f) => ({ ...f, ...probe(f.path) }));
  const W = opts.formato === "vertical" ? 1080 : infos[0].width - (infos[0].width % 2);
  const H = opts.formato === "vertical" ? 1920 : infos[0].height - (infos[0].height % 2);
  const n = infos.length;

  // 1) Análisis: dónde hay voz en cada clip
  for (const [i, f] of infos.entries()) {
    job.step = `Buscando silencios · clip ${i + 1} de ${n}`;
    job.progress = 0.05 + 0.35 * (i / n);
    let keep: Range[] = [[0, f.duration]], threshold = 0, fillers = 0;
    if (f.audio) {
      const db = levels(f.path);
      const r = speechRanges(db, f.duration, opts.ritmo);
      keep = r.keep.length ? r.keep : keep; threshold = r.threshold;
      if (opts.muletillas && existsSync(PY)) {
        job.step = `Leyendo palabras con Whisper · clip ${i + 1} de ${n}`;
        const wav = join(dir, `a${i}.wav`);
        execFileSync("ffmpeg", ["-v", "error", "-y", "-i", f.path, "-vn", "-ac", "1", "-ar", "16000", wav]);
        const words = JSON.parse(execFileSync(PY, [join(ROOT, "tools/palabras.py"), wav, "small", opts.idioma ?? "es"], { maxBuffer: 1 << 26 }).toString());
        ({ keep, fillers } = refineWithWords(keep, words, true, db, threshold));
        if (!keep.length) keep = r.keep;
      }
    }
    const after = keep.reduce((t, [a, b]) => t + b - a, 0);
    job.clips.push({ name: f.name, before: r3(f.duration), after: r3(after), cuts: Math.max(0, keep.length - 1), keep, threshold, fillers });
  }

  // 2) Recorte de cada clip al mismo formato (tamaño, 30 fps, audio 48 kHz) con fundidos de 8 ms en cada corte
  const parts: string[] = [];
  for (const [i, f] of infos.entries()) {
    job.step = `Recortando y uniendo · clip ${i + 1} de ${n}`;
    const keep = job.clips[i].keep;
    const fit = opts.formato === "vertical"
      ? `scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H}`
      : `scale=${W}:${H}:force_original_aspect_ratio=decrease,pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2`;
    const fc: string[] = [];
    keep.forEach(([a, b], k) => {
      const d = r3(b - a), fo = r3(Math.max(0, d - 0.008));
      fc.push(`[0:v]trim=${a}:${b},setpts=PTS-STARTPTS,${fit},fps=30,setsar=1,format=yuv420p[v${k}]`);
      fc.push(f.audio
        ? `[0:a]atrim=${a}:${b},asetpts=PTS-STARTPTS,aresample=48000,aformat=channel_layouts=stereo,afade=t=in:d=0.008,afade=t=out:st=${fo}:d=0.008[a${k}]`
        : `anullsrc=r=48000:cl=stereo,atrim=0:${d}[a${k}]`);
    });
    fc.push(`${keep.map((_, k) => `[v${k}][a${k}]`).join("")}concat=n=${keep.length}:v=1:a=1[v][a]`);
    const out = join(dir, `p${String(i).padStart(3, "0")}.mp4`);
    const total = job.clips[i].after;
    await ffmpeg(["-i", f.path, "-filter_complex", fc.join(";"), "-map", "[v]", "-map", "[a]", "-c:v", "libx264", "-preset", "medium", "-crf", "16", "-c:a", "pcm_s16le", "-f", "mov", out.replace(".mp4", ".mov")],
      (t) => (job.progress = 0.4 + 0.4 * ((i + Math.min(1, t / Math.max(0.1, total))) / n)));
    parts.push(out.replace(".mp4", ".mov"));
  }

  // 3) Render: unir todo y normalizar el volumen (−14 LUFS, pico −1 dB)
  job.step = "Renderizando el video completo";
  job.progress = 0.82;
  const list = join(dir, "lista.txt");
  writeFileSync(list, parts.map((p) => `file '${p.replace(/'/g, "'\\''")}'`).join("\n"));
  const master = join(dir, "video-completo.mp4");
  await ffmpeg(["-f", "concat", "-safe", "0", "-i", list, "-c:v", "copy", "-af", "loudnorm=I=-14:TP=-1:LRA=11", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", master]);

  // 4) Compresión para redes (misma imagen, archivo mucho más liviano)
  job.step = "Comprimiendo para redes";
  job.progress = 0.9;
  const web = join(dir, "video-completo-redes.mp4");
  const totalAfter = job.clips.reduce((t, c) => t + c.after, 0);
  await ffmpeg(["-i", master, "-c:v", "libx264", "-preset", "slow", "-crf", "24", "-maxrate", "6M", "-bufsize", "12M", "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", web],
    (t) => (job.progress = 0.9 + 0.1 * Math.min(1, t / Math.max(0.1, totalAfter))));

  const mb = (p: string) => Math.round((statSync(p).size / 1048576) * 10) / 10;
  Object.assign(job, { status: "done", step: "Listo", progress: 1, master, web, masterMB: mb(master), webMB: mb(web) });
  writeFileSync(join(dir, "informe.json"), JSON.stringify(job, null, 2));
}
