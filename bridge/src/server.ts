// Bridge local: la web habla con él en http://localhost:8787. Sin él, la web sigue funcionando offline.
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { listStyles, getStyle, saveStyle, createJob, getJob, updateJob, listJobs } from "./store.js";
import { availableProviders, planEdit, type ProviderId } from "./providers/index.js";

const PORT = Number(process.env.KAIRO_PORT ?? 8787);

async function body(req: IncomingMessage) {
  let s = "";
  for await (const c of req) s += c;
  return s ? JSON.parse(s) : {};
}
function send(res: ServerResponse, code: number, data: unknown) {
  res.writeHead(code, {
    "content-type": "application/json",
    "access-control-allow-origin": "*",
    "access-control-allow-headers": "content-type",
    "access-control-allow-methods": "GET,POST,OPTIONS",
  });
  res.end(JSON.stringify(data));
}

createServer(async (req, res) => {
  try {
    if (req.method === "OPTIONS") return send(res, 204, null);
    const url = new URL(req.url ?? "/", "http://x");
    const p = url.pathname;

    if (p === "/api/health") return send(res, 200, { ok: true, providers: await availableProviders() });
    if (p === "/api/styles" && req.method === "GET") return send(res, 200, listStyles());
    if (p === "/api/styles" && req.method === "POST") return send(res, 200, saveStyle(await body(req)));

    // Plan directo con un proveedor (API o CLI de suscripción)
    if (p === "/api/plan" && req.method === "POST") {
      const b = await body(req);
      const style = getStyle(b.styleId);
      if (!style) return send(res, 404, { error: "Estilo no encontrado" });
      const plan = await planEdit(b.provider as ProviderId, { style, words: b.words, duration: b.duration, prompt: b.prompt ?? "" });
      return send(res, 200, { plan });
    }

    // Cola de trabajos: la web publica, y Claude Desktop / ChatGPT / Gemini (vía MCP) responden.
    if (p === "/api/jobs" && req.method === "POST") {
      const b = await body(req);
      return send(res, 200, createJob({ styleId: b.styleId, prompt: b.prompt ?? "", duration: b.duration, words: b.words }));
    }
    if (p === "/api/jobs" && req.method === "GET") return send(res, 200, listJobs().map(({ words, ...j }) => j));
    const m = p.match(/^\/api\/jobs\/([\w-]+)$/);
    if (m) {
      const job = getJob(m[1]);
      if (!job) return send(res, 404, { error: "No existe" });
      if (req.method === "POST") {
        const b = await body(req);
        updateJob({ ...job, plan: b.plan, plannedBy: b.plannedBy ?? "manual" });
      }
      return send(res, 200, getJob(m[1]));
    }
    send(res, 404, { error: "Ruta desconocida" });
  } catch (e) {
    send(res, 500, { error: (e as Error).message });
  }
}).listen(PORT, () => console.log(`Kairo bridge en http://localhost:${PORT}`));
