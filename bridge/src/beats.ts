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
export type Beats = { title: string; beats: Beat[] };

// Escenas que necesitan una imagen o video que aún no existe (se piden como assets en el STOP 2)
const NEEDS_MEDIA = new Set(["broll_text", "painting", "object_callout", "archival_photo", "video_card", "paper_collage", "arthur_broll", "j_painting", "j_broll", "name_card", "split_layout", "two_object"]);
const needsMedia = (o: Opt) => !!o.type && (NEEDS_MEDIA.has(o.type) || (["j_illus", "center_illustration", "arthur_orbit"].includes(o.type) && !!(o.props as { media?: string })?.media));

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

export function beatsPrompt(vesStyle: string, project: string) {
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

# Ejemplo real de beats.json (V1, talking head)
${example}`;

  const user = `Clip de Santiago ya cortado (${duration.toFixed(2)} s). Transcripción palabra a palabra (inicio fin palabra, segundos ABSOLUTOS):
${words.map((w) => `${w.start.toFixed(2)} ${w.end.toFixed(2)} ${w.w}`).join("\n")}

Escribe beats.json para este clip:
- Una idea = un beat de 1.5–6 s que cubren el video de principio a fin sin huecos ni solapes. El primer beat abre en la cara (type null o aroll).
- Cada beat: id (b01…), start, end, script (el texto dicho), seen (el patrón de Arthur que justifica la elección, con su ref), pick y exactamente 3 opts A/B/C con title, cats, desc, ref (un ID real de la biblioteca), type, props (con tiempos ABSOLUTOS de palabra en t / text_t / points[].t cuando el tipo los use) y enter/exit solo con transiciones permitidas y separadas.
- AÚN NO HAY ASSETS: la opción que marques en "pick" debe poder renderizarse sin imágenes (no uses en ella tipos marcados "NECESITA asset" ni props media). Las otras opciones sí pueden necesitarlos.
- Textos cortos en español (menos texto = más premium). Las palabras de "big" deben salir de lo que dice el clip.
- Respeta: cuando anuncia algo nuevo → cara; cuando lo describe → se muestra. Corte seco por defecto.
Devuelve SOLO el JSON de beats.json dentro de un bloque \`\`\`json.`;
  return { system, user, allowed, duration };
}

function extract(raw: string): Beats {
  const body = raw.match(/```json\s*([\s\S]*?)```/)?.[1] ?? raw;
  return JSON.parse(body.slice(body.indexOf("{"), body.lastIndexOf("}") + 1));
}

/** Limpia y asegura lo que el render necesita: tipos válidos, tiempos dentro del clip, opción recomendada sin assets. */
export function sanitize(b: Beats, allowed: string[], duration: number): Beats {
  const beats = (b.beats ?? []).filter((x) => x && typeof x.start === "number" && typeof x.end === "number").sort((x, y) => x.start - y.start);
  beats.forEach((x, i) => {
    x.id = `b${String(i + 1).padStart(2, "0")}`;
    x.start = Math.max(0, Math.min(duration, x.start));
    x.end = Math.max(x.start + 0.3, Math.min(duration, x.end));
    x.opts = (x.opts ?? []).slice(0, 3);
    while (x.opts.length < 3) x.opts.push({ title: "Quedarse en el A-roll", cats: "Captions · A-roll", desc: "", ref: "V01-A40", type: null, props: {} });
    for (const o of x.opts) if (o.type && !allowed.includes(o.type)) { o.desc = `${o.desc ?? ""} (tipo ${o.type} no disponible en este estilo: queda en A-roll)`; o.type = null; }
    const k = "ABC".indexOf(x.pick);
    if (k < 0 || needsMedia(x.opts[k])) {
      const ok = x.opts.findIndex((o) => !needsMedia(o));
      x.pick = (["A", "B", "C"] as const)[ok >= 0 ? ok : 2];
      if (ok < 0) x.opts[2] = { title: "Quedarse en el A-roll", cats: "Captions · A-roll", desc: "", ref: "V01-A40", type: null, props: {} };
    }
  });
  return { title: b.title || "Plan por beats", beats };
}

export async function planBeats(provider: ProviderId, vesStyle: string, project: string): Promise<Beats> {
  const { system, user, allowed, duration } = beatsPrompt(vesStyle, project);
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
  return sanitize(extract(raw), allowed, duration);
}
