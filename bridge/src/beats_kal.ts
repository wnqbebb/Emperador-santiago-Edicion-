// Planificador por beats para la skill kallaway-editing: pantalla dividida con la PRUEBA arriba y la cara abajo.
// Cada opción A/B/C trae una lista de escenas (k_split / k_pip / k_hook / k_word), una por cada cosa que se nombra.
// La evidencia sale de las fuentes que Santiago pegó (capturas reales con evidence.py), de su b-roll, de gráficos en
// código (chat, slots, number, list) o de motion graphics ORIGINALES para la mitad superior. Lo que falte se pide como
// asset con su prompt (nunca se genera con IA de pago: regla 2) y en el borrador sale un marcador con su ID.
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { skillDir, skillSystem } from "./ves.js";
import type { Asset, PlanOpts, Energia } from "./beats.js";

export const KAL_SKILL = "kallaway-editing";
const KAL_TYPES = ["k_split", "k_pip", "k_hook", "k_word"];
const CATS = ["hook_banner", "split_headline", "split_social", "split_screenrec", "split_broll", "split_graphic", "face_full_word", "pip_broll", "full_graphic", "title_cta"];

type Top = { kind?: string; media?: string[]; placeholder?: string; original?: string; cuts?: number[]; [k: string]: unknown };
export type KScene = { id?: string; type: string; start: number; end: number; props?: { top?: Top; [k: string]: unknown } };
export type KOpt = { title: string; cats?: string; desc?: string; ref?: string; type: null; scenes: KScene[] };
export type KBeat = { id: string; start: number; end: number; script: string; seen: string; pick: "A" | "B" | "C"; opts: KOpt[] };
export type KBeats = { title: string; beats: KBeat[]; assets?: Asset[] };
export type Fuente = { id: string; url: string; title: string; path: string };

const read = (p: string, max = 1e9) => (existsSync(p) ? readFileSync(p, "utf8").slice(0, max) : "");

const ENERGIA: Record<Energia, string> = {
  calma: "Arriba cambia algo cada 2–2.5 s. k_word cada 25–31 s. Más aire de cara con subtítulo entre pruebas.",
  media: "Arriba cambia algo cada 1.5–2.5 s. k_word cada 18–25 s.",
  viral: "Arriba cambia algo cada 0.6–1.8 s (un corte por cada sustantivo, cifra o nombre). Gancho con franja k_hook y la prueba más rara desde el primer fotograma. k_word cada 12–18 s. Cierre con CTA (k_word → number/slots).",
};

export function kalPrompt(project: string, po: PlanOpts & { fuentes?: Fuente[] }) {
  const D = skillDir(KAL_SKILL), S = skillSystem(KAL_SKILL);
  const words = JSON.parse(read(join(S, "projects", project, "transcript_cut.json"))).words as { w: string; start: number; end: number }[];
  const duration = words.at(-1)?.end ?? 0;
  const scenes = JSON.parse(read(join(S, "schemas/scenes.json")));
  const sceneDoc = KAL_TYPES.map((k) => `- ${k}: ${scenes[k]?.use_when ?? ""}\n  props=${JSON.stringify(scenes[k]?.props ?? {})}`).join("\n");
  const lib = (JSON.parse(read(join(D, "library/ANIMATIONS.json")) || "[]") as { aid: string; category: string; script: string; what: string; quality?: number }[])
    .filter((a) => (a.quality ?? 0) >= 4 && CATS.includes(a.category));
  const libDoc = lib.map((a) => `${a.aid} [${a.category}] «${a.script.slice(0, 50)}» ${a.what.slice(0, 120)}`).join("\n");
  const ex = read(join(D, "examples/kal-prueba/beats.json"));
  const example = ex ? JSON.stringify(JSON.parse(ex)).slice(0, 14000) : "";
  const fuentes = po.fuentes ?? [];

  const system = `Eres el editor de "Emperador Santiago · Edición de Videos" y trabajas con la skill kallaway-editing.
Tu trabajo AHORA es escribir beats.json para el tablero de preedición (A/B/C por beat). Idea central: cada cosa que se dice se VE en el mismo instante.

# SKILL
${read(join(D, "SKILL.md"))}

# REGLAS GENERALES (obligatorias)
${read(join(D, "REGLAS_GENERALES.md"))}

# RULEBOOK (medidas)
${read(join(D, "docs/RULEBOOK.md"))}

# Qué palabra dispara qué imagen
${read(join(D, "docs/EDIT_LOGIC.md"))}

# Las 11 categorías
${read(join(D, "docs/FORMATOS.md"))}

# Escenas del sistema (usa SOLO estas 4)
${sceneDoc}

# Biblioteca Kallaway (calidad ≥4; ref = ID VNN-ANN)
${libDoc}

# Ejemplo real de beats.json de este estilo (recortado)
${example}

# CREATIVIDAD (manda Santiago): la biblioteca es INSPIRACIÓN, no un catálogo para copiar
- Esto es para redes: la edición viral es clave. Nada decora, todo demuestra.
- A = la mejor adaptación del patrón Kallaway a ESTE contenido. B = una variación propia (otro formato: k_pip en vez de split, chat en vez de captura, número gigante, otra forma de enseñar la prueba). C = otra idea fuerte o quedarse en la cara (scenes: []).
- ${po.originales ? 'En los 2–3 momentos más fuertes puedes proponer un motion graphic ORIGINAL para la mitad superior: escena k_split con top {"kind":"media","media":[],"original":"brief: qué se ve, cómo se mueve, qué texto entra en qué palabra"}. Se genera con HyperFrames en 1080×940 en la paleta del video. Úsalo cuando no haya prueba real y un gráfico animado explique mejor que una captura.' : "No propongas motion graphics originales."}
- Colores: ${JSON.stringify(po.palette ?? {})} (franja = vibrant_dark, cifra/resaltado = highlight o vibrant_bright).`;

  const user = `Clip de Santiago ya cortado (${duration.toFixed(2)} s). Transcripción palabra a palabra (inicio fin palabra, segundos ABSOLUTOS):
${words.map((w) => `${w.start.toFixed(2)} ${w.end.toFixed(2)} ${w.w}`).join("\n")}

Energía pedida: ${po.energia.toUpperCase()} → ${ENERGIA[po.energia]}
${po.notas ? `Notas de Santiago (mandan): ${po.notas}\n` : ""}
MATERIAL QUE YA EXISTE (puede ir en la opción recomendada; usa la ruta EXACTA en top.media):
${fuentes.length ? fuentes.map((f) => `- ${f.path} · captura real de «${f.title}» (${f.url})`).join("\n") : "- (no pegó fuentes: no hay capturas)"}
${po.broll.length ? po.broll.map((b) => `- ${b.path} · b-roll de Santiago: ${b.desc}`).join("\n") : "- (no subió b-roll)"}

Escribe beats.json:
- Beats de una idea (1–6 s) que cubren el video de principio a fin sin huecos ni solapes.
- Cada beat: id, start, end, script, seen (el patrón Kallaway que lo justifica, con su ref), pick, y exactamente 3 opts A/B/C con title, cats, desc, ref (ID real de la biblioteca), "type": null y "scenes": [ ... ].
- Cada escena: {"type": "k_split|k_pip|k_hook|k_word", "start", "end", "props"} con tiempos ABSOLUTOS dentro del beat, cambio en el INICIO de la palabra que nombra la cosa. k_split/k_pip duran 0.4–2.5 s; k_hook solo en 0–4.1 s (2.2–4.1 s de largo, line1 ≤16 car. MAYÚSCULAS, line2 ≤18 car.); k_word cada 12–31 s.
- top.kind: "media" (con media:[rutas] o, si falta, media:[] + placeholder "A0N · qué es"), "chat", "slots", "number" o "list" (gráficos en código: no necesitan nada). Usa labels/highlight/arrow cuando ayuden a ver la prueba.
- No pongas "face": lo mide kal.py.
- La opción "pick" debe verse bien YA: prioriza capturas existentes, b-roll subido, gráficos en código, originales y k_word. Marcadores de assets en el pick solo si no hay otra forma (máx. 1 de cada 4 escenas).
- Añade "assets" (máx. 8): todo el material que piden los marcadores (A01, A02…), en el formato:
  {"id":"A01","name":"pagina-producto","kind":"captura|image|video|screenrec","modelo":"captura: qué página buscar y capturar · imagen: Nano Banana Pro / GPT Image · video: Seedance 2.5 / Kling / Veo · grabación: qué grabar en pantalla",
   "ar":"1080x940 (mitad superior) o 9:16 (k_pip)","resolucion":"1080x940","duracion":"solo video: el doble de lo que sale, mín. 4 s","en_pantalla":"b03 · 7.2–8.4 s",
   "referencia":"qué usar de referencia","is_ref":false,
   "bloques":{"referencias":"…","contexto":"…","mapa_espacial":"…","accion":"…","camara":"…","luz_textura":"… con HEX de la paleta","bloqueos":"…"},
   "prompt":"prompt completo EN INGLÉS uniendo los 7 bloques (para capturas: instrucciones en español de qué buscar y qué recortar)",
   "resumen":"una línea en español","negative":"…","archivo":"A01_pagina-producto.png","for_beat":"b03"}
- Nunca inventes cifras ni titulares: si no hay prueba real, usa k_word o un gráfico en código con lo que DICE el clip.
Devuelve SOLO el JSON dentro de un bloque \`\`\`json.`;
  return { system, user, duration };
}

/** Limpia y deja renderizable: escenas válidas, tiempos dentro del beat y del clip, rutas que existen, ≤3 originales elegidos. */
export function sanitizeKal(b: KBeats, duration: number, projectDir: string, originales = true): KBeats {
  let beats = (b.beats ?? []).filter((x) => x && typeof x.start === "number" && typeof x.end === "number").sort((x, y) => x.start - y.start);
  beats = beats.reduce<KBeat[]>((acc, x) => { const prev = acc[acc.length - 1]; if (prev && x.end - x.start < 0.5) { prev.end = x.end; prev.script += " " + x.script; for (let k = 0; k < 3; k++) if (prev.opts?.[k] && x.opts?.[k]) prev.opts[k].scenes = [...(prev.opts[k].scenes ?? []), ...(x.opts[k].scenes ?? [])]; } else acc.push(x); return acc; }, []);
  const exists = (m: string) => !/\.\./.test(m) && existsSync(join(projectDir, m));
  const face: KOpt = { title: "Quedarse en la cara", cats: "aroll_plain", desc: "Respiro: cara con subtítulo pequeño.", ref: "", type: null, scenes: [] };
  beats.forEach((x, i) => {
    x.id = `b${String(i + 1).padStart(2, "0")}`;
    x.start = Math.max(0, Math.min(duration, x.start));
    x.end = Math.max(x.start + 0.3, Math.min(duration, x.end));
    x.opts = (x.opts ?? []).slice(0, 3);
    while (x.opts.length < 3) x.opts.push({ ...face });
    for (const o of x.opts) {
      o.type = null;
      o.scenes = (Array.isArray(o.scenes) ? o.scenes : []).filter((s) => s && KAL_TYPES.includes(s.type) && typeof s.start === "number" && typeof s.end === "number").map((s) => {
        s.start = Math.max(x.start, s.start); s.end = Math.min(x.end, s.end);
        delete s.id;
        const pr = (s.props ??= {});
        delete pr.face;
        const top = pr.top;
        if (top && (top.kind ?? "media") === "media") {
          const ok = (top.media ?? []).filter((m) => typeof m === "string" && exists(m));
          if (ok.length < (top.media ?? []).length && !top.placeholder) top.placeholder = "MATERIAL";
          top.media = ok;
          if (top.original && !originales) { top.placeholder ??= String(top.original).slice(0, 40); delete top.original; }
        }
        if (s.type === "k_hook") {
          for (const [k, n] of [["line1", 18], ["line2", 20]] as const) if (typeof pr[k] === "string") pr[k] = (pr[k] as string).slice(0, n);
        }
        return s;
      }).filter((s) => s.end - s.start >= (s.type === "k_hook" ? 1.5 : 0.35) && (s.type !== "k_hook" || s.start < 4.5));
    }
    if (!"ABC".includes(x.pick)) x.pick = "A";
  });
  // máximo 3 originales elegidos (cada uno se genera con IA + HyperFrames)
  let n = 0;
  for (const x of beats) for (const s of x.opts["ABC".indexOf(x.pick)].scenes) {
    const top = s.props?.top;
    if (top?.original && !top.media?.length && ++n > 3) { top.placeholder ??= String(top.original).slice(0, 40); delete top.original; }
  }
  const assets = (b.assets ?? []).slice(0, 8).map((a, i) => {
    const id = a.id || `A${String(i + 1).padStart(2, "0")}`;
    const bl = a.bloques;
    const prompt = a.prompt || (bl ? [bl.referencias, bl.contexto, bl.mapa_espacial, bl.accion, bl.camara, bl.luz_textura, bl.bloqueos].filter(Boolean).join(" ") : "");
    const ext = /video|broll|screenrec/.test(a.kind) ? "mp4" : "png";
    const ar = String(a.ar ?? "").match(/\d+\s*[:x/]\s*\d+/)?.[0]?.replace(/\s/g, "") ?? "9:16";
    return { ...a, id, ar, prompt, archivo: a.archivo || `${id}_${(a.name || "asset").replace(/[^\w-]+/g, "-")}.${ext}` };
  });
  return { title: b.title || "Plan Kallaway", beats, assets };
}
