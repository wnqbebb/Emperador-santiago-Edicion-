// Diseño de sonido profesional para cualquier motor: kit de efectos por momento (sonidos/kit) y música por ánimo
// (sonidos/musica/<Ánimo>, se baja con scripts/descargar-sonidos.sh). La música va por debajo de la voz (ducking).
import { execFileSync, spawn } from "node:child_process";
import { existsSync, readdirSync, renameSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
export const SONIDOS = join(ROOT, "sonidos");
const KIT = join(SONIDOS, "kit"), MUSICA = join(SONIDOS, "musica");
const audio = (f: string) => /\.(mp3|wav|m4a|ogg|aac|flac)$/i.test(f);

/** Momentos del video y su sonido:
 *  transicion = cambio de escena · impacto = gancho, palabra gigante, cifra · boom = revelación grande · pop = aparece un gráfico
 *  notificacion = dato, check, lista · foto = cuadro congelado o pantalla en negro · snap = corte seco · riser = sube la tensión
 *  glitch = error / tecnología · rebobinar = «volvamos atrás» · fallo = algo salió mal (meme) */
export type Momento = "transicion" | "impacto" | "boom" | "pop" | "notificacion" | "foto" | "snap" | "riser" | "glitch" | "rebobinar" | "fallo";
const usados = new Map<string, number>();
/** Un archivo del kit para ese momento (rota entre variantes para no repetir). */
export function sfx(m: Momento): string | undefined {
  const d = join(KIT, m);
  const fs = existsSync(d) ? readdirSync(d).filter(audio).sort() : [];
  if (!fs.length) return;
  const i = usados.get(m) ?? 0; usados.set(m, i + 1);
  return join(d, fs[i % fs.length]);
}

export function animos() {
  return existsSync(MUSICA) ? readdirSync(MUSICA, { withFileTypes: true }).filter((d) => d.isDirectory())
    .map((d) => ({ id: d.name, canciones: readdirSync(join(MUSICA, d.name)).filter(audio).length })).filter((a) => a.canciones) : [];
}
const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
function cancion(animo: string, semilla: string) {
  const a = animos().find((x) => norm(x.id) === norm(animo));
  if (!a) return;
  const fs = readdirSync(join(MUSICA, a.id)).filter(audio).sort();
  const h = [...semilla].reduce((t, c) => (t * 31 + c.charCodeAt(0)) >>> 0, 7);
  return join(MUSICA, a.id, fs[h % fs.length]);
}

const dur = (f: string) => Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f]).toString());

/** Cortes de escena del video (para poner transiciones donde no hay plan). */
export function cortes(video: string, umbral = 0.32): number[] {
  const r = (() => { try { return execFileSync("ffmpeg", ["-hide_banner", "-i", video, "-vf", `scale=160:-2,select='gt(scene,${umbral})',showinfo`, "-an", "-f", "null", "-"], { stdio: ["ignore", "ignore", "pipe"], maxBuffer: 1 << 26 }).toString(); } catch (e) { return String((e as { stderr?: Buffer }).stderr ?? ""); } })();
  return [...r.matchAll(/pts_time:([\d.]+)/g)].map((m) => Number(m[1]));
}

function ff(args: string[]) {
  return new Promise<void>((ok, ko) => {
    const p = spawn("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", ...args]);
    let err = ""; p.stderr.on("data", (d) => (err += d));
    p.on("close", (c) => (c === 0 ? ok() : ko(new Error(`ffmpeg: ${err.slice(-300)}`))));
  });
}

export type Evento = { t: number; m: Momento; db?: number };
const DB: Record<Momento, number> = { transicion: -21, impacto: -17, boom: -15, pop: -22, notificacion: -20, foto: -19, snap: -20, riser: -22, glitch: -21, rebobinar: -19, fallo: -16 };

/** Eventos automáticos sobre un video terminado: golpe en el gancho y transiciones en los cortes (sin saturar). */
export function eventosAuto(video: string): Evento[] {
  const cs = cortes(video);
  const ev: Evento[] = [{ t: 0.02, m: "impacto" }];
  let ultimo = 0;
  cs.forEach((t, i) => {
    if (t - ultimo < 1.4) return;
    ev.push({ t: Math.max(0, t - 0.12), m: i % 5 === 4 ? "pop" : "transicion" }); ultimo = t;
  });
  return ev;
}

/** Mezcla música (por ánimo, bajo la voz) y efectos en el MISMO archivo de video. Guarda también la pista en <salidaAudio>. */
export async function mezclar(video: string, o: { musica?: string; eventos?: Evento[]; semilla?: string; salidaAudio?: string }, log: string[] = []) {
  const D = dur(video);
  const musica = o.musica && o.musica !== "ninguna" ? cancion(o.musica, o.semilla ?? video) : undefined;
  const evs = (o.eventos ?? []).map((e) => ({ ...e, f: sfx(e.m) })).filter((e) => e.f && e.t < D - 0.2) as (Evento & { f: string })[];
  if (!musica && !evs.length) return false;
  const inputs = ["-i", video];
  const fc: string[] = ["[0:a]aresample=48000,asplit=2[voz][vozsc]"];
  const mezcla = ["[voz]"];
  if (musica) {
    const md = dur(musica), ini = md > D + 20 ? Math.min(md * 0.12, md - D - 2) : 0;
    inputs.push("-stream_loop", "-1", "-ss", ini.toFixed(2), "-i", musica);
    fc.push(`[1:a]aresample=48000,atrim=0:${D.toFixed(2)},asetpts=PTS-STARTPTS,volume=-19dB,afade=t=in:d=0.6,afade=t=out:st=${Math.max(0, D - 1.8).toFixed(2)}:d=1.8[mus]`,
      `[mus][vozsc]sidechaincompress=threshold=0.025:ratio=7:attack=25:release=380:makeup=1[musd]`);
    mezcla.push("[musd]");
  } else fc[0] = "[0:a]aresample=48000[voz]";
  const base = musica ? 2 : 1;
  evs.forEach((e, i) => {
    inputs.push("-i", e.f);
    const ms = Math.round(e.t * 1000);
    fc.push(`[${base + i}:a]aresample=48000,volume=${e.db ?? DB[e.m]}dB,adelay=${ms}|${ms}[s${i}]`);
    mezcla.push(`[s${i}]`);
  });
  fc.push(`${mezcla.join("")}amix=inputs=${mezcla.length}:normalize=0:duration=first,loudnorm=I=-14:TP=-1:LRA=11[a]`);
  const tmp = video.replace(/\.mp4$/, ".mezcla.tmp.mp4");
  await ff([...inputs, "-filter_complex", fc.join(";"), "-map", "0:v", "-map", "[a]", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", tmp]);
  renameSync(tmp, video);
  if (o.salidaAudio) { mkdirSync(dirname(o.salidaAudio), { recursive: true }); await ff(["-i", video, "-vn", "-c:a", "copy", o.salidaAudio]); }
  log.push(`  sonido: ${musica ? `música «${musica.split("/").pop()}» bajo la voz` : "sin música"} · ${evs.length} efectos`);
  return true;
}

/** Pone una pista de audio ya mezclada sobre otro render del mismo video (p. ej. la versión con subtítulos). */
export async function ponerAudio(video: string, pista: string) {
  if (!existsSync(pista)) return;
  const tmp = video.replace(/\.mp4$/, ".audio.tmp.mp4");
  await ff(["-i", video, "-i", pista, "-map", "0:v", "-map", "1:a", "-c", "copy", "-shortest", "-movflags", "+faststart", tmp]);
  renameSync(tmp, video);
}
