// Plugins comunes a TODOS los motores (Arthur, Kallaway, Nick, Lobo, Skylight, Reels y los que vengan), con cualquier IA:
//   · Katana (método de Higgsfield, sin generar nada): contrato de bloqueos, roles de toma, mapa de energía y 3 revisiones.
//   · Edit Studio (edit-director): el género con su estructura, ritmo y movimientos permitidos/prohibidos;
//     después del render, efectos con nombre en un momento exacto («crash zoom en 0:07») sobre el video terminado.
// Antes del motor van en el plan; después, trabajan sobre el MP4 final. Por eso funcionan igual con cualquier estilo.
import { spawn, spawnSync, execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync } from "node:fs";
import { join, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";
import type { Energia } from "./beats.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const PY = join(ROOT, "tools/.venv/bin/python");
/** Motor de Edit Studio: el que instala `npm run setup`, o el que viene dentro de la skill Arthur. */
export const ED = [join(ROOT, ".claude/skills/edit-director"), join(ROOT, ".claude/skills/arthur-brooks-editing/plugins/edit-studio/skills/edit-director")]
  .find((d) => existsSync(join(d, "engine/edit.py")));
const KATANA = [join(ROOT, ".claude/skills/nick-saraev-editing/docs/KATANA_EDITSTUDIO.md"), join(ROOT, ".claude/skills/kallaway-editing/docs/KATANA_EDITSTUDIO.md")].find(existsSync);
const read = (p?: string) => (p && existsSync(p) ? readFileSync(p, "utf8") : "");

/** Género de Edit Studio que mejor encaja con cada estilo (estructura, ritmo y movimientos). */
const GENERO: Record<string, string> = {
  arthur: "calm", kallaway: "explainer", nick: "explainer", lobo: "motivation", skylight: "clips", reels: "viral", imperial: "viral",
  "reel-cara": "explainer", "reel-split": "explainer", "reel-cine": "drama", "arthur-podcast": "clips", "arthur-documental": "drama",
  "kal-producto": "product", "nick-tutorial": "explainer", "sky-mundos": "clips",
};
export const generoDe = (familia: string, variante = "") => GENERO[variante] ?? GENERO[familia] ?? "viral";

/** La ficha del género (la cabecera YAML: estructura por partes, ritmo, movimientos permitidos y prohibidos). */
export function fichaGenero(genero: string) {
  const md = read(ED && join(ED, "genres", `${genero}.md`));
  const m = md.match(/^---\n([\s\S]*?)\n---/);
  return (m ? m[1] : md.slice(0, 2500)).slice(0, 3500);
}

const ENERGIA_OBJETIVO: Record<Energia, { cortesSeg: [number, number]; maxQuieto: number }> = {
  calma: { cortesSeg: [0.2, 0.4], maxQuieto: 6 },
  media: { cortesSeg: [0.3, 0.6], maxQuieto: 4.5 },
  viral: { cortesSeg: [0.45, 1.0], maxQuieto: 3 },
};

/** Lo que Katana y Edit Studio añaden al plan de CUALQUIER motor (se pega al final de las instrucciones del modelo). */
export function pluginsPrompt(o: { energia: Energia; familia: string; variante?: string; notas?: string }) {
  const g = generoDe(o.familia, o.variante);
  const e = ENERGIA_OBJETIVO[o.energia];
  const reglas = read(KATANA).match(/## 2\. Reglas generales[\s\S]*?(?=\n## 3\.)/)?.[0] ?? "";
  return `

# PLUGINS DEL SISTEMA (valen para cualquier estilo)
## Katana (método; NO se genera nada)
${reglas.slice(0, 5000)}
Aplica aquí:
- CONTRATO: lo que pide Santiago son BLOQUEOS (no se cambian): ${o.notas?.trim() ? o.notas.trim() : "(sin notas: bloquea las palabras clave del gancho y del CTA)"}. Lo demás es libre.
- ROL DE TOMA: cada beat lleva "rol": gancho | contexto | héroe | acción | detalle | contraste | revelación | clímax | pausa | remate. Debe haber planteamiento y remate.
- MAPA DE ENERGÍA objetivo (${o.energia}): ${e.cortesSeg[0]}–${e.cortesSeg[1]} cambios visuales por segundo; nunca más de ${e.maxQuieto} s sin que cambie algo.
- 3 REVISIONES antes de entregar el JSON: (1) tiempo y ritmo; (2) continuidad y dirección entre cortes; (3) pulido (énfasis, texto, acentos de sonido). Corrige lo que falle.
## BRIEF Y PASO DE ASSETS (obligatorio en cualquier estilo)
- Añade al JSON "brief": {"idea": "la idea del video en una frase", "gancho": "qué pasa en los primeros 2 s", "estructura": ["gancho → …", "desarrollo → …", "remate/CTA → …"], "estilo": "cómo se verá (ritmo, color, tipografía)", "material": "qué tiene que generar o grabar Santiago y para qué", "personas": "si hace falta alguien o algo real (Santiago, un cliente, su producto o tienda): quién y cómo debe salir; si no, vacío"}. Santiago lo ve en pantalla ANTES de renderizar.
- Material que no existe → va en "assets" con su prompt profesional (7 bloques). NUNCA se busca en internet ni en bancos de imágenes (salvo las capturas de los enlaces que pegó Santiago). Santiago genera cada asset y lo sube: ESOS archivos son los que se montan.
- Cada asset dice si es imagen o video ("kind") y, si necesita una persona o producto real, cuál foto de referencia usar ("referencia").
## Edit Studio · género «${g}» (estructura, ritmo y movimientos; los prohibidos no se usan)
${fichaGenero(g)}`;
}

// ── Revisión Katana medida sobre el video terminado (cualquier motor) ──────────────────────────────────────────────
export type Revision = { video: string; duracion: number; checks: { id: string; ok: boolean; titulo: string; detalle: string }[]; energia: { cortesSeg: number; maxQuieto: number } };

/** FFmpeg escribe sus medidas (escenas, silencios, volumen) en stderr: se devuelve siempre ese registro. */
const ffmpegLog = (args: string[]) => spawnSync("ffmpeg", ["-hide_banner", "-nostats", ...args], { encoding: "utf8", maxBuffer: 64 << 20 }).stderr ?? "";

export function revisar(video: string, energia: Energia = "viral"): Revision {
  const dur = Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", video]).toString()) || 0;
  // cambios de imagen (cortes, escenas, gráficos que entran): detección de escena de FFmpeg
  const sc = ffmpegLog(["-i", video, "-vf", "select='gt(scene,0.18)',showinfo", "-an", "-f", "null", "-"]);
  const ts = [...sc.matchAll(/pts_time:([\d.]+)/g)].map((m) => Number(m[1]));
  const marcas = [0, ...ts, dur];
  const maxQuieto = Math.max(...marcas.slice(1).map((t, i) => t - marcas[i]));
  const cortesSeg = ts.length / Math.max(1, dur);
  // pausas largas en la voz
  const sil = ffmpegLog(["-i", video, "-af", "silencedetect=noise=-38dB:d=0.45", "-vn", "-f", "null", "-"]);
  const pausas = [...sil.matchAll(/silence_end: ([\d.]+) \| silence_duration: ([\d.]+)/g)].map((m) => ({ fin: Number(m[1]), dur: Number(m[2]) })).filter((p) => p.fin < dur - 0.3 && p.fin - p.dur > 0.3);
  // volumen (LUFS integrado y pico real)
  const lu = ffmpegLog(["-i", video, "-af", "ebur128=peak=true", "-vn", "-f", "null", "-"]);
  const lufs = Number(lu.match(/I:\s+(-?[\d.]+) LUFS/g)?.at(-1)?.match(/-?[\d.]+/)?.[0] ?? NaN);
  const tp = Number(lu.match(/Peak:\s+(-?[\d.]+) dBFS/g)?.at(-1)?.match(/-?[\d.]+/)?.[0] ?? NaN);
  // primera palabra: el silencio inicial
  const ini = sil.match(/silence_start: (0(?:\.\d+)?)\n[\s\S]*?silence_end: ([\d.]+)/);
  const primera = ini && Number(ini[1]) < 0.05 ? Number(ini[2]) : 0;
  const obj = ENERGIA_OBJETIVO[energia];
  const checks: Revision["checks"] = [
    { id: "energia", ok: cortesSeg >= obj.cortesSeg[0] * 0.8, titulo: "Mapa de energía", detalle: `${cortesSeg.toFixed(2)} cambios por segundo (objetivo ${energia}: ${obj.cortesSeg[0]}–${obj.cortesSeg[1]})` },
    { id: "quieto", ok: maxQuieto <= obj.maxQuieto + 0.5, titulo: "Nada quieto demasiado tiempo", detalle: `el tramo más largo sin cambio dura ${maxQuieto.toFixed(1)} s (máx. ${obj.maxQuieto} s)` },
    { id: "gancho", ok: primera <= 0.35, titulo: "Gancho inmediato", detalle: primera > 0 ? `la primera palabra entra a los ${primera.toFixed(2)} s (ideal ≤ 0.3 s)` : "la voz arranca de inmediato" },
    { id: "pausas", ok: pausas.length === 0, titulo: "Sin aire muerto", detalle: pausas.length ? `${pausas.length} pausa(s) de más de 0.45 s: ${pausas.slice(0, 4).map((p) => `${(p.fin - p.dur).toFixed(1)} s`).join(", ")}` : "ninguna pausa larga" },
    { id: "volumen", ok: Number.isFinite(lufs) && lufs > -16.5 && lufs < -12 && !(tp > -0.5), titulo: "Volumen para redes", detalle: Number.isFinite(lufs) ? `${lufs.toFixed(1)} LUFS, pico ${Number.isFinite(tp) ? tp.toFixed(1) : "?"} dBFS (ideal −14 LUFS, pico ≤ −1)` : "no se pudo medir" },
  ];
  return { video: basename(video), duracion: dur, checks, energia: { cortesSeg, maxQuieto } };
}

// ── Efectos con nombre en un momento exacto (Edit Studio) sobre el video terminado ─────────────────────────────────
/** Los efectos que Edit Studio sabe poner en un momento, con sus nombres en español. */
export const EFECTOS: { id: string; nombre: string; dice: RegExp; dura: number }[] = [
  { id: "zoom.crash", nombre: "Crash zoom", dice: /crash|zoom de golpe|zoom brusco|golpe de zoom/i, dura: 0.6 },
  { id: "zoom.punch", nombre: "Punch-in", dice: /punch|acercamiento r[aá]pido/i, dura: 0.8 },
  { id: "zoom.in_out", nombre: "Zoom ida y vuelta", dice: /ida y vuelta|in.?out/i, dura: 0.8 },
  { id: "zoom.slow", nombre: "Zoom lento", dice: /zoom lento|empuje lento|push/i, dura: 2.5 },
  { id: "zoom.out", nombre: "Alejar", dice: /alej|zoom out/i, dura: 1.5 },
  { id: "zoom.in", nombre: "Acercar", dice: /acerc|zoom in/i, dura: 1.5 },
  { id: "shake.beat", nombre: "Sacudida", dice: /sacud|temblor|shake|vibra/i, dura: 0.5 },
  { id: "light.flash", nombre: "Destello", dice: /flash|destello/i, dura: 0.4 },
  { id: "fx.rgb_split", nombre: "Desdoble RGB", dice: /rgb|desdoble|aberraci/i, dura: 0.5 },
  { id: "fx.glitch", nombre: "Glitch", dice: /glitch|falla digital/i, dura: 0.5 },
  { id: "glitch.vhs", nombre: "VHS", dice: /vhs|retro/i, dura: 1.0 },
  { id: "glitch.film_damage", nombre: "Película dañada", dice: /pel[ií]cula da[ñn]ada|rayones|film damage/i, dura: 1.0 },
  { id: "fx.light_leak", nombre: "Fuga de luz", dice: /fuga de luz|light leak|luz que entra/i, dura: 1.0 },
  { id: "fx.glow", nombre: "Brillo", dice: /brillo|glow|resplandor/i, dura: 1.0 },
  { id: "light.halation", nombre: "Halación", dice: /halaci/i, dura: 1.5 },
  { id: "lens.vignette", nombre: "Viñeta", dice: /vi[ñn]eta/i, dura: 2.0 },
  { id: "fx.film_overlay", nombre: "Grano de película", dice: /grano|film/i, dura: 2.0 },
  { id: "angle.dutch", nombre: "Plano holandés", dice: /holand[eé]s|inclinad|dutch/i, dura: 1.0 },
];

export type Efecto = { move: string; nombre: string; at: number; dura: number };
const seg = (s: string) => { const m = s.match(/(\d+):(\d+(?:\.\d+)?)/); return m ? Number(m[1]) * 60 + Number(m[2]) : Number(s.replace(",", ".")); };

/** «crash zoom en 0:07, destello en 12 s y glitch donde dice "una sola"» → efectos. Sin IA: funciona con cualquier modelo. */
export function leerEfectos(texto: string, palabras: { w: string; t: number }[] = []): { efectos: Efecto[]; dudas: string[] } {
  const efectos: Efecto[] = [], dudas: string[] = [];
  for (const parte of texto.split(/[,;\n]| y (?=[a-záéíóúñ]+ ?(?:en|a los|donde))/i).map((x) => x.trim()).filter(Boolean)) {
    const ef = EFECTOS.find((e) => e.dice.test(parte));
    if (!ef) { dudas.push(`No reconozco el efecto en «${parte}»`); continue; }
    let at: number | null = null;
    const tc = parte.match(/(\d+:\d+(?:\.\d+)?|\d+(?:[.,]\d+)?)\s*(?:s|seg)?/);
    const dice = parte.match(/(?:dice|palabra)\s*[«"“']?([^»"”']+)[»"”']?/i);
    if (dice && palabras.length) {
      const q = dice[1].toLowerCase().split(/\s+/)[0].replace(/[^\wáéíóúñ]/g, "");
      at = palabras.find((p) => p.w.toLowerCase().replace(/[^\wáéíóúñ]/g, "") === q)?.t ?? null;
      if (at == null) dudas.push(`No encuentro la palabra «${dice[1]}»`);
    } else if (tc) at = seg(tc[1]);
    if (at == null) { if (!dice) dudas.push(`Falta el momento en «${parte}» (ej. «en 0:07»)`); continue; }
    efectos.push({ move: ef.id, nombre: ef.nombre, at, dura: ef.dura });
  }
  return { efectos: efectos.sort((a, b) => a.at - b.at), dudas };
}

function run(cmd: string, args: string[], cwd: string, log: string[]) {
  return new Promise<void>((ok, ko) => {
    const p = spawn(cmd, args, { cwd });
    p.stdout.on("data", (d) => log.push(...String(d).split("\n").filter(Boolean).map((l) => l.slice(0, 240))));
    p.stderr.on("data", (d) => log.push(...String(d).split("\n").filter(Boolean).map((l) => l.slice(0, 240))));
    p.on("close", (c) => (c === 0 ? ok() : ko(new Error(log.slice(-2).join(" ") || `código ${c}`))));
  });
}

/** Aplica los efectos al video terminado con el motor de Edit Studio y deja una versión nueva (nunca pisa la anterior). */
export async function aplicarEfectos(video: string, efectos: Efecto[], log: string[] = []) {
  if (!ED) throw new Error("Edit Studio no está instalado (npm run setup:ves)");
  if (!efectos.length) throw new Error("No hay efectos que aplicar");
  const dir = join(dirname(video), "edit-studio");
  mkdirSync(dir, { recursive: true });
  const dur = Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", video]).toString());
  // el video se parte justo alrededor de cada efecto: así cada efecto dura solo su momento
  const cortes = [...new Set([0, ...efectos.flatMap((e) => [Math.max(0, e.at), Math.min(dur, e.at + e.dura)]), dur].map((t) => Math.round(t * 30) / 30))].sort((a, b) => a - b).filter((t, i, a) => i === 0 || t - a[i - 1] >= 0.2);
  const parts = cortes.slice(0, -1).map((a, i) => ({ type: "clip", id: `t${i}`, source: video, from: a, to: cortes[i + 1], crop: { cx: 0.5, cy: 0.5, z: 1.0 }, audio: "voice", subtitles: null, punch_ins: false }));
  const n = readdirSync(dirname(video)).filter((f) => /_efectos_v\d+\.mp4$/.test(f)).length + 1;
  const proj = join(dir, `v${n}`);
  writeFileSync(join(dir, `spec_v${n}.json`), JSON.stringify({ canvas: { w: 1080, h: 1920, fps: 30 }, parts, sfx: "none", loudness: { lufs: -14, tp: -1 } }, null, 1));
  const E = [ "-I", join(ED, "engine/edit.py") ];
  await run(PY, [...E, "sequence", join(dir, `spec_v${n}.json`), "--project", proj, "--no-render"], dir, log);
  const tc = (t: number) => `${Math.floor(t / 60)}:${(t % 60).toFixed(2).padStart(5, "0")}`;
  const ops = efectos.map((e) => ({ op: "add", move: e.move, at: tc(e.at) }));
  await run(PY, [...E, "cmd", join(proj, "edl_v1.json"), JSON.stringify(ops), "--no-render"], dir, log);
  await run(PY, [...E, "render", join(proj, "edl_v2.json"), "--final"], dir, log);
  const out = join(dirname(video), `${basename(video, ".mp4")}_efectos_v${n}.mp4`);
  execFileSync("ffmpeg", ["-v", "error", "-y", "-i", join(proj, "final_v2.mp4"), "-c", "copy", "-movflags", "+faststart", out]);
  return out;
}
