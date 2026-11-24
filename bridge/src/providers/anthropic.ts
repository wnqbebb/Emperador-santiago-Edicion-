// Claude vía API (clave de Console). Por defecto Claude Fable 5.2, el modelo más capaz.
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { PlanSchema, type Plan } from "../schema.js";

export const ANTHROPIC_MODEL = process.env.SANTI_CLAUDE_MODEL ?? "claude-fable-5-2";

export async function planWithClaude(system: string, user: string): Promise<Plan> {
  const client = new Anthropic(); // lee ANTHROPIC_API_KEY o el perfil de `ant auth login`
  const msg = await client.beta.messages.parse({
    model: ANTHROPIC_MODEL,
    max_tokens: 16000,
    // Si un clasificador de seguridad rechaza la petición, el servidor reintenta con otro modelo.
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "high", format: betaZodOutputFormat(PlanSchema) },
    system,
    messages: [{ role: "user", content: user }],
  });
  if (msg.stop_reason === "refusal") throw new Error("Claude rechazó la petición");
  if (msg.stop_reason === "max_tokens") throw new Error("Respuesta truncada (max_tokens)");
  if (!msg.parsed_output) throw new Error("No se pudo interpretar el plan de Claude");
  return msg.parsed_output;
}

export async function describeFrames(framesB64: string[], instruction: string): Promise<string> {
  const client = new Anthropic();
  const msg = await client.messages.create({
    model: ANTHROPIC_MODEL,
    max_tokens: 4000,
    messages: [
      {
        role: "user",
        content: [
          ...framesB64.map((data) => ({
            type: "image" as const,
            source: { type: "base64" as const, media_type: "image/jpeg" as const, data },
          })),
          { type: "text" as const, text: instruction },
        ],
      },
    ],
  });
  if (msg.stop_reason === "refusal") throw new Error("Claude rechazó la petición");
  return msg.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("\n");
}
