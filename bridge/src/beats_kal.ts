// Planificador por beats para las skills "por escenas" (Kallaway, Nick Saraev, Lobo de Wall Street y las que vengan con el
// mismo formato): cada opción A/B/C trae una lista de escenas del estilo, una por cada cosa que se nombra.
// Las escenas permitidas, sus props y límites salen del propio motor de cada skill (style.json + schemas/scenes.json);
// las reglas, la biblioteca y el ejemplo, de la skill. El material sale de las fuentes que pegó Santiago (capturas reales
// con evidence.py), de su b-roll, de gráficos en código o de motion graphics ORIGINALES; lo que falte se pide como asset
// con su prompt (nunca se genera con IA de pago: regla 2) y en el borrador sale un marcador con su ID.
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { skillDir, skillSystem } from "./ves.js";
import type { Asset, PlanOpts, Energia } from "./beats.js";

export const KAL_SKILL = "kallaway-editing";

type Cfg = {
  style: string; nombre: string; ejemplo: string;
  tops: boolean;      // sus escenas tienen mitad superior (top.kind media|chat|…): admite originales y capturas
  topSize?: { w: number; h: number };   // tamaño real de esa zona (los originales se generan a esa medida)
  topSizeFor?: (props: Record<string, unknown>) => { w: number; h: number };   // si cambia según la escena
  face: boolean;      // kal.py face rellena dónde está la cara
  check: boolean;     // kal.py check revisa las reglas medidas
  idea: string; reglas: string; energia: Record<Energia, string>; extra?: string;
};
export const SCENE_SKILLS: Record<string, Cfg> = {
  "kallaway-editing": {
    style: "kallaway", nombre: "Kallaway", ejemplo: "examples/kal-prueba/beats.json", tops: true, topSize: { w: 1080, h: 940 }, face: true, check: true,
    idea: "cada cosa que se dice se VE en el mismo instante: la prueba arriba, la cara abajo.",
    reglas: `- k_split/k_pip duran 0.4–2.5 s; k_hook solo en 0–4.1 s (2.2–4.1 s de largo, line1 ≤16 car. MAYÚSCULAS, line2 ≤18 car.); k_word cada 12–31 s.
- top.kind: "media" (media:[rutas] o, si falta, media:[] + placeholder "A0N · qué es"), "chat", "slots", "number" o "list" (gráficos en código). Usa labels/highlight/arrow para ver la prueba.
- Si no hay prueba real, k_word o un gráfico en código con lo que DICE el clip.`,
    energia: {
      calma: "Arriba cambia algo cada 2–2.5 s. k_word cada 25–31 s.",
      media: "Arriba cambia algo cada 1.5–2.5 s. k_word cada 18–25 s.",
      viral: "Arriba cambia algo cada 0.6–1.8 s (un corte por sustantivo, cifra o nombre). Gancho con k_hook y la prueba más rara desde el primer fotograma. k_word cada 12–18 s. Cierre con CTA.",
    },
  },
  "nick-saraev-editing": {
    style: "nick-saraev", nombre: "Nick Saraev", ejemplo: "examples/nick-prueba/beats.json", tops: true, topSize: { w: 900, h: 1020 }, topSizeFor: (p) => (p.face_box === false ? { w: 900, h: 1020 } : { w: 1000, h: 620 }), face: true, check: false,   // topSizeFor: sin cara ventana alta · con cara ancha
    idea: "la herramienta es la protagonista y él el narrador: una ventana enmarcada arriba (con asas tipo Figma) y él en un recuadro redondeado abajo.",
    reglas: `- n_frame es la base: top igual que k_split.top (media|chat|slots|number|list), canvas dark|light|white, face_box true/false (false = solo ventana), title1/title2 solo en el gancho (0–3 s).
- Dentro de la ventana algo cambia cada 0.5–1.5 s; alterna lienzo claro-con-cara / oscuro-sin-cara cada 2–7 s; cara completa (aroll o p_punch) ≤15 % del video, solo en remate y cierre.
- Cierre con n_cta {"word": PALABRA para comentar, "c1", "c2"}.`,
    energia: {
      calma: "Dentro de la ventana cambia algo cada 1.5–2 s; lienzo cada 5–7 s.",
      media: "Dentro de la ventana cambia algo cada ~1–1.5 s; lienzo cada 3–5 s.",
      viral: "Dentro de la ventana cambia algo cada 0.5–1 s; gancho con title1/title2 y la herramienta desde el primer fotograma; lienzo cada 2–4 s; cierre «comment PALABRA».",
    },
  },
  "lobo-de-wall-street-editing": {
    style: "lobo-de-wall-street", nombre: "Lobo de Wall Street", ejemplo: "examples/lobo-prueba/beats.json", tops: false, face: true, check: false,
    idea: "habla directo y cada promesa se vuelve visible: el A-roll manda y encima solo lo que vende la frase.",
    reglas: `- Escenas: l_comment (gancho: la pregunta del cliente arriba), l_icon (objeto o cifra sobre la cabeza: text o media o placeholder), l_list (número de lista amarillo en itálica), l_insert (foto bajo el subtítulo), l_movie (clip de película; placeholder con qué escena), p_punch (salto de encuadre), l_full (gráfico sobre negro), l_follow (tarjeta de perfil «Follow → Following» al cierre).
- El AMARILLO solo en el remate/objeción/beneficio (≤1 cada 8–10 s): esas palabras van en "special_words".
- Cortes secos, sin transiciones decorativas. Clips de película: los consigue Santiago (tú dices qué escena y en qué segundo).`,
    energia: {
      calma: "Una escena encima cada 6–8 s; mucho A-roll limpio.",
      media: "Una escena encima cada 4–6 s.",
      viral: "Gancho l_comment en 0–3 s; una escena encima cada 2.5–4 s (cifra sobre la cabeza, foto, clip, punch); cierre con l_follow.",
    },
    extra: `"special_words": [palabras exactas del remate que van en amarillo, ≤ 1 cada 8–10 s]`,
  },
};
export const isSceneSkill = (s?: string): s is string => !!s && s in SCENE_SKILLS;
export const sceneCfg = (s: string) => SCENE_SKILLS[s];

type Top = { kind?: string; media?: string[]; placeholder?: string; original?: string; cuts?: number[]; [k: string]: unknown };
export type KScene = { id?: string; type: string; start: number; end: number; props?: { top?: Top; [k: string]: unknown } };
export type KOpt = { title: string; cats?: string; desc?: string; ref?: string; type: null; scenes: KScene[] };
export type KBeat = { id: string; start: number; end: number; script: string; seen: string; pick: "A" | "B" | "C"; opts: KOpt[] };
export type KBeats = { title: string; beats: KBeat[]; assets?: Asset[]; special_words?: string[] };
export type Fuente = { id: string; url: string; title: string; path: string };

const read = (p: string, max = 1e9) => (existsSync(p) ? readFileSync(p, "utf8").slice(0, max) : "");
const styleOf = (skill: string) => JSON.parse(read(join(skillSystem(skill), "styles", SCENE_SKILLS[skill].style, "style.json")) || "{}");
const schemaOf = (skill: string) => JSON.parse(read(join(skillSystem(skill), "schemas/scenes.json")) || "{}");
const typesOf = (skill: string) => (styleOf(skill).scenes_allowed as string[] | undefined) ?? [];

export function kalPrompt(project: string, po: PlanOpts & { fuentes?: Fuente[] }, skill = KAL_SKILL) {
  const cfg = SCENE_SKILLS[skill];
  const D = skillDir(skill), S = skillSystem(skill);
  const words = JSON.parse(read(join(S, "projects", project, "transcript_cut.json"))).words as { w: string; start: number; end: number }[];
  const duration = words.at(-1)?.end ?? 0;
  const scenes = schemaOf(skill);
  const types = typesOf(skill);
  const sceneDoc = types.map((k) => `- ${k}: ${scenes[k]?.use_when ?? ""}\n  props=${JSON.stringify(scenes[k]?.props ?? {})}${scenes[k]?.limits && Object.keys(scenes[k].limits).length ? ` límites=${JSON.stringify(scenes[k].limits)}` : ""}`).join("\n");
  const lib = (JSON.parse(read(join(D, "library/ANIMATIONS.json")) || "[]") as { aid: string; category: string; script: string; what: string; quality?: number }[])
    .filter((a) => (a.quality ?? 0) >= 4);
  const libDoc = lib.map((a) => `${a.aid} [${a.category}] «${a.script.slice(0, 50)}» ${a.what.slice(0, 120)}`).join("\n");
  const ex = read(join(D, cfg.ejemplo));
  const example = ex ? JSON.stringify(JSON.parse(ex)).slice(0, 14000) : "";
  const fuentes = po.fuentes ?? [];

  const system = `Eres el editor de "Emperador Santiago · Edición de Videos" y trabajas con la skill ${skill} (estilo ${cfg.nombre}).
Tu trabajo AHORA es escribir beats.json para el tablero de preedición (A/B/C por beat). Idea central: ${cfg.idea}

# SKILL
${read(join(D, "SKILL.md"))}

# REGLAS GENERALES (obligatorias)
${read(join(D, "REGLAS_GENERALES.md"))}

# RULEBOOK (medidas)
${read(join(D, "docs/RULEBOOK.md"))}

# Qué palabra dispara qué imagen
${read(join(D, "docs/EDIT_LOGIC.md"))}

# Formatos
${read(join(D, "docs/FORMATOS.md"))}

# Escenas del sistema (usa SOLO estas)
${sceneDoc}

# Biblioteca ${cfg.nombre} (calidad ≥4; ref = ID VNN-ANN)
${libDoc}

# Ejemplo real de beats.json de este estilo (recortado)
${example}

# CREATIVIDAD (manda Santiago): la biblioteca es INSPIRACIÓN, no un catálogo para copiar
- Esto es para redes: la edición viral es clave.
- A = la mejor adaptación del patrón ${cfg.nombre} a ESTE contenido. B = una variación propia (otra escena u otra forma de mostrarlo). C = otra idea fuerte o la más sobria (scenes: [] = quedarse en la cara).
- ${po.originales && cfg.tops ? 'En los 2–3 momentos más fuertes puedes proponer un motion graphic ORIGINAL para la parte de arriba: top {"kind":"media","media":[],"original":"brief: qué se ve, cómo se mueve, qué texto entra en qué palabra"}. Se genera con HyperFrames en la paleta del video. Úsalo cuando no haya prueba real y un gráfico animado explique mejor.' : "No propongas motion graphics originales."}
- Colores: ${JSON.stringify(po.palette ?? {})}.`;

  const user = `Clip de Santiago ya cortado (${duration.toFixed(2)} s). Transcripción palabra a palabra (inicio fin palabra, segundos ABSOLUTOS):
${words.map((w) => `${w.start.toFixed(2)} ${w.end.toFixed(2)} ${w.w}`).join("\n")}

Energía pedida: ${po.energia.toUpperCase()} → ${cfg.energia[po.energia]}
${po.notas ? `Notas de Santiago (mandan): ${po.notas}\n` : ""}
MATERIAL QUE YA EXISTE (puede ir en la opción recomendada; usa la ruta EXACTA en "media"):
${fuentes.length ? fuentes.map((f) => `- ${f.path} · captura real de «${f.title}» (${f.url})`).join("\n") : "- (no pegó fuentes: no hay capturas)"}
${po.broll.length ? po.broll.map((b) => `- ${b.path} · b-roll de Santiago: ${b.desc}`).join("\n") : "- (no subió b-roll)"}

Escribe beats.json:
- Beats de una idea (1–6 s) que cubren el video de principio a fin sin huecos ni solapes.
- Cada beat: id, start, end, script, seen (el patrón ${cfg.nombre} que lo justifica, con su ref), pick, y exactamente 3 opts A/B/C con title, cats, desc, ref (ID real de la biblioteca), "type": null y "scenes": [ ... ].
- Cada escena: {"type": uno de [${types.join(", ")}], "start", "end", "props"} con tiempos ABSOLUTOS dentro del beat; el cambio cae en el INICIO de la palabra que nombra la cosa.
${cfg.reglas}
- Material que no existe: "media" vacío + "placeholder": "A0N · qué es" (sale un marcador en el borrador y va en "assets").
- No pongas "face": lo mide el sistema.
- La opción "pick" debe verse bien YA: prioriza material existente, gráficos en código${cfg.tops ? ", originales" : ""} y la cara. Marcadores de assets en el pick solo si no hay otra forma (máx. 1 de cada 4 escenas).
- Añade "assets" (máx. 8): todo el material que piden los marcadores (A01, A02…), en el formato:
  {"id":"A01","name","kind":"captura|image|video|screenrec|objeto3d|pelicula","modelo":"captura: qué página · imagen: Nano Banana Pro / GPT Image · video: Seedance 2.5 / Kling / Veo · grabación: qué grabar · película: qué escena y minuto",
   "ar":"9:16|1:1|1080x940","resolucion","duracion":"solo video: el doble de lo que sale, mín. 4 s","en_pantalla":"b03 · 7.2–8.4 s","referencia","is_ref":false,
   "bloques":{"referencias","contexto","mapa_espacial","accion","camara","luz_textura":"… con HEX de la paleta","bloqueos"},
   "prompt":"prompt completo EN INGLÉS uniendo los 7 bloques (capturas y películas: instrucciones en español)","resumen":"una línea en español","negative","archivo":"A01_nombre.png","for_beat":"b03"}
${cfg.extra ? `- Añade también ${cfg.extra}.\n` : ""}- Nunca inventes cifras ni titulares que no diga el clip.
Devuelve SOLO el JSON dentro de un bloque \`\`\`json.`;
  return { system, user, duration };
}

/** Rutas de material que no existen → se quitan y queda el marcador (también dentro de items[] o top). */
function cleanMedia(o: Record<string, unknown>, exists: (m: string) => boolean) {
  for (const [k, v] of Object.entries(o)) {
    if (k === "media") {
      if (typeof v === "string" && !exists(v)) { delete o.media; o.placeholder ??= "MATERIAL"; }
      else if (Array.isArray(v)) { const ok = v.filter((m) => typeof m === "string" && exists(m)); if (ok.length < v.length) o.placeholder ??= "MATERIAL"; o.media = ok; }
    } else if (v && typeof v === "object") {
      if (Array.isArray(v)) v.forEach((x) => x && typeof x === "object" && cleanMedia(x as Record<string, unknown>, exists));
      else cleanMedia(v as Record<string, unknown>, exists);
    }
  }
}

/** Limpia y deja renderizable: escenas del estilo, tiempos dentro del beat, rutas que existen, límites del esquema, ≤3 originales. */
export function sanitizeKal(b: KBeats, duration: number, projectDir: string, originales = true, skill = KAL_SKILL): KBeats {
  const cfg = SCENE_SKILLS[skill];
  const types = typesOf(skill);
  const schema = schemaOf(skill);
  const minScene = Math.max(0.3, (styleOf(skill).pacing?.min_scene_s ?? 0.35));
  let beats = (b.beats ?? []).filter((x) => x && typeof x.start === "number" && typeof x.end === "number").sort((x, y) => x.start - y.start);
  beats = beats.reduce<KBeat[]>((acc, x) => { const prev = acc[acc.length - 1]; if (prev && x.end - x.start < 0.5) { prev.end = x.end; prev.script += " " + x.script; for (let k = 0; k < 3; k++) if (prev.opts?.[k] && x.opts?.[k]) prev.opts[k].scenes = [...(prev.opts[k].scenes ?? []), ...(x.opts[k].scenes ?? [])]; } else acc.push(x); return acc; }, []);
  const exists = (m: string) => !/\.\./.test(m) && existsSync(join(projectDir, m));
  const face: KOpt = { title: "Quedarse en la cara", cats: "aroll", desc: "Respiro: la cara con su subtítulo.", ref: "", type: null, scenes: [] };
  beats.forEach((x, i) => {
    x.id = `b${String(i + 1).padStart(2, "0")}`;
    x.start = Math.max(0, Math.min(duration, x.start));
    x.end = Math.max(x.start + 0.3, Math.min(duration, x.end));
    x.opts = (x.opts ?? []).slice(0, 3);
    while (x.opts.length < 3) x.opts.push({ ...face });
    for (const o of x.opts) {
      o.type = null;
      o.scenes = (Array.isArray(o.scenes) ? o.scenes : []).filter((s) => s && types.includes(s.type) && typeof s.start === "number" && typeof s.end === "number").map((s) => {
        s.start = Math.max(x.start, s.start); s.end = Math.min(x.end, s.end);
        delete s.id;
        const pr = (s.props ??= {});
        delete pr.face;
        const top = pr.top;
        if (top?.original && (!originales || !cfg.tops)) { top.placeholder ??= String(top.original).slice(0, 40); delete top.original; }
        cleanMedia(pr, exists);
        for (const [k, n] of Object.entries((schema[s.type]?.limits ?? {}) as Record<string, number>)) if (typeof pr[k] === "string") pr[k] = (pr[k] as string).slice(0, n);
        return s;
      }).filter((s) => s.end - s.start >= (s.type === "k_hook" ? 1.5 : minScene) && (s.type !== "k_hook" || s.start < 4.5));
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
    const ext = /video|broll|screenrec|pelicula/.test(a.kind) ? "mp4" : "png";
    const ar = String(a.ar ?? "").match(/\d+\s*[:x/]\s*\d+/)?.[0]?.replace(/\s/g, "") ?? "9:16";
    return { ...a, id, ar, prompt, archivo: a.archivo || `${id}_${(a.name || "asset").replace(/[^\w-]+/g, "-")}.${ext}` };
  });
  return { title: b.title || `Plan ${cfg.nombre}`, beats, assets, special_words: Array.isArray(b.special_words) ? b.special_words.slice(0, 12).map(String) : undefined };
}
