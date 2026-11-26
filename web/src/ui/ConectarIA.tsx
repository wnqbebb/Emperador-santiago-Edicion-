// Conectar tus IAs: suscripciones (Claude, ChatGPT/Codex, Gemini) sin claves de API, o claves en .env.
import { useEffect, useState } from "react";
import * as bridge from "../engine/bridge";

export function ConectarIA({ providers, onClose, onRefresh }: { providers: bridge.Provider[] | null; onClose: () => void; onRefresh: () => void }) {
  const [ayuda, setAyuda] = useState<bridge.AyudaCli>({});
  const [prueba, setPrueba] = useState<Record<string, { estado: "probando" | "ok" | "error"; msg?: string }>>({});
  useEffect(() => { bridge.ayudaProveedores().then(setAyuda).catch(() => null); }, []);
  async function probar(id: string) {
    setPrueba((p) => ({ ...p, [id]: { estado: "probando" } }));
    const r = await bridge.probarProveedor(id).catch((e) => ({ ok: false, error: (e as Error).message, ayuda: undefined }));
    setPrueba((p) => ({ ...p, [id]: { estado: r.ok ? "ok" : "error", msg: r.ok ? "Conectada y respondiendo ✓" : r.ayuda ?? r.error } }));
    onRefresh();
  }
  const copiar = (t: string) => navigator.clipboard?.writeText(t).catch(() => null);
  return (
    <div className="ia-modal" onClick={onClose}>
      <div className="ia-panel" onClick={(e) => e.stopPropagation()}>
        <header><h2>Conecta tus IAs</h2><button className="link" onClick={onClose}>Cerrar ✕</button></header>
        <p className="hint">Usa tus suscripciones (sin pagar API): instala el programa una vez, inicia sesión con tu cuenta y pulsa «Probar». Todo corre en tu computador.</p>
        <div className="ia-list">
          {(providers ?? []).map((p) => {
            const a = ayuda[p.id]; const pr = prueba[p.id];
            return (
              <div key={p.id} className={`ia-card ${p.ready ? "ready" : ""}`}>
                <div className="ia-top"><b>{p.label}</b><span className={`ia-dot ${pr?.estado === "ok" ? "ok" : p.ready ? "inst" : ""}`}>{pr?.estado === "ok" ? "Funcionando" : p.ready ? (a ? "Instalada" : "Lista") : a ? "No instalada" : "Sin clave"}</span></div>
                {a ? (
                  <>
                    <small>Plan: {a.plan}</small>
                    <ol>
                      <li>Instalar: <code onClick={() => copiar(a.instalar)} title="Copiar">{a.instalar}</code></li>
                      <li>Iniciar sesión: <code onClick={() => copiar(a.login)} title="Copiar">{a.login}</code> <small>{a.nota}</small></li>
                      <li>Reinicia la app (<code>npm run dev</code>) si acabas de instalarla, y pulsa Probar.</li>
                    </ol>
                    <button className="btn" disabled={!p.ready || pr?.estado === "probando"} onClick={() => probar(p.id)}>{pr?.estado === "probando" ? "Probando…" : "Probar"}</button>
                    {pr?.msg && <p className={pr.estado === "ok" ? "ok-msg" : "err"}>{pr.msg}</p>}
                  </>
                ) : (
                  <small>Pon tu clave en el archivo <code>.env</code> ({p.id === "claude-api" ? "ANTHROPIC_API_KEY" : p.id === "openai-api" ? "OPENAI_API_KEY" : "GEMINI_API_KEY"}=…) y reinicia.</small>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
