// Almacenamiento local en disco: estilos y trabajos. Todo vive en ./data (sin nube).
import { mkdirSync, readdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { StyleSchema, type EditJob, type Style } from "./schema.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
export const DATA = process.env.KAIRO_DATA ?? join(ROOT, "data");
const STYLES_BUILTIN = join(ROOT, "styles");
const STYLES_USER = join(DATA, "styles");
const JOBS = join(DATA, "jobs");
for (const d of [STYLES_USER, JOBS]) mkdirSync(d, { recursive: true });

const readJson = (p: string) => JSON.parse(readFileSync(p, "utf8"));

export function listStyles(): Style[] {
  const out = new Map<string, Style>();
  for (const dir of [STYLES_BUILTIN, STYLES_USER]) {
    if (!existsSync(dir)) continue;
    for (const f of readdirSync(dir).filter((f) => f.endsWith(".json"))) {
      const parsed = StyleSchema.safeParse(readJson(join(dir, f)));
      if (parsed.success) out.set(parsed.data.id, parsed.data);
    }
  }
  return [...out.values()];
}
export const getStyle = (id: string) => listStyles().find((s) => s.id === id);
export function saveStyle(style: Style) {
  const s = StyleSchema.parse(style);
  writeFileSync(join(STYLES_USER, `${s.id}.json`), JSON.stringify(s, null, 2));
  return s;
}

export function createJob(j: Omit<EditJob, "id" | "createdAt">): EditJob {
  const job: EditJob = { ...j, id: randomUUID().slice(0, 8), createdAt: new Date().toISOString() };
  writeFileSync(join(JOBS, `${job.id}.json`), JSON.stringify(job));
  return job;
}
export const getJob = (id: string): EditJob | undefined =>
  existsSync(join(JOBS, `${id}.json`)) ? readJson(join(JOBS, `${id}.json`)) : undefined;
export function updateJob(job: EditJob) {
  writeFileSync(join(JOBS, `${job.id}.json`), JSON.stringify(job));
}
export function listJobs(): EditJob[] {
  return readdirSync(JOBS)
    .filter((f) => f.endsWith(".json"))
    .map((f) => readJson(join(JOBS, f)) as EditJob)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
