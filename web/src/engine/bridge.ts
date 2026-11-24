// Cliente del bridge local (IA + MCP). Si no responde, la app sigue en modo offline.
import type { Plan, Style, Word } from "./types";
const BASE = import.meta.env.VITE_KAIRO_BRIDGE ?? "http://localhost:8787";

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
