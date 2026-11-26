import { cpus } from "node:os";
// Unión de clips y recortes de silencio.
// Evolución de la V4 de Santiago (que medía el volumen con un umbral fijo en el navegador), ahora con FFmpeg:
//  1. Umbral ADAPTATIVO por clip: mide el ruido de fondo y el nivel de voz de cada clip (no un −42 dB fijo).
//  2. Cortes que respetan las palabras: con Whisper nunca corta a mitad de palabra y puede quitar muletillas (eh, mmm…).
//  3. Cada corte se ajusta al punto más silencioso cercano y lleva un fundido de 8 ms: sin clics ni "pop".
//  4. Une todos los clips en orden, al mismo tamaño y 30 fps, normaliza a −14 LUFS y entrega master + versión comprimida.
import { filtroLook } from "./luts.js";
import { spawn, execFile, execFileSync } from "node:child_process";
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
export type MontajeOpts = {
  ritmo: Ritmo; muletillas: boolean; formato: Formato; idioma?: string;
  repetidas?: boolean;        // quitar tomas repetidas / arranques en falso (se queda la última toma)
  mejorarAudio?: boolean;     // quitar ruido de fondo, EQ de voz y compresión
  velocidad?: number;         // 1 · 1.1 · 1.2 (ritmo de redes)
  srt?: boolean;              // subtítulos .srt del video final
  look?: string;              // LUT de color (presets/luts)
};
type Range = [number, number];
type Word = { w: string; t0: number; t1: number };
export type Corte = { start: number; end: number; reason: "silencio" | "muletilla" | "toma repetida"; text?: string };
export type ClipReport = {
  name: string; before: number; after: number; cuts: number; keep: Range[]; threshold: number; fillers: number;
  repeated?: number; cortes?: Corte[]; peaks?: number[];
};
export type MontajeJob = {
  id: string; status: "running" | "analizado" | "done" | "error"; step: string; progress: number;
  clips: ClipReport[]; master?: string; web?: string; srt?: string; masterMB?: number; webMB?: number; error?: string;
  opts?: MontajeOpts;
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

const norm = (w: string) => w.toLowerCase().normalize("NFD").replace(/[^a-z0-9ñ]/g, "");

/** Tomas repetidas / arranques en falso: si una frase corta se vuelve a empezar enseguida, se queda la última. */
function repeatedTakes(words: Word[]): { start: number; end: number; text: string }[] {
  const phrases: Word[][] = [];
  let cur: Word[] = [];
  for (const w of words) {
    const prev = cur[cur.length - 1];
    if (prev && (w.t0 - prev.t1 > 0.45 || /[.!?…]$/.test(prev.w))) { phrases.push(cur); cur = []; }
    cur.push(w);
  }
  if (cur.length) phrases.push(cur);
  const out: { start: number; end: number; text: string }[] = [];
  for (let i = 0; i < phrases.length - 1; i++) {
    const a = phrases[i].map((w) => norm(w.w)).filter(Boolean);
    if (a.length < 2 || a.length > 10) continue;
    for (const j of [i + 1, i + 2]) {
      const b = phrases[j]?.map((w) => norm(w.w)).filter(Boolean);
      if (!b) continue;
      const prefix = a[0] === b[0] && a[1] === b[1];
      const inB = a.filter((x) => b.includes(x)).length / a.length;
      if (prefix && inB >= 0.6) {
        out.push({ start: phrases[i][0].t0 - 0.02, end: phrases[j][0].t0 - 0.03, text: phrases[i].map((w) => w.w).join(" ") });
        break;
      }
    }
  }
  return out;
}

const subtract = (keep: Range[], cut: Range): Range[] =>
  keep.flatMap(([x, y]): Range[] => (cut[1] <= x || cut[0] >= y ? [[x, y]] : ([[x, cut[0]], [cut[1], y]] as Range[]).filter(([p, q]) => q - p > 0.08)));

/** Lo que se quita = el complemento de lo que se conserva, con su motivo. */
function cortesDe(keep: Range[], dur: number, marks: Corte[]): Corte[] {
  const gaps: Range[] = [];
  let t = 0;
  for (const [a, b] of keep) { if (a - t > 0.05) gaps.push([t, a]); t = b; }
  if (dur - t > 0.05) gaps.push([t, dur]);
  return gaps.map(([a, b]) => {
    const m = marks.find((x) => Math.min(b, x.end) - Math.max(a, x.start) > 0.5 * Math.min(b - a, x.end - x.start));
    return { start: r3(a), end: r3(b), reason: m?.reason ?? "silencio", text: m?.text };
  });
}

const peaksOf = (db: Float32Array, thr: number) => {
  const n = 300, step = Math.max(1, Math.floor(db.length / n)), out: number[] = [];
  for (let i = 0; i < db.length; i += step) { let m = -120; for (let k = i; k < Math.min(db.length, i + step); k++) m = Math.max(m, db[k]); out.push(Math.round(Math.max(0, Math.min(1, (m - (thr - 25)) / 45)) * 100) / 100); }
  return out;
};

const wordsCache = new Map<string, Word[][]>(); // palabras por clip (para el .srt)

/** Fase 1: analizar (no renderiza). Devuelve por clip qué se conserva y qué se quita y por qué. */
async function analyze(job: MontajeJob, dir: string, files: { path: string; name: string }[], opts: MontajeOpts) {
  const n = files.length;
  const allWords: Word[][] = [];
  const useWords = (opts.muletillas || opts.repetidas || opts.srt) && existsSync(PY);
  // Rápido: el audio de todos los clips se extrae a la vez y Whisper se carga UNA sola vez para todos
  let transcritos: Word[][] = [];
  if (useWords) {
    job.step = `Leyendo palabras con Whisper · ${n} clip(s) a la vez`;
    const wavs = files.map((_, i) => join(dir, `a${i}.wav`));
    await Promise.all(files.map((f, i) => ffmpeg(["-i", f.path, "-vn", "-ac", "1", "-ar", "16000", wavs[i]]).catch(() => null)));
    const conAudio = wavs.filter((w) => existsSync(w));
    const out = await new Promise<string>((ok, ko) => execFile(PY, [join(ROOT, "tools/palabras.py"), ...conAudio, "--modelo", "small", "--idioma", opts.idioma ?? "es"], { maxBuffer: 1 << 28 }, (e: Error | null, so: string) => (e ? ko(e) : ok(so))));
    const lista = JSON.parse(out) as Word[][];
    transcritos = wavs.map((w) => (existsSync(w) ? lista[conAudio.indexOf(w)] ?? [] : []));
  }
  for (const [i, f] of files.entries()) {
    const info = probe(f.path);
    job.step = `Buscando silencios · clip ${i + 1} de ${n}`;
    job.progress = 0.05 + 0.9 * (i / n);
    let keep: Range[] = [[0, info.duration]], threshold = 0, fillers = 0, repeated = 0, peaks: number[] = [];
    const marks: Corte[] = [];
    let words: Word[] = [];
    if (info.audio) {
      const db = levels(f.path);
      const r = speechRanges(db, info.duration, opts.ritmo);
      keep = r.keep.length ? r.keep : keep; threshold = r.threshold; peaks = peaksOf(db, threshold);
      if (useWords) {
        words = transcritos[i] ?? [];
        const refined = refineWithWords(keep, words, !!opts.muletillas, db, threshold);
        if (refined.keep.length) keep = refined.keep;
        fillers = refined.fillers;
        if (opts.muletillas) for (const w of words) if (FILLER.test(norm(w.w))) marks.push({ start: w.t0, end: w.t1, reason: "muletilla", text: w.w });
        if (opts.repetidas) for (const rt of repeatedTakes(words)) { keep = subtract(keep, [rt.start, rt.end]); marks.push({ ...rt, reason: "toma repetida" }); repeated++; }
      }
    }
    allWords.push(words);
    const after = keep.reduce((t, [a, b]) => t + b - a, 0);
    job.clips.push({ name: f.name, before: r3(info.duration), after: r3(after), cuts: Math.max(0, keep.length - 1), keep, threshold, fillers, repeated, cortes: cortesDe(keep, info.duration, marks), peaks });
  }
  wordsCache.set(job.id, allWords);
}

/** Fase 2: recortar con lo aprobado, unir, mejorar el audio, renderizar y comprimir. */
async function render(job: MontajeJob, dir: string, files: { path: string; name: string }[], opts: MontajeOpts) {
  const infos = files.map((f) => ({ ...f, ...probe(f.path) }));
  const W = opts.formato === "vertical" ? 1080 : infos[0].width - (infos[0].width % 2);
  const H = opts.formato === "vertical" ? 1920 : infos[0].height - (infos[0].height % 2);
  const n = infos.length;
  const sp = Math.max(1, Math.min(1.5, opts.velocidad ?? 1));
  const parts: (string | null)[] = new Array(n).fill(null);
  const avance = new Array(n).fill(0);
  let listos = 0;
  // varios clips a la vez (cada FFmpeg ya usa varios núcleos; 2–3 en paralelo aprovechan el resto)
  const enParalelo = Math.max(1, Math.min(3, Math.floor(cpus().length / 2)));
  const uno = async (i: number) => {
    const f = infos[i];
    const keep = job.clips[i].keep;
    if (!keep.length) return;
    const fit = opts.formato === "vertical"
      ? `scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H}`
      : `scale=${W}:${H}:force_original_aspect_ratio=decrease,pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2`;
    const lut = filtroLook(opts.look);
    const fc: string[] = [];
    // Rápido: el video se decodifica, escala y colorea UNA sola vez; select se queda con los tramos (sin buffers enormes).
    // Los cortes van alineados a cuadros de 30 fps para que imagen y voz nunca se desfasen.
    const q = (x: number) => Math.round(x * 30) / 30;
    const tramos = keep.map(([a, b]) => [q(a), q(b)] as Range).filter(([a, b]) => b - a >= 1 / 30);
    const sel = tramos.map(([a, b]) => `gte(t\\,${(a - 0.001).toFixed(4)})*lt(t\\,${(b - 0.001).toFixed(4)})`).join("+");
    const vel = sp !== 1 ? `,setpts=PTS/${sp}` : "";
    // el LUT se aplica en la imagen más pequeña (antes o después de escalar): mismo color, hasta 3× más rápido
    const lutAntes = lut && f.width * f.height <= W * H;
    fc.push(`[0:v]fps=30,select='${sel}',setpts=N/30/TB${lutAntes ? `,${lut}` : ""},${fit}${lut && !lutAntes ? `,${lut}` : ""},setsar=1,format=yuv420p${vel}[v]`);
    tramos.forEach(([a, b], k) => {
      const d = r3(b - a), fo = r3(Math.max(0, d - 0.008));
      fc.push(f.audio
        ? `[0:a]atrim=${a.toFixed(4)}:${b.toFixed(4)},asetpts=PTS-STARTPTS,aresample=48000,aformat=channel_layouts=stereo,afade=t=in:d=0.008,afade=t=out:st=${fo}:d=0.008[a${k}]`
        : `anullsrc=r=48000:cl=stereo,atrim=0:${d}[a${k}]`);
    });
    fc.push(`${tramos.map((_, k) => `[a${k}]`).join("")}concat=n=${tramos.length}:v=0:a=1${sp !== 1 ? `[ac];[ac]atempo=${sp}` : ""}[a]`);
    const out = join(dir, `p${String(i).padStart(3, "0")}.mov`);
    const total = job.clips[i].after / sp;
    await ffmpeg(["-i", f.path, "-filter_complex", fc.join(";"), "-map", "[v]", "-map", "[a]", "-r", "30", "-c:v", "libx264", "-preset", "superfast", "-crf", "15", "-c:a", "pcm_s16le", "-f", "mov", out],
      (t) => { avance[i] = Math.min(1, t / Math.max(0.1, total)); job.progress = 0.05 + 0.7 * (avance.reduce((a, b) => a + b, 0) / n); });
    parts[i] = out;
    job.step = `Recortando y uniendo · ${++listos} de ${n} clips listos`;
  };
  job.step = `Recortando y uniendo · ${n} clips (${enParalelo} a la vez)`;
  let siguiente = 0;
  await Promise.all(Array.from({ length: enParalelo }, async () => { while (siguiente < n) await uno(siguiente++); }));

  // Render: unir todo, mejorar la voz (opcional) y normalizar el volumen (−14 LUFS, pico −1 dB)
  job.step = opts.mejorarAudio ? "Renderizando y mejorando la voz" : "Renderizando el video completo";
  job.progress = 0.78;
  const list = join(dir, "lista.txt");
  writeFileSync(list, (parts.filter(Boolean) as string[]).map((p) => `file '${p.replace(/'/g, "'\\''")}'`).join("\n"));
  const master = join(dir, "video-completo.mp4");
  const voz = "highpass=f=75,afftdn=nf=-28:tn=1,equalizer=f=220:t=q:w=1.2:g=-2,equalizer=f=3200:t=q:w=1.4:g=2.5,acompressor=threshold=-21dB:ratio=3:attack=6:release=90:makeup=2,";
  await ffmpeg(["-f", "concat", "-safe", "0", "-i", list, "-c:v", "copy", "-af", `${opts.mejorarAudio ? voz : ""}loudnorm=I=-14:TP=-1:LRA=11`, "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", master]);

  // Compresión para redes (misma imagen, archivo mucho más liviano)
  job.step = "Comprimiendo para redes";
  job.progress = 0.9;
  const web = join(dir, "video-completo-redes.mp4");
  const totalAfter = job.clips.reduce((t, c) => t + c.after, 0) / sp;
  await ffmpeg(["-i", master, "-c:v", "libx264", "-preset", "veryfast", "-crf", "23", "-maxrate", "6M", "-bufsize", "12M", "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", web],
    (t) => (job.progress = 0.9 + 0.1 * Math.min(1, t / Math.max(0.1, totalAfter))));

  // Subtítulos .srt del video final (palabras de Whisper llevadas al tiempo editado)
  const words = wordsCache.get(job.id);
  if (opts.srt && words?.some((w) => w.length)) {
    const cues: { a: number; b: number; t: string }[] = [];
    let offset = 0;
    job.clips.forEach((c, i) => {
      // una palabra cuenta si su centro quedó dentro de un tramo conservado; sus bordes se ajustan a ese tramo
      const span = (t0: number, t1: number): [number, number] | null => {
        let acc = 0; const mid = (t0 + t1) / 2;
        for (const [a, b] of c.keep) { if (mid >= a && mid <= b) return [acc + Math.max(t0, a) - a, acc + Math.min(t1, b) - a]; acc += b - a; }
        return null;
      };
      type Cue = { a: number; b: number; ws: string[] };
      let cur = null as Cue | null;
      for (const w of words[i] ?? []) {
        const sp2 = span(w.t0, w.t1);
        if (!sp2) continue;
        const [a, b] = sp2;
        const A = offset + a / sp, B = offset + b / sp;
        if (cur && (cur.ws.length >= 5 || A - cur.b > 0.4 || B - cur.a > 2.8)) { cues.push({ a: cur.a, b: cur.b, t: cur.ws.join(" ") }); cur = null; }
        cur = cur ? { a: cur.a, b: B, ws: [...cur.ws, w.w] } : { a: A, b: B, ws: [w.w] };
      }
      if (cur) cues.push({ a: cur.a, b: cur.b, t: cur.ws.join(" ") });
      offset += c.after / sp;
    });
    const ts = (x: number) => new Date(Math.max(0, x) * 1000).toISOString().slice(11, 23).replace(".", ",");
    const srt = join(dir, "video-completo.srt");
    writeFileSync(srt, cues.map((c, k) => `${k + 1}\n${ts(c.a)} --> ${ts(c.b)}\n${c.t}\n`).join("\n"));
    job.srt = srt;
  }

  const mb = (p: string) => Math.round((statSync(p).size / 1048576) * 10) / 10;
  Object.assign(job, { status: "done", step: "Listo", progress: 1, master, web, masterMB: mb(master), webMB: mb(web) });
  writeFileSync(join(dir, "informe.json"), JSON.stringify({ ...job, clips: job.clips.map(({ peaks, ...c }) => c) }, null, 2));
}

const filesOf = new Map<string, { path: string; name: string }[]>();

/** Todo en uno (terminal, MCP): analizar y renderizar sin pausa. */
export function startMontaje(files: { path: string; name: string }[], opts: MontajeOpts) {
  const id = randomUUID().slice(0, 8);
  const dir = join(MONTAJE_DIR, id);
  mkdirSync(dir, { recursive: true });
  const job: MontajeJob = { id, status: "running", step: "Preparando", progress: 0, clips: [], opts };
  jobs.set(id, job); filesOf.set(id, files);
  (async () => { await analyze(job, dir, files, opts); job.status = "running"; await render(job, dir, files, opts); })()
    .catch((e) => { job.status = "error"; job.error = (e as Error).message; });
  return job;
}

/** Fase 1 sola: analiza y se detiene para que Santiago revise los cortes. */
export function analizarMontaje(files: { path: string; name: string }[], opts: MontajeOpts) {
  const id = randomUUID().slice(0, 8);
  const dir = join(MONTAJE_DIR, id);
  mkdirSync(dir, { recursive: true });
  const job: MontajeJob = { id, status: "running", step: "Preparando", progress: 0, clips: [], opts };
  jobs.set(id, job); filesOf.set(id, files);
  analyze(job, dir, files, opts)
    .then(() => { job.status = "analizado"; job.step = "Revisa los cortes"; job.progress = 1; })
    .catch((e) => { job.status = "error"; job.error = (e as Error).message; });
  return job;
}

/** Fase 2: renderizar con los cortes que Santiago dejó activos (puede restaurar tramos que no quiere quitar). */
export function renderMontaje(id: string, restaurar: Record<number, number[]>, cambios: Partial<MontajeOpts> = {}) {
  const job = jobs.get(id), files = filesOf.get(id);
  if (!job || !files) throw new Error("No existe ese análisis");
  if (job.status === "running") throw new Error("Todavía está trabajando");
  job.opts = { ...job.opts!, ...cambios };
  // restaurar = { clip: [índices de cortes que NO se quitan] } → esos tramos vuelven a "keep"
  job.clips.forEach((c, i) => {
    const back = (restaurar[i] ?? []).map((k) => c.cortes?.[k]).filter(Boolean) as Corte[];
    if (!back.length) return;
    const all = [...c.keep, ...back.map((x) => [x.start, x.end] as Range)].sort((a, b) => a[0] - b[0]);
    const merged: Range[] = [];
    for (const r of all) { const last = merged[merged.length - 1]; if (last && r[0] <= last[1] + 0.02) last[1] = Math.max(last[1], r[1]); else merged.push([...r] as Range); }
    c.keep = merged; c.after = r3(merged.reduce((t, [a, b]) => t + b - a, 0)); c.cuts = Math.max(0, merged.length - 1);
  });
  job.status = "running"; job.progress = 0; job.error = undefined;
  render(job, join(MONTAJE_DIR, id), files, job.opts)
    .catch((e) => { job.status = "error"; job.error = (e as Error).message; });
  return job;
}
