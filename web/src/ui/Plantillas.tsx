// Paso 2 y 3 del flujo: elegir la plantilla de estilo de edición y ver cómo se edita sola.
import { useEffect, useState } from "react";
import * as bridge from "../engine/bridge";
import { Icon } from "./Icon";

type Props = { montajeId: string; providers: bridge.Provider[] | null; onRapido: (styleId: string) => void };

export function Plantillas({ montajeId, providers, onRapido }: Props) {
  const [list, setList] = useState<bridge.Plantilla[]>([]);
  const [sel, setSel] = useState<string>("");
  const ready = (providers ?? []).filter((p) => p.ready);
  const [provider, setProvider] = useState("");
  const [flujo, setFlujo] = useState<bridge.FlujoJob | null>(null);
  const [beats, setBeats] = useState<bridge.Beats | null>(null);
  const [picks, setPicks] = useState("");
  const [human, setHuman] = useState<string>("");

  useEffect(() => { bridge.plantillas().then((l) => { setList(l); setSel(l.find((x) => x.recomendada)?.id ?? l[0]?.id ?? ""); }).catch(() => null); }, []);
  useEffect(() => { if (!provider && ready[0]) setProvider(ready[0].id); }, [providers]);

  async function poll(id: string) {
    let j = await bridge.getFlujo(id);
    setFlujo(j);
    while (j.status === "running") {
      await new Promise((r) => setTimeout(r, 1500));
      try { j = await bridge.getFlujo(id); setFlujo(j); } catch { /* el bridge está ocupado: se reintenta */ }
    }
    if (j.status === "review") setBeats(await fetch(bridge.vesFileUrl(`projects/${j.project}/beats.json`)).then((r) => r.json()).catch(() => null));
  }

  async function start() {
    const p = list.find((x) => x.id === sel);
    if (!p) return;
    if (p.motor === "rapido") return onRapido(p.styleId!);
    setBeats(null); setFlujo(null);
    try { const j = await bridge.startFlujo({ montajeId, plantilla: p.id, provider }); poll(j.id); }
    catch (e) { setFlujo({ id: "", project: "", plantilla: p.id, status: "error", step: "", steps: [], current: 0, log: [], error: (e as Error).message }); }
  }

  async function applyPicks() {
    if (!flujo) return;
    await bridge.flujoPicks(flujo.id, picks);
    setPicks(""); setBeats(null); poll(flujo.id);
  }

  // STOP 3: solo Santiago aprueba y pide el final (frase de confirmación)
  async function stop3(action: "approve" | "render" | "sound") {
    if (!flujo) return;
    const phrase = (await bridge.vesConfirmPhrase(action, flujo.project)).phrase;
    const typed = window.prompt(`STOP 3 · Revisa el borrador, el storyboard y la hoja de subtítulos.\nPara confirmar escribe:\n${phrase}`);
    if (!typed) return;
    setHuman(`${action}…`);
    try {
      let j = await bridge.vesHuman({ project: flujo.project, action, confirm: typed });
      while (j.status === "running") { await new Promise((r) => setTimeout(r, 1500)); j = await bridge.vesJob(j.id); }
      setHuman(j.status === "done" ? `${action} ✓` : `Error: ${j.log.slice(-2).join(" ")}`);
      setFlujo(await bridge.getFlujo(flujo.id));
    } catch (e) { setHuman((e as Error).message); }
  }

  const files = flujo?.project_status?.files ?? [];
  const f = (name: string) => files.find((x) => x.endsWith(name));
  const url = (rel?: string) => (rel ? bridge.vesFileUrl(rel) : "");
  const working = flujo?.status === "running";
  const chosen = list.find((x) => x.id === sel);

  return (
    <div className="plantillas">
      <h2><span className="m-step">2</span> Elige la plantilla de edición</h2>
      <div className="p-grid">
        {list.map((p) => (
          <button key={p.id} className={`p-card ${sel === p.id ? "on" : ""}`} disabled={working} onClick={() => setSel(p.id)}>
            <div className="p-img">{p.preview ? <img src={bridge.abs(`/plantilla-preview/${p.id}`)} alt="" /> : <span>{p.motor === "rapido" ? "👑" : "Aa"}</span>}</div>
            <b>{p.name}</b>
            <small>{p.description}</small>
            <em>Ideal: {p.ideal}</em>
            {p.recomendada && <i className="p-badge">Recomendada</i>}
          </button>
        ))}
      </div>
      <div className="p-go">
        {chosen?.motor === "ves" && (
          <label>Tu IA
            <select value={provider} onChange={(e) => setProvider(e.target.value)} disabled={working}>
              {ready.length ? ready.map((p) => <option key={p.id} value={p.id}>{p.label}</option>) : <option value="">Conecta una IA (Claude, ChatGPT o Gemini)</option>}
            </select>
          </label>
        )}
        <button className="btn primary big" disabled={!sel || working || (chosen?.motor === "ves" && !provider)} onClick={start}>
          <Icon name="spark" /> {chosen?.motor === "rapido" ? "Editar en el editor rápido" : "Editar con esta plantilla"}
        </button>
      </div>

      {flujo && (
        <section className="p-flow">
          <h2><span className="m-step">3</span> Edición {flujo.status === "review" ? "lista para revisar" : flujo.status === "error" ? "detenida" : "en curso"}</h2>
          <ol className="p-steps">
            {flujo.steps.map((s, i) => <li key={s} className={i < flujo.current ? "ok" : i === flujo.current && flujo.status === "running" ? "now" : ""}>{s}</li>)}
          </ol>
          {flujo.status === "error" && <p className="err">{flujo.error}</p>}

          {flujo.status === "review" && (
            <div className="p-review">
              <video src={url(f("BORRADOR_web.mp4"))} controls playsInline />
              <div className="p-side">
                <p className="hint">Borrador al 60–70 % (así lo dice el método). {flujo.beats} beats · {flujo.scenes} escenas elegidas por tu IA de la biblioteca de Arthur.</p>
                <div className="p-links">
                  <a href={url(f("storyboard.html"))} target="_blank" rel="noreferrer">Storyboard</a>
                  <a href={url(f("caption_sheet.jpg"))} target="_blank" rel="noreferrer">Hoja de subtítulos</a>
                  <a href={bridge.vesFileUrl(`projects/${flujo.project}/out/panel/index.html`)} target="_blank" rel="noreferrer">Panel de beats (A/B/C)</a>
                </div>
                {beats && (
                  <ol className="p-beats">
                    {beats.beats.map((b) => {
                      const o = b.opts["ABC".indexOf(b.pick)];
                      return <li key={b.id}><span>{b.start.toFixed(1)}s</span><b>{o?.title}</b><small>{b.script}</small><i>{o?.ref}</i></li>;
                    })}
                  </ol>
                )}
                <details>
                  <summary>Cambiar escenas con el panel</summary>
                  <p className="hint">Abre el panel, elige A/B/C en cada beat, pulsa «Copiar plan» y pégalo aquí.</p>
                  <textarea value={picks} onChange={(e) => setPicks(e.target.value)} placeholder='{"picks": {...}}' />
                  <button className="btn" disabled={!picks.trim()} onClick={applyPicks}>Aplicar cambios y rehacer el borrador</button>
                </details>
                <div className="p-stop3">
                  <b>⏸ STOP 3 · Tu aprobación</b>
                  <div className="row">
                    <button className="btn" onClick={() => stop3("approve")}>Aprobar</button>
                    <button className="btn primary" disabled={!flujo.project_status?.approved} onClick={() => stop3("render")}>Render final</button>
                    <button className="btn" disabled={!flujo.project_status?.approved} onClick={() => stop3("sound")}>Sonido final</button>
                  </div>
                  {human && <small>{human}</small>}
                  {f("master.mp4") && <a className="btn primary" href={url(f("master.mp4"))} download>Descargar video final</a>}
                </div>
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
