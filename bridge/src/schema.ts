// Esquema del "Plan de edición" (EDL) que produce cualquier IA y que el motor web renderiza.
// Todos los tiempos están en segundos del clip ORIGINAL.
import { z } from "zod";

export const MotionKind = z.enum(["title", "lowerThird", "emojiPop", "highlightBox", "counter", "progress", "pixelfx", "intro3d", "broll"]);

export const PlanSchema = z.object({
  summary: z.string().describe("1-2 frases: qué decidiste y por qué"),
  segments: z
    .array(z.object({ start: z.number(), end: z.number() }))
    .describe("Rangos del clip original que se CONSERVAN, en orden. Lo que no esté aquí se corta."),
  emphasis: z.array(z.string()).describe("Palabras exactas del transcript que deben resaltarse en los subtítulos"),
  zooms: z.array(z.object({ at: z.number(), dur: z.number(), scale: z.number() })).describe("Punch-ins: scale 1.05-1.3"),
  motion: z.array(
    z.object({
      kind: MotionKind,
      start: z.number(),
      end: z.number(),
      text: z.string().describe("Texto del gráfico, el emoji, el id del efecto pixelfx o la URL del b-roll; vacío si no aplica"),
    }),
  ),
});
export type Plan = z.infer<typeof PlanSchema>;

export const StyleSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  caption: z.object({
    font: z.string(),
    weight: z.number(),
    size: z.number().describe("Proporción del alto del lienzo, ej. 0.055"),
    color: z.string(),
    highlight: z.string(),
    stroke: z.string(),
    uppercase: z.boolean(),
    wordsPerChunk: z.number(),
    animation: z.enum(["pop", "karaoke", "fade", "bounce"]),
    position: z.number().describe("0 = arriba, 1 = abajo"),
  }),
  pacing: z.object({ maxSilence: z.number(), zoomEvery: z.number(), cutsPerMinute: z.number() }),
  motion: z.object({ emojis: z.boolean(), hookTitle: z.boolean(), progress: z.boolean(), lowerThird: z.boolean() }),
  grade: z.object({ contrast: z.number(), saturate: z.number(), brightness: z.number() }),
  notes: z.string().describe("Guía en lenguaje natural que la IA debe seguir al editar con este estilo"),
});
export type Style = z.infer<typeof StyleSchema>;

export type Word = { w: string; t0: number; t1: number };
export type EditJob = {
  id: string;
  createdAt: string;
  styleId: string;
  prompt: string;
  duration: number;
  words: Word[];
  plan?: Plan;
  plannedBy?: string;
};
