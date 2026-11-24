// Planificador por beats (método Joseph) para las plantillas de la skill arthur-brooks-editing.
// La IA recibe las reglas, el contrato, el catálogo de escenas del estilo, la biblioteca de 339 animaciones de Arthur
// y una edición real de ejemplo; devuelve beats.json con 3 opciones A/B/C por beat. Aquí lo validamos y lo dejamos
// listo para renderizar sin assets (la opción recomendada nunca depende de imágenes que todavía no existen).
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { ANTHROPIC_MODEL } from "./providers/anthropic.js";
import { planWithOpenAI, planWithGemini } from "./providers/keys.js";
import { runCli } from "./providers/subscriptions.js";
import type { ProviderId } from "./providers/index.js";
import { ARTHUR_DIR, VES } from "./ves.js";

type Opt = { title: string; cats?: string; desc?: string; ref?: string; type: string | null; props?: Record<string, unknown>; enter?: string; exit?: string; start?: number; end?: number; then?: unknown };
type Beat = { id: string; start: number; end: number; script: string; seen: string; pick: "A" | "B" | "C"; opts: Opt[] };
export type Asset = { id: string; name: string; kind: string; ar: string; prompt: string; negative?: string; for_beat?: string; is_ref?: boolean };
export type Beats = { title: string; beats: Beat[]; assets?: Asset[] };
export type Energia = "calma" | "media" | "viral";
export type PlanOpts = { energia: Energia; originales: boolean; broll: { path: string; desc: string }[]; notas?: string; palette?: Record<string, string> };

const ENERGIA: Record<Energia, string> = {
  calma: "Beats de 3–6 s. Respira: cara con subtítulos entre escenas. Algo cambia cada 3–4 s.",
  media: "Beats de 2–5 s. Algo cambia cada 2–3 s (corte, punch-in, escena, palabra clave).",
  viral: "Beats de 1.5–3.5 s. Gancho visual en 0–1.5 s (texto gancho + punch-in). Algo cambia cada 1–2 s. Nunca más de 3 s seguidos de cara sin un cambio (punch-in, escena o palabra clave). Cierre con llamado a la acción o loop que invite a verlo otra vez.",
};
const PRINCIPIOS = `01 Texto en pantalla (captions) · 02 B-roll + texto + overlay · 03 Imágenes/personajes + texto · 04 Línea + texto · 05 Línea + ilustraciones · 06 Escenas solo texto · 07 Ilustración central + texto · 08 Ilustración lateral + texto · 09 Objetos + texto · 10 Gráficas y estadística · 11 UI/pantallas · 12 Línea de tiempo · 13 Pantalla dividida · 14 Título/cierre/CTA`;

// Escenas que necesitan una imagen o video que aún no existe (se piden como assets en el STOP 2)
const NEEDS_MEDIA = new Set(["broll_text", "painting", "object_callout", "archival_photo", "video_card", "paper_collage", "arthur_broll", "j_painting", "j_broll", "name_card", "split_layout", "two_object"]);
let PROVIDED = new Set<string>(); // b-roll que Santiago ya subió: se puede usar en la opción recomendada
const mediaOf = (o: Opt) => (o.props as { media?: string | string[] })?.media;
const needsMedia = (o: Opt) => {
  if (!o.type || o.type === "mg_original") return false;
  const m = mediaOf(o);
  const provided = m && (Array.isArray(m) ? m : [m]).every((x) => PROVIDED.has(x));
  if (provided) return false;
  return NEEDS_MEDIA.has(o.type) || (["j_illus", "center_illustration", "arthur_orbit"].includes(o.type) && !!m);
};

const read = (p: string, max = 1e9) => (existsSync(p) ? readFileSync(p, "utf8").slice(0, max) : "");

function catalog(vesStyle: string) {
  const style = JSON.parse(read(join(VES, "styles", vesStyle, "style.json")) || "{}");
  const scenes = JSON.parse(read(join(VES, "schemas/scenes.json")));
  const allowed: string[] = style.scenes_allowed ?? Object.keys(scenes).filter((k) => !k.startsWith("_"));
  const sceneDoc = allowed.map((k) => `- ${k}${NEEDS_MEDIA.has(k) ? " (NECESITA asset)" : ""}: ${scenes[k]?.use_when ?? ""} props=${JSON.stringify(scenes[k]?.props ?? {})}`).join("\n");
  const anims = JSON.parse(read(join(ARTHUR_DIR, "library/ANIMATIONS.json")) || "[]") as { aid: string; category: string; script: string; what: string }[];
  const animDoc = anims.map((a) => `${a.aid} [${a.category}] «${a.script.slice(0, 60)}» ${a.what.slice(0, 150)}`).join("\n");
  return { style, allowed, sceneDoc, animDoc };
}

export function beatsPrompt(vesStyle: string, project: string, po: PlanOpts = { energia: "viral", originales: true, broll: [] }) {
  const { style, allowed, sceneDoc, animDoc } = catalog(vesStyle);
  const words = JSON.parse(read(join(VES, "projects", project, "transcript_cut.json"))).words as { w: string; start: number; end: number }[];
  const duration = words.at(-1)?.end ?? 0;
  const example = read(join(ARTHUR_DIR, "examples/v1/beats.json"), 9000);
  const system = `Eres el editor de "Emperador Santiago · Edición de Videos" y trabajas con la skill arthur-brooks-editing (método Joseph).
Tu trabajo AHORA es el paso 3 del flujo: escribir beats.json. No diseñas desde cero: eliges de la biblioteca de Arthur y rellenas el contrato.

# SKILL (reglas y flujo)
${read(join(ARTHUR_DIR, "SKILL.md"))}

# CONTRATO (beats.json y catálogo)
${read(join(ARTHUR_DIR, "CONTRATO.md"), 6000)}

# Lógica de edición (qué poner según lo que se dice)
${read(join(ARTHUR_DIR, "docs/EDIT_LOGIC.md"))}

# Estilo elegido: ${style.name ?? vesStyle}
${style.description ?? ""}
Transiciones permitidas: ${JSON.stringify(style.transitions ?? {})}
Escenas permitidas en este estilo (usa SOLO estos "type", o null para quedarse en el A-roll):
${sceneDoc}

# Biblioteca de animaciones de Arthur (ref = ID VNN-ANN)
${animDoc}

# Los 14 principios del tablero de inspiración de Arthur
${PRINCIPIOS}

# Ejemplo real de beats.json (V1, talking head)
${example}

# CREATIVIDAD (manda Santiago): la biblioteca es INSPIRACIÓN, no un catálogo para copiar
- Esto es para redes sociales: la edición viral es clave, no hay espacio para lo aburrido.
- A = la mejor adaptación de un patrón de Arthur a ESTE contenido (textos, formas, props pensados para lo que dice).
- B = una variación creativa propia: otra escena, inversión de color, forma distinta, combinación de dos principios, ritmo distinto.
- C = ${po.originales ? 'en los 2–3 momentos más fuertes del video, un motion graphic ORIGINAL: type "mg_original" con props.brief (qué se ve, cómo se mueve, qué texto y en qué palabra entra; inspirado en el estilo pero nuevo). En el resto, quedarse en la cara (type null) o una tercera idea.' : "quedarse en la cara (type null) o una tercera idea."}
- No repitas el mismo type en dos beats seguidos (salvo cara/aroll). Máximo 2 veces el mismo type en todo el video.
- Colores: la paleta del video ya está elegida (no es azul por defecto): ${JSON.stringify(po.palette ?? {})}. Usa bg "accent"/"white"/"black" para alternar y no texturices todo.`;

  const user = `Clip de Santiago ya cortado (${duration.toFixed(2)} s). Transcripción palabra a palabra (inicio fin palabra, segundos ABSOLUTOS):
${words.map((w) => `${w.start.toFixed(2)} ${w.end.toFixed(2)} ${w.w}`).join("\n")}

Energía pedida: ${po.energia.toUpperCase()} → ${ENERGIA[po.energia]}
${po.notas ? `Notas de Santiago (mandan): ${po.notas}\n` : ""}${po.broll.length ? `B-roll que Santiago ya subió (úsalo con j_broll / arthur_broll / broll_text, props.media = la ruta exacta; puede ir en la opción recomendada):\n${po.broll.map((b) => `- ${b.path}: ${b.desc}`).join("\n")}\n` : "No hay b-roll subido.\n"}
Escribe beats.json para este clip:
- Una idea = un beat de 1.5–6 s que cubren el video de principio a fin sin huecos ni solapes. El primer beat abre en la cara (type null o aroll).
- Cada beat: id (b01…), start, end, script (el texto dicho), seen (el patrón de Arthur que justifica la elección, con su ref), pick y exactamente 3 opts A/B/C con title, cats, desc, ref (un ID real de la biblioteca), type, props (con tiempos ABSOLUTOS de palabra en t / text_t / points[].t cuando el tipo los use) y enter/exit solo con transiciones permitidas y separadas.
- Assets: la opción que marques en "pick" debe poder renderizarse con lo que hay (sin assets nuevos, o con el b-roll subido, o mg_original). Las otras opciones pueden necesitar assets nuevos: ponles props.media = "media/assets/A01.png" (o .mp4) y descríbelos en "assets".
- Añade al JSON una lista "assets": [{id: "A01", name, kind: "image|broll|illustration|painting", ar: "9:16|4:5|1:1", prompt (7 bloques Katana: función de la referencia, contexto, mapa espacial, una acción, cámara, luz/textura, bloqueos), negative, for_beat: "b03"}] con cada asset que pidan las opciones B/C (máx. 8).
- Textos cortos en español (menos texto = más premium): "big" máx. 3 palabras; "small" y "after" máx. 4 palabras cada uno (más largo se sale del cuadro). Las palabras de "big" deben salir de lo que dice el clip.
- Respeta: cuando anuncia algo nuevo → cara; cuando lo describe → se muestra. Corte seco por defecto.
Devuelve SOLO el JSON de beats.json dentro de un bloque \`\`\`json.`;
  return { system, user, allowed, duration };
}

function extract(raw: string): Beats {
  const body = raw.match(/```json\s*([\s\S]*?)```/)?.[1] ?? raw;
  return JSON.parse(body.slice(body.indexOf("{"), body.lastIndexOf("}") + 1));
}

/** Limpia y asegura lo que el render necesita: tipos válidos, tiempos dentro del clip, opción recomendada sin assets. */
export function sanitize(b: Beats, allowed: string[], duration: number, originales = true): Beats {
  let beats = (b.beats ?? []).filter((x) => x && typeof x.start === "number" && typeof x.end === "number").sort((x, y) => x.start - y.start);
  // ningún beat más corto que 0.85 s (mínimo del render): se une al anterior
  beats = beats.reduce<Beat[]>((acc, x) => { const prev = acc[acc.length - 1]; if (prev && x.end - x.start < 0.85) { prev.end = x.end; prev.script += " " + x.script; } else acc.push(x); return acc; }, []);
  beats.forEach((x, i) => {
    x.id = `b${String(i + 1).padStart(2, "0")}`;
    x.start = Math.max(0, Math.min(duration, x.start));
    x.end = Math.max(x.start + 0.3, Math.min(duration, x.end));
    x.opts = (x.opts ?? []).slice(0, 3);
    while (x.opts.length < 3) x.opts.push({ title: "Quedarse en el A-roll", cats: "Captions · A-roll", desc: "", ref: "V01-A40", type: null, props: {} });
    // textos que no caben en una línea (se saldrían del cuadro): se recortan a 4–5 palabras
    for (const o of x.opts) for (const k of ["small", "after", "big"] as const) {
      const v = (o.props as Record<string, unknown> | undefined)?.[k];
      if (typeof v === "string" && v.split(/\s+/).length > (k === "big" ? 4 : 5)) (o.props as Record<string, unknown>)[k] = v.split(/\s+/).slice(0, k === "big" ? 4 : 5).join(" ");
    }
    for (const o of x.opts) if (o.type === "mg_original" && !originales) { o.type = null; o.props = {}; }
    for (const o of x.opts) if (o.type && !allowed.includes(o.type)) { o.desc = `${o.desc ?? ""} (tipo ${o.type} no disponible en este estilo: queda en A-roll)`; o.type = null; }
    const k = "ABC".indexOf(x.pick);
    if (k < 0 || needsMedia(x.opts[k])) {
      const ok = x.opts.findIndex((o) => !needsMedia(o));
      x.pick = (["A", "B", "C"] as const)[ok >= 0 ? ok : 2];
      if (ok < 0) x.opts[2] = { title: "Quedarse en el A-roll", cats: "Captions · A-roll", desc: "", ref: "V01-A40", type: null, props: {} };
    }
  });
  // máximo 3 originales elegidos (cada uno se genera con IA + HyperFrames)
  let n = 0;
  for (const x of beats) { const o = x.opts["ABC".indexOf(x.pick)]; if (o?.type === "mg_original" && ++n > 3) x.pick = (["A", "B", "C"] as const)[x.opts.findIndex((q) => q.type !== "mg_original" && !needsMedia(q))] ?? "C"; }
  return { title: b.title || "Plan por beats", beats, assets: (b.assets ?? []).slice(0, 8) };
}

export async function planBeats(provider: ProviderId, vesStyle: string, project: string, po?: PlanOpts): Promise<Beats> {
  PROVIDED = new Set((po?.broll ?? []).map((b) => b.path));
  const { system, user, allowed, duration } = beatsPrompt(vesStyle, project, po);
  let raw: string;
  if (provider === "claude-api") {
    const msg = await new Anthropic().beta.messages.stream({
      model: ANTHROPIC_MODEL, max_tokens: 64000,
      betas: ["server-side-fallback-2026-07-01"], fallbacks: "default",
      output_config: { effort: "high" },
      system, messages: [{ role: "user", content: user }],
    }).finalMessage();
    if (msg.stop_reason === "refusal") throw new Error("Claude rechazó la petición");
    raw = msg.content.flatMap((c) => (c.type === "text" ? [c.text] : [])).join("");
  } else if (provider === "openai-api") raw = await planWithOpenAI(system, user + "\n(Devuelve un objeto JSON)");
  else if (provider === "gemini-api") raw = await planWithGemini(system, user);
  else raw = await runCli(provider, `${system}\n\n---\n\n${user}`, 20 * 60_000);
  return sanitize(extract(raw), allowed, duration, po?.originales ?? true);
}
