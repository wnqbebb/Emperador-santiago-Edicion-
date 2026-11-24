// El "brief" que recibe cualquier modelo (Fable vía API, o tu suscripción vía MCP/CLI).
import { z } from "zod";
import { PlanSchema, type Style, type Word } from "./schema.js";
import { PIXEL_FX_META } from "../../shared/fxmeta.js";

export function transcriptLines(words: Word[]) {
  // Formato compacto: [t0-t1] palabra  — ahorra tokens y conserva tiempos exactos.
  return words.map((w) => `${w.t0.toFixed(2)}-${w.t1.toFixed(2)} ${w.w}`).join("\n");
}

export function buildBrief(opts: { style: Style; words: Word[]; duration: number; prompt: string }) {
  const { style, words, duration, prompt } = opts;
  const system = `Eres el director de edición de Emperador Santiago · Edición de Videos, especialista en video corto vertical (Reels, TikTok, Shorts).
Recibes la transcripción con tiempos palabra por palabra y un "Style DNA". Devuelves un plan de edición JSON.

Reglas:
- "segments": conserva el contenido con valor; corta silencios mayores a ${style.pacing.maxSilence}s, muletillas, repeticiones y arranques en falso. Nunca cortes a mitad de palabra; usa los tiempos dados.
- Apunta a ~${style.pacing.cutsPerMinute} cortes por minuto y a un punch-in cada ~${style.pacing.zoomEvery}s en momentos de énfasis.
- "emphasis": de 1 a 2 palabras clave por frase; usa la palabra exactamente como aparece.
- "motion": ${style.motion.hookTitle ? "un título-gancho en los primeros 2.5s; " : ""}${style.motion.emojis ? "emojiPop en conceptos concretos (máx. 1 cada 4s); " : ""}${style.motion.lowerThird ? "un lowerThird si se presenta una persona o un dato; " : ""}${style.motion.progress ? "una barra 'progress' de principio a fin; " : ""}highlightBox/counter solo cuando aporten.
- Efectos especiales (máx. 1 cada 6s, solo en los momentos más fuertes): "pixelfx" con text = uno de estos ids: ${Object.entries(PIXEL_FX_META).map(([id, m]) => `${id} (${m.uso})`).join("; ")}. "intro3d" (corona dorada 3D, 2.8s, text vacío) como apertura si el estilo es imperial o épico.
- Todos los tiempos en segundos del clip ORIGINAL (duración ${duration.toFixed(2)}s).

Style DNA "${style.name}": ${style.description}
Notas del estilo: ${style.notes}`;

  const user = `Instrucción del editor: ${prompt || "Edita para máxima retención."}

Transcripción (inicio-fin palabra):
${transcriptLines(words)}`;

  return { system, user, jsonSchema: z.toJSONSchema(PlanSchema) };
}

/** Extrae el primer objeto JSON de una respuesta de texto libre (para CLIs). */
export function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fenced ? fenced[1] : text;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start < 0 || end < start) throw new Error("La respuesta no contiene JSON");
  return JSON.parse(body.slice(start, end + 1));
}
