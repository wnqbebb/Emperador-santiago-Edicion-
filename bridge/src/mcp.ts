// Servidor MCP de Santi. Regístralo en Claude Desktop/Claude Code, ChatGPT (conectores MCP) o Gemini CLI.
// Así el modelo de TU suscripción hace de director: lee el brief y entrega el plan con submit_plan.
import "./env.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { listStyles, getStyle, saveStyle, listJobs, getJob, updateJob } from "./store.js";
import { buildBrief } from "./prompt.js";
import { PlanSchema, StyleSchema } from "./schema.js";
import { runReaVideo, readDigest, reaInstalled, slug } from "./analyze.js";
import { searchIdeas, motionBrief, renderMotionHtml } from "./motion.js";
import { DATA } from "./store.js";
import { startMontaje, getMontaje } from "./montaje.js";
import { readdirSync } from "node:fs";
import { runVes, waitVes, listVesStyles, listProjects, projectStatus, writeVesFile, vesPath, type VesScript } from "./ves.js";
import { readFileSync as readF, existsSync as exists } from "node:fs";
import { join, resolve } from "node:path";

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

server.registerTool(
  "santi_analyze_reference",
  {
    description:
      "Desarma un video de referencia con rea-video (tomas, ritmo de cortes, subtítulos, sonido, look) y devuelve el resumen VIDEO.md. Úsalo para 'entrenar' un Estilo de Santi: lee el resumen y luego llama a santi_save_style.",
    inputSchema: { videoPath: z.string().describe("Ruta absoluta del video en este equipo"), name: z.string() },
  },
  async ({ videoPath, name }) => {
    if (!reaInstalled()) return text("rea-video no está instalado. Ejecuta: npm run setup:rea");
    const out = join(DATA, "analysis", slug(name));
    await runReaVideo(resolve(videoPath), out);
    return text(`Desglose completo en ${out} (abre report.html para verlo).\n\n${readDigest(out)}`);
  },
);

server.registerTool(
  "santi_motion_ideas",
  { description: "Busca ideas de motion graphics en la biblioteca (683 prompts de animaciones hechas en código).", inputSchema: { query: z.string(), category: z.enum(["", "motion", "explainer", "3d", "interactive"]).optional() } },
  async ({ query, category }) => text(JSON.stringify(searchIdeas(query, category ?? "", 15).map(({ id, category, prompt, post }) => ({ id, category, prompt, post })), null, 2)),
);

server.registerTool(
  "santi_motion_brief",
  { description: "Devuelve las reglas para escribir un motion graphic vertical como composición HyperFrames. Escribe el HTML y entrégalo con santi_render_motion.", inputSchema: { idea: z.string(), seconds: z.number().min(2).max(30) } },
  async ({ idea, seconds }) => text(motionBrief(idea, seconds, getStyle("imperial")!)),
);

server.registerTool(
  "santi_render_motion",
  { description: "Renderiza con HyperFrames el index.html de un motion graphic y devuelve la URL del MP4 para insertarlo como b-roll.", inputSchema: { html: z.string(), seconds: z.number() } },
  async ({ html, seconds }) => {
    const j = await renderMotionHtml(html, seconds);
    return text(`Listo: ${j.url}\nProyecto editable: ${j.projectDir}`);
  },
);

server.registerTool(
  "santi_unir_clips",
  {
    description: "Unión de clips y recortes de silencio: une varios clips en orden, corta silencios (umbral adaptativo, sin cortar palabras), opcionalmente quita muletillas, y entrega el video completo (master + versión comprimida para redes). Si pasas una carpeta, ordena los archivos por nombre (clip 1, clip 2, … clip 10).",
    inputSchema: {
      paths: z.array(z.string()).describe("Rutas de los clips en orden, o una sola carpeta"),
      ritmo: z.enum(["natural", "dinamico", "agresivo"]).optional(),
      muletillas: z.boolean().optional().describe("Quitar eh, mmm… (usa Whisper, más lento)"),
      formato: z.enum(["vertical", "original"]).optional(),
    },
  },
  async ({ paths, ritmo, muletillas, formato }) => {
    let files = paths.map((p) => resolve(p));
    if (files.length === 1 && !/\.\w{2,4}$/.test(files[0])) {
      const coll = new Intl.Collator("es", { numeric: true, sensitivity: "base" });
      files = readdirSync(files[0]).filter((f) => /\.(mp4|mov|m4v|webm|mkv)$/i.test(f)).sort(coll.compare).map((f) => join(paths[0], f));
    }
    const job = startMontaje(files.map((p) => ({ path: p, name: p.split("/").pop()! })), { ritmo: ritmo ?? "dinamico", muletillas: !!muletillas, formato: formato ?? "vertical" });
    while (getMontaje(job.id)!.status === "running") await new Promise((r) => setTimeout(r, 1000));
    if (job.status === "error") return text(`Error: ${job.error}`);
    const before = job.clips.reduce((t, c) => t + c.before, 0), after = job.clips.reduce((t, c) => t + c.after, 0);
    return text(`Listo: ${files.length} clips · ${before.toFixed(1)} s → ${after.toFixed(1)} s (−${(before - after).toFixed(1)} s)\nMaster: ${job.master} (${job.masterMB} MB)\nRedes: ${job.web} (${job.webMB} MB)\n\n${job.clips.map((c, i) => `${i + 1}. ${c.name}: ${c.before.toFixed(1)}→${c.after.toFixed(1)} s, ${c.cuts} cortes${c.fillers ? `, ${c.fillers} muletillas` : ""}`).join("\n")}`);
  },
);

// ---------- VES · crear-estilo-edicion (sigue .claude/skills/crear-estilo-edicion/SKILL.md y system/AGENTS.md)
server.registerTool(
  "santi_ves_overview",
  { description: "Estado de VES: estilos (Arthur Brooks y los creados), proyectos de edición y qué falta en cada uno. Léelo antes de usar las demás herramientas santi_ves_*." },
  async () => text(JSON.stringify({ styles: listVesStyles().map((v) => ({ id: v.id, name: v.name })), projects: listProjects() }, null, 2)),
);

server.registerTool(
  "santi_ves_run",
  {
    description:
      "Ejecuta un paso de VES y devuelve su salida. script ves (ves.py): new, all, transcribe, rawcut, palette, captions, captionsheet, plandoc, validate, storyboard, preview, fork, render --draft, sound --draft. script lab (style_lab.py): nuevo, preparar, estado, briefs, sonido, energia, biblioteca, empaquetar. También beats (panel, apply), sheets (palette, music, pick-palette, pick-music), assets, fixwords, cutout, classify. Aprobar y el render/sonido final NO están disponibles aquí: los confirma Santiago en el editor (STOP 3).",
    inputSchema: { script: z.enum(["ves", "lab", "beats", "assets", "sheets", "fixwords", "cutout", "classify"]), args: z.array(z.string()), estilo: z.string().optional().describe("Para lab/classify: estilo en el que se trabaja") },
  },
  async ({ script, args, estilo }) => {
    const job = await waitVes(runVes(script as VesScript, args, estilo ? { VES_STYLE: estilo, VES_REFS: estilo } : {}));
    return text(`[${job.status}] ${job.cmd}\n${job.log.slice(-80).join("\n")}`);
  },
);

server.registerTool(
  "santi_ves_read",
  { description: "Lee un archivo de VES (ruta relativa a system/: AGENTS.md, schemas/scenes.json, styles/<estilo>/…, projects/<p>/…).", inputSchema: { path: z.string() } },
  async ({ path }) => {
    const full = vesPath(path);
    return text(exists(full) ? readF(full, "utf8").slice(0, 60_000) : "No existe");
  },
);

server.registerTool(
  "santi_ves_write",
  {
    description: "Escribe un archivo que el método VES pide al modelo: projects/<p>/edit_plan.json o beats.json; styles/<estilo>/references/vNN/scenes.json o edit_logic.json; styles/<estilo>/style.json o labels.json; styles/<estilo>/skill/SKILL.md, RULEBOOK.md, EDIT_LOGIC.md o FORMATOS.md.",
    inputSchema: { path: z.string(), content: z.string() },
  },
  async ({ path, content }) => text(`Guardado: ${writeVesFile(path, content)}`),
);

server.registerTool(
  "santi_ves_project",
  { description: "Estado de un proyecto VES: transcripción, plan, aprobación y archivos generados (plan.html, storyboard, hoja de captions, borrador).", inputSchema: { name: z.string() } },
  async ({ name }) => text(JSON.stringify(projectStatus(name), null, 2)),
);

await server.connect(new StdioServerTransport());
