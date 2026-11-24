// Cliente del bridge local (IA + MCP). Si no responde, la app sigue en modo offline.
import type { Plan, Style, Word } from "./types";
const BASE = import.meta.env.VITE_SANTI_BRIDGE ?? "http://localhost:8787";

export type Provider = { id: string; label: string; ready: boolean };

async function j<T>(path: string, init?: RequestInit): Promise<T> {
  const r = await fetch(BASE + path, { ...init, headers: { "content-type": "application/json" } });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error ?? r.statusText);
  return data;
}

export const health = () => j<{ ok: boolean; providers: Provider[] }>("/api/health").catch(() => null);
export const fetchStyles = () => j<Style[]>("/api/styles").catch(() => [] as Style[]);
export const saveStyle = (s: Style) => j<Style>("/api/styles", { method: "POST", body: JSON.stringify(s) });

export type PlanReq = { provider: string; styleId: string; words: Word[]; duration: number; prompt: string };
export const requestPlan = (b: PlanReq) => j<{ plan: Plan }>("/api/plan", { method: "POST", body: JSON.stringify(b) });

export const createJob = (b: Omit<PlanReq, "provider">) => j<{ id: string }>("/api/jobs", { method: "POST", body: JSON.stringify(b) });
export const getJob = (id: string) => j<{ id: string; plan?: Plan; plannedBy?: string }>(`/api/jobs/${id}`);

export type RenderJob = { id: string; engine: "remotion" | "hyperframes"; status: string; progress: number; error?: string; projectDir?: string };
export async function uploadMedia(f: File) {
  const r = await fetch(`${BASE}/api/media?name=${encodeURIComponent(f.name)}`, { method: "POST", body: f });
  return (await r.json()) as { mediaId: string; url: string };
}
export const startRender = (b: { engine: string; mediaId: string; styleId: string; plan: Plan; words: Word[] }) =>
  j<RenderJob>("/api/render", { method: "POST", body: JSON.stringify(b) });
export const getRender = (id: string) => j<RenderJob>(`/api/render/${id}`);
export const renderFileUrl = (id: string) => `${BASE}/api/render/${id}/file`;

export type Idea = { id: string; category: string; tech: string[]; author: string; post: string; prompt: string };
export const searchIdeas = (q: string, cat: string) => j<Idea[]>(`/api/library?q=${encodeURIComponent(q)}&cat=${cat}`);
export type MotionJob = { id: string; status: string; url?: string; error?: string; seconds: number; projectDir: string };
export const startMotion = (b: { provider: string; idea: string; seconds: number; styleId: string }) => j<MotionJob>("/api/motion", { method: "POST", body: JSON.stringify(b) });
export const getMotion = (id: string) => j<MotionJob>(`/api/motion/${id}`);
export type Analysis = { id: string; status: string; log: string[]; style?: Style; error?: string };
export const startAnalysis = (b: { mediaId: string; name: string; provider?: string }) => j<Analysis>("/api/analyze", { method: "POST", body: JSON.stringify(b) });
export const getAnalysis = (id: string) => j<Analysis>(`/api/analyze/${id}`);
export const healthFull = () => j<{ ok: boolean; providers: Provider[]; rea: boolean }>("/api/health").catch(() => null);

// ---------- VES (crear-estilo-edicion)
export type VesJob = { id: string; cmd: string; status: "running" | "done" | "error"; log: string[] };
export type VesProject = { name: string; style?: string; transcript: boolean; plan: boolean; beats: boolean; approved: boolean; files: string[] };
export type VesOverview = { installed: boolean; styles: { id: string; name: string; description: string }[]; projects: VesProject[] };
export const vesOverview = () => j<VesOverview>("/api/ves");
export const vesProject = (p: string) => j<VesProject>(`/api/ves/project/${p}`);
export const vesNewProject = (b: { name: string; mediaId: string; style: string }) => j<VesJob>("/api/ves/project", { method: "POST", body: JSON.stringify(b) });
export const vesRun = (b: { script: string; args: string[]; estilo?: string }) => j<VesJob>("/api/ves/run", { method: "POST", body: JSON.stringify(b) });
export const vesJob = (id: string) => j<VesJob>(`/api/ves/run/${id}`);
export const vesHuman = (b: { project: string; action: string; confirm: string }) => j<VesJob>("/api/ves/human", { method: "POST", body: JSON.stringify(b) });
export const vesConfirmPhrase = (action: string, project: string) => j<{ phrase: string }>(`/api/ves/confirm-phrase?action=${action}&project=${project}`);
export const vesFileUrl = (rel: string) => `${BASE}/ves-files/${rel.split("/").map(encodeURIComponent).join("/")}`;

// ---------- Unión de clips y recortes de silencio
export type MontajeJob = { id: string; status: "running" | "done" | "error"; step: string; progress: number; error?: string;
  clips: { name: string; before: number; after: number; cuts: number; fillers: number; keep: [number, number][] }[];
  master?: string; web?: string; masterMB?: number; webMB?: number };
export const startMontaje = (b: { clips: { mediaId: string; name: string }[]; ritmo: string; muletillas: boolean; formato: string }) =>
  j<MontajeJob>("/api/montaje", { method: "POST", body: JSON.stringify(b) });
export const getMontaje = (id: string) => j<MontajeJob>(`/api/montaje/${id}`);
export const abs = (path: string) => (path.startsWith("http") ? path : BASE + path);

// ---------- Plantillas de estilo → flujo automático
export type Plantilla = { id: string; name: string; description: string; motor: "ves" | "rapido"; vesStyle?: string; styleId?: string; preview?: string; ideal?: string; recomendada?: boolean };
export type FlujoJob = { id: string; project: string; plantilla: string; status: "running" | "review" | "error"; step: string; steps: string[]; current: number; log: string[]; error?: string; beats?: number; scenes?: number; project_status?: VesProject };
export type Beats = { title: string; beats: { id: string; start: number; end: number; script: string; seen: string; pick: "A" | "B" | "C"; opts: { title: string; ref?: string; type: string | null }[] }[] };
export const plantillas = () => j<Plantilla[]>("/api/plantillas");
export const startFlujo = (b: { montajeId: string; plantilla: string; provider: string }) => j<FlujoJob>("/api/flujo", { method: "POST", body: JSON.stringify(b) });
export const getFlujo = (id: string) => j<FlujoJob>(`/api/flujo/${id}`);
export const flujoPicks = (id: string, picks: string) => j<FlujoJob>(`/api/flujo/${id}/picks`, { method: "POST", body: JSON.stringify({ picks }) });
