// Servidor MCP de Santi. Regístralo en Claude Desktop/Claude Code, ChatGPT (conectores MCP) o Gemini CLI.
// Así el modelo de TU suscripción hace de director: lee el brief y entrega el plan con submit_plan.
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { listStyles, getStyle, saveStyle, listJobs, getJob, updateJob } from "./store.js";
import { buildBrief } from "./prompt.js";
import { PlanSchema, StyleSchema } from "./schema.js";

const server = new McpServer({ name: "emperador-santiago", version: "0.1.0" });
const text = (t: string) => ({ content: [{ type: "text" as const, text: t }] });

server.registerTool(
  "santi_list_jobs",
  { description: "Lista los clips que Emperador Santiago · Edición de Videos tiene esperando un plan de edición." },
  async () => text(JSON.stringify(listJobs().map(({ words, ...j }) => ({ ...j, words: words.length, planned: !!j.plan })), null, 2)),
);

server.registerTool(
  "santi_get_brief",
  {
    description:
      "Devuelve el brief completo de un clip (instrucciones del estilo + transcripción con tiempos + JSON Schema del plan). Léelo y luego llama a santi_submit_plan.",
    inputSchema: { jobId: z.string() },
  },
  async ({ jobId }) => {
    const job = getJob(jobId);
    if (!job) return text("No existe ese trabajo");
    const style = getStyle(job.styleId);
    if (!style) return text(`Estilo ${job.styleId} no encontrado`);
    const b = buildBrief({ style, words: job.words, duration: job.duration, prompt: job.prompt });
    return text(`${b.system}\n\n${b.user}\n\nJSON Schema del plan:\n${JSON.stringify(b.jsonSchema)}`);
  },
);

server.registerTool(
  "santi_submit_plan",
  {
    description: "Entrega el plan de edición de un clip. Emperador Santiago · Edición de Videos lo aplica en el navegador al instante.",
    inputSchema: { jobId: z.string(), plan: PlanSchema, plannedBy: z.string().optional() },
  },
  async ({ jobId, plan, plannedBy }) => {
    const job = getJob(jobId);
    if (!job) return text("No existe ese trabajo");
    updateJob({ ...job, plan, plannedBy: plannedBy ?? "mcp" });
    return text(`Plan guardado para ${jobId}: ${plan.segments.length} segmentos, ${plan.motion.length} gráficos.`);
  },
);

server.registerTool(
  "santi_list_styles",
  { description: "Lista los Style DNA disponibles (estilos de edición aprendidos)." },
  async () => text(JSON.stringify(listStyles(), null, 2)),
);

server.registerTool(
  "santi_save_style",
  {
    description:
      "Crea o actualiza un Style DNA. Úsalo después de analizar videos de referencia para 'entrenar' a Santi en un estilo.",
    inputSchema: { style: StyleSchema },
  },
  async ({ style }) => text(`Estilo guardado: ${saveStyle(style).id}`),
);

await server.connect(new StdioServerTransport());
