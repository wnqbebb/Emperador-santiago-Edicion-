// Enrutador de proveedores: elige quién piensa el plan de edición.
import { PlanSchema, type Plan, type Style, type Word } from "../schema.js";
import { buildBrief, extractJson } from "../prompt.js";
import { planWithClaude, ANTHROPIC_MODEL } from "./anthropic.js";
import { planWithOpenAI, planWithGemini } from "./keys.js";
import { runCli, cliAvailable, type CliId } from "./subscriptions.js";

export type ProviderId = "claude-api" | "openai-api" | "gemini-api" | CliId;

export async function availableProviders() {
  const [claudeCli, codexCli, geminiCli] = await Promise.all(
    (["claude-cli", "codex-cli", "gemini-cli"] as CliId[]).map(cliAvailable),
  );
  return [
    { id: "claude-api", label: `Claude API · ${ANTHROPIC_MODEL}`, ready: !!process.env.ANTHROPIC_API_KEY },
    { id: "claude-cli", label: "Suscripción Claude (Claude Code)", ready: claudeCli },
    { id: "codex-cli", label: "Suscripción ChatGPT (Codex CLI)", ready: codexCli },
    { id: "gemini-cli", label: "Suscripción Gemini (Gemini CLI)", ready: geminiCli },
    { id: "openai-api", label: "OpenAI API", ready: !!process.env.OPENAI_API_KEY },
    { id: "gemini-api", label: "Gemini API", ready: !!process.env.GEMINI_API_KEY },
  ] as { id: ProviderId; label: string; ready: boolean }[];
}

export async function planEdit(
  provider: ProviderId,
  args: { style: Style; words: Word[]; duration: number; prompt: string },
): Promise<Plan> {
  const { system, user, jsonSchema } = buildBrief(args);
  if (provider === "claude-api") return planWithClaude(system, user);

  const schemaHint = `\n\nResponde SOLO con un objeto JSON que cumpla este JSON Schema:\n${JSON.stringify(jsonSchema)}`;
  let raw: string;
  if (provider === "openai-api") raw = await planWithOpenAI(system + schemaHint, user);
  else if (provider === "gemini-api") raw = await planWithGemini(system + schemaHint, user);
  else raw = await runCli(provider, `${system}${schemaHint}\n\n${user}`);
  return PlanSchema.parse(extractJson(raw));
}
