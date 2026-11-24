// Integración de VES (Viral Edit System) y la skill "crear-estilo-edicion" dentro de Emperador Santiago.
// VES vive en .claude/skills/crear-estilo-edicion/system (Python + Remotion propio). Aquí lo ejecutamos con el
// entorno de Python del proyecto (tools/.venv), mostramos sus archivos y respetamos sus 3 STOPs:
// aprobar y renderizar en final SOLO lo hace el humano (nunca una IA por MCP).
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, dirname, resolve, relative, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import type { Style } from "./schema.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
export const SKILL_DIR = join(ROOT, ".claude/skills/crear-estilo-edicion");
/** Laboratorio de estilos (crear-estilo-edicion). */
export const LAB = join(SKILL_DIR, "system");
/** Edición: el sistema de la skill arthur-brooks-editing (trae la biblioteca de 339 animaciones y el panel de beats). */
export const ARTHUR_DIR = join(ROOT, ".claude/skills/arthur-brooks-editing");
export const VES = existsSync(join(ARTHUR_DIR, "system/pipeline/ves.py")) ? join(ARTHUR_DIR, "system") : LAB;
const VENV = join(ROOT, "tools/.venv/bin");
export const vesInstalled = () => existsSync(join(VES, "pipeline/ves.py")) && existsSync(join(VENV, "python"));

const SCRIPTS = { ves: "ves.py", lab: "style_lab.py", beats: "beats.py", assets: "assetpack.py", sheets: "review_sheets.py", fixwords: "fixwords.py", cutout: "cutout.py", classify: "../reverse/classify.py" } as const;
export type VesScript = keyof typeof SCRIPTS;

/** Comandos que solo el humano puede ordenar (contrato VES: STOP 3). */
export function humanOnly(script: VesScript, args: string[]) {
  return script === "ves" && (args[0] === "approve" || (args[0] === "render" && !args.includes("--draft")) || (args[0] === "sound" && !args.includes("--draft")));
}

// Subcomandos permitidos por script (nada fuera de esta lista se ejecuta)
const ALLOWED: Partial<Record<VesScript, string[]>> = {
  ves: ["new", "all", "transcribe", "rawcut", "palette", "captions", "captionsheet", "plandoc", "validate", "storyboard", "preview", "fork", "render", "sound"],
  lab: ["nuevo", "preparar", "estado", "briefs", "sonido", "energia", "biblioteca", "empaquetar"],
  beats: ["panel", "apply"],
  sheets: ["palette", "music", "pick-palette", "pick-music"],
};
export function checkArgs(script: VesScript, args: string[]) {
  if (!(script in SCRIPTS)) throw new Error(`Script desconocido: ${script}`);
  const allowed = ALLOWED[script];
  if (allowed && !allowed.includes(args[0])) throw new Error(`Comando no permitido: ${script} ${args[0]}. Permitidos: ${allowed.join(", ")}`);
  if (humanOnly(script, args)) throw new Error("Aprobar y renderizar en final lo ordena Santiago con su confirmación (STOP 3).");
}

/** STOP 3: aprobar / render final / sonido final. Exige que el humano escriba la frase de confirmación. */
export const confirmPhrase = (action: "approve" | "render" | "sound", project: string) =>
  `${{ approve: "APROBAR", render: "RENDER FINAL", sound: "SONIDO FINAL" }[action]} ${project}`;
export function humanAction(project: string, action: "approve" | "render" | "sound", confirm: string) {
  if (!/^[\w.-]+$/.test(project)) throw new Error("Proyecto inválido");
  if (confirm.trim() !== confirmPhrase(action, project)) throw new Error(`Para confirmar escribe exactamente: ${confirmPhrase(action, project)}`);
  return startJob("ves", [action, project]);
}

export type VesJob = { id: string; cmd: string; status: "running" | "done" | "error"; log: string[]; code?: number };
const jobs = new Map<string, VesJob>();
export const getVesJob = (id: string) => jobs.get(id);

export function runVes(script: VesScript, args: string[], env: Record<string, string> = {}): VesJob {
  checkArgs(script, args);
  return startJob(script, args, env);
}

function startJob(script: VesScript, args: string[], env: Record<string, string> = {}): VesJob {
  const id = randomUUID().slice(0, 8);
  const root = script === "lab" || script === "classify" ? LAB : VES;
  const file = join(root, "pipeline", SCRIPTS[script]);
  const job: VesJob = { id, cmd: `${SCRIPTS[script]} ${args.join(" ")}`, status: "running", log: [] };
  jobs.set(id, job);
  const child = spawn(join(VENV, "python"), [file, ...args], {
    cwd: root,
    env: { ...process.env, ...env, PATH: `${VENV}:${process.env.PATH}`, PYTHONUNBUFFERED: "1" },
  });
  const feed = (d: Buffer) => { job.log.push(...d.toString().split("\n").filter(Boolean)); job.log = job.log.slice(-200); };
  child.stdout.on("data", feed);
  child.stderr.on("data", feed);
  child.on("error", (e) => { job.status = "error"; job.log.push(e.message); });
  child.on("close", (code) => { job.code = code ?? -1; job.status = code === 0 ? "done" : "error"; });
  return job;
}

/** Espera a que termine un trabajo (para MCP y la línea de comandos). */
export async function waitVes(job: VesJob, timeoutMs = 60 * 60_000) {
  const t0 = Date.now();
  while (job.status === "running" && Date.now() - t0 < timeoutMs) await new Promise((r) => setTimeout(r, 500));
  return job;
}

// ---------- Estilos VES
type VesStyleJson = {
  id: string; name: string; description: string;
  fonts: Record<string, { family: string; weight?: number; style?: string }>;
  palette: { fixed?: Record<string, string>; roles?: Record<string, string> };
  captions: { max_words?: number; base_size?: number; color?: string; special_color?: string; animation?: string; center_y?: number };
  pacing?: Record<string, number>;
  scenes_allowed?: string[];
};

export function listVesStyles() {
  const dir = join(VES, "styles");
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((d) => existsSync(join(dir, d, "style.json")))
    .map((d) => JSON.parse(readFileSync(join(dir, d, "style.json"), "utf8")) as VesStyleJson);
}

/** Un estilo VES como Estilo de Santi (para el editor rápido; el resultado completo sale con el flujo VES). */
export function vesToSanti(v: VesStyleJson): Style {
  const fixed = v.palette.fixed ?? {};
  const accent = fixed[v.palette.roles?.accent ?? "vibrant_bright"] ?? "#1B54F8";
  const font = v.fonts.sans_bold?.family ?? v.fonts.sans?.family ?? "Inter";
  const known = ["Anton", "Oswald", "Inter", "Playfair Display", "Space Grotesk"];
  return {
    id: `ves-${v.id}`,
    name: `VES · ${v.name}`,
    description: v.description,
    caption: {
      font: known.includes(font) ? font : "Inter",
      weight: v.fonts.sans_bold?.weight ?? 700,
      size: Math.min(0.06, (v.captions.base_size ?? 70) / 1920 * 1.15),
      color: v.captions.color ?? "#FFFFFF",
      highlight: v.captions.special_color && v.captions.special_color.toUpperCase() !== "#FFFFFF" ? v.captions.special_color : accent,
      stroke: "transparent",
      uppercase: false,
      wordsPerChunk: v.captions.max_words ?? 5,
      animation: "fade",
      position: Math.max(0.5, Math.min(0.72, v.captions.center_y ?? 0.6)),
    },
    pacing: { maxSilence: 0.35, zoomEvery: 7, cutsPerMinute: 12 },
    motion: { emojis: false, hookTitle: true, progress: false, lowerThird: true },
    grade: { contrast: 1.04, saturate: 0.95, brightness: 1 },
    notes: `Estilo VES "${v.name}". Corte seco por defecto, transiciones separadas ≥ 8 s, subtítulos ≤ ${v.captions.max_words ?? 5} palabras con la palabra clave en el color de marca. Escenas del estilo: ${(v.scenes_allowed ?? []).slice(0, 12).join(", ")}. Para la versión completa con sus escenas animadas usa el flujo VES (pestaña Laboratorio).`,
  };
}

// ---------- Proyectos y archivos
export function listProjects() {
  const dir = join(VES, "projects");
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((p) => statSync(join(dir, p)).isDirectory()).map((p) => projectStatus(p));
}

export function projectStatus(p: string) {
  const dir = join(VES, "projects", p);
  if (!existsSync(dir)) return { name: p, style: undefined, transcript: false, plan: false, beats: false, approved: false, files: [] as string[] };
  const has = (f: string) => existsSync(join(dir, f));
  const outs = existsSync(join(dir, "out")) ? readdirSync(join(dir, "out")).filter((o) => /\.(html|png|jpg|mp4|json)$/.test(o)) : [];
  const roots = readdirSync(dir).filter((f) => /\.(html|zip|md)$/.test(f));
  return {
    name: p,
    style: has("project.json") ? JSON.parse(readFileSync(join(dir, "project.json"), "utf8")).style : undefined,
    transcript: has("transcript.json") || has("transcript_cut.json"),
    plan: has("edit_plan.json"),
    beats: has("beats.json"),
    approved: has("APPROVED") || has("approved.json") || outs.some((o) => /approved/i.test(o)),
    files: [...roots.map((f) => `projects/${p}/${f}`), ...outs.map((o) => `projects/${p}/out/${o}`)],
  };
}

/** Ruta segura dentro de VES (para servir y escribir archivos). */
export function vesPath(rel: string) {
  const full = resolve(VES, normalize(rel));
  if (relative(VES, full).startsWith("..")) throw new Error("Ruta fuera de VES");
  return full;
}

// Archivos que una IA puede escribir por MCP (lo que el método pide al modelo)
const WRITABLE = [
  /^projects\/[\w.-]+\/(edit_plan|beats)\.json$/,
  /^styles\/[\w.-]+\/references\/v\d+\/(scenes|edit_logic|breakdown|edit_logic)\.(json|md)$/,
  /^styles\/[\w.-]+\/(style\.json|labels\.json)$/,
  /^styles\/[\w.-]+\/skill\/(SKILL|RULEBOOK|EDIT_LOGIC|FORMATOS)\.md$/,
];
export function writeVesFile(rel: string, content: string) {
  if (!WRITABLE.some((re) => re.test(rel))) throw new Error(`No se permite escribir ${rel}. Permitidos: edit_plan.json, beats.json, scenes/edit_logic por video, style.json, labels.json y los .md de la skill del estilo.`);
  const full = vesPath(rel);
  if (rel.endsWith(".json")) JSON.parse(content); // valida
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, content);
  return full;
}
