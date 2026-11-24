// Motor de decisiones local (sin IA, sin internet) + utilidades de línea de tiempo.
import type { Chunk, Motion, Plan, Segment, Style, Word, Zoom } from "./types";

const clean = (w: string) => w.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\w%$]/g, "");

const EMOJI: [RegExp, string][] = [
  [/^(dinero|plata|pesos|dolares|millon|millones|ventas|ganar|ganancia)/, "💰"],
  [/^(fuego|brutal|increible|epico|locura)/, "🔥"],
  [/^(idea|truco|secreto|clave|tip)/, "💡"],
  [/^(tiempo|hora|horas|minutos|rapido)/, "⏰"],
  [/^(exito|ganador|meta|logro|campeon)/, "🏆"],
  [/^(error|nunca|problema|fallo|mal)/, "❌"],
  [/^(amor|corazon|quiero|encanta)/, "❤️"],
  [/^(crecer|crecimiento|subir|escalar)/, "📈"],
  [/^(cerebro|pensar|mente|aprender)/, "🧠"],
];

/** Palabras dentro de los segmentos conservados. */
export const keptWords = (words: Word[], segs: Segment[]) =>
  words.filter((w) => segs.some((s) => w.t0 >= s.start - 0.01 && w.t1 <= s.end + 0.01));

export function chunkWords(words: Word[], perChunk: number): Chunk[] {
  const out: Chunk[] = [];
  let cur: Word[] = [];
  for (const w of words) {
    const prev = cur[cur.length - 1];
    const breakHere = cur.length >= perChunk || (prev && w.t0 - prev.t1 > 0.45) || (prev && /[.?!,]$/.test(prev.w));
    if (breakHere && cur.length) { out.push({ start: cur[0].t0, end: cur[cur.length - 1].t1, words: cur }); cur = []; }
    cur.push(w);
  }
  if (cur.length) out.push({ start: cur[0].t0, end: cur[cur.length - 1].t1, words: cur });
  return out;
}

/** Edición automática offline: corta silencios, resalta, hace zooms y pone gráficos según el Style DNA. */
export function autoPlan(words: Word[], duration: number, style: Style): Plan {
  const pad = 0.08;
  const segments: Segment[] = [];
  for (const w of words) {
    const last = segments[segments.length - 1];
    if (last && w.t0 - last.end <= style.pacing.maxSilence + pad) last.end = Math.min(duration, w.t1 + pad);
    else segments.push({ start: Math.max(0, w.t0 - pad), end: Math.min(duration, w.t1 + pad) });
  }
  if (!segments.length) segments.push({ start: 0, end: duration });

  const emphasis = new Set<string>();
  const motion: Motion[] = [];
  const zooms: Zoom[] = [];
  let lastEmoji = -10, lastZoom = -10;

  for (const ch of chunkWords(words, style.caption.wordsPerChunk)) {
    const best = [...ch.words].sort((a, b) => score(b.w) - score(a.w))[0];
    if (best && score(best.w) >= 2) emphasis.add(clean(best.w));
    if (ch.start - lastZoom >= style.pacing.zoomEvery) {
      zooms.push({ at: ch.start, dur: Math.min(1.6, ch.end - ch.start + 0.4), scale: style.pacing.zoomEvery < 4 ? 1.14 : 1.06 });
      lastZoom = ch.start;
    }
    if (style.motion.emojis && ch.start - lastEmoji >= 4) {
      for (const w of ch.words) {
        const hit = EMOJI.find(([re]) => re.test(clean(w.w)));
        if (hit) { motion.push({ kind: "emojiPop", start: w.t0, end: w.t0 + 1.2, text: hit[1] }); lastEmoji = w.t0; break; }
      }
    }
    for (const w of ch.words)
      if (/^\d[\d.,]*%?$/.test(w.w.replace(/[^\d.,%]/g, "")) && /\d/.test(w.w))
        motion.push({ kind: "counter", start: w.t0, end: w.t0 + 1.4, text: w.w.replace(/[^\d.,%$]/g, "") });
  }

  if (style.motion.hookTitle && words.length) {
    const hook = words.slice(0, 7).map((w) => w.w).join(" ").replace(/[,.]$/, "");
    motion.push({ kind: "title", start: segments[0].start, end: segments[0].start + 2.4, text: hook });
  }
  if (style.motion.progress) motion.push({ kind: "progress", start: 0, end: duration, text: "" });

  return {
    summary: `Edición local · ${segments.length} segmentos, ${zooms.length} zooms, ${motion.length} gráficos.`,
    segments, emphasis: [...emphasis], zooms, motion,
  };
}

function score(w: string) {
  const c = clean(w);
  let s = 0;
  if (c.length >= 7) s += 1;
  if (/\d/.test(c)) s += 3;
  if (EMOJI.some(([re]) => re.test(c))) s += 2;
  if (/[!?]$/.test(w)) s += 1;
  return s;
}

export const isEmphasis = (plan: Plan, w: string) => plan.emphasis.some((e) => clean(e) === clean(w));

/** Mapea tiempo de salida (editado) <-> tiempo del original. */
export function outDuration(segs: Segment[]) { return segs.reduce((a, s) => a + (s.end - s.start), 0); }
export function srcToOut(segs: Segment[], t: number) {
  let acc = 0;
  for (const s of segs) { if (t < s.end) return acc + Math.max(0, t - s.start); acc += s.end - s.start; }
  return acc;
}
export function outToSrc(segs: Segment[], t: number) {
  let acc = 0;
  for (const s of segs) { const d = s.end - s.start; if (t < acc + d) return s.start + (t - acc); acc += d; }
  return segs.length ? segs[segs.length - 1].end : 0;
}
/** Si el reproductor cayó en una zona cortada, ¿a dónde debe saltar? (null = seguir) */
export function nextJump(segs: Segment[], t: number): number | null {
  for (const s of segs) { if (t < s.start - 0.02) return s.start; if (t < s.end) return null; }
  return -1; // terminó
}
