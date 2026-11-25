// Paso 2 y 3 de "Crear video": el sistema te PREGUNTA cómo quieres la edición, te muestra el tablero de preedición
// (beats A/B/C) para que dirijas, y luego construye el borrador. El final solo sale con tu aprobación.
import { useEffect, useState } from "react";
import * as bridge from "../engine/bridge";
import { Icon } from "./Icon";

type Props = { fuente: bridge.Fuente; providers: bridge.Provider[] | null; onRapido: (styleId: string) => void };
type Energia = "calma" | "media" | "viral";
type BrollItem = { file: File; desc: string };

export function Plantillas({ fuente, providers, onRapido }: Props) {
  const [familias, setFamilias] = useState<bridge.Familia[]>([]);
  const [fam, setFam] = useState("arthur");
  const [vari, setVari] = useState("arthur-talking");
  const [paleta, setPaleta] = useState<bridge.Paleta | null>(null);
  const [pal, setPal] = useState(0);
  const [energia, setEnergia] = useState<Energia>("viral");
  const [texturas, setTexturas] = useState(0.4);
  const [originales, setOriginales] = useState(true);
  const [broll, setBroll] = useState<BrollItem[]>([]);
  const [notas, setNotas] = useState("");
  const [fuentes, setFuentes] = useState("");
  const [rapido, setRapido] = useState(false);
  const ready = (providers ?? []).filter((p) => p.ready);
  const [provider, setProvider] = useState("");
  const [flujo, setFlujo] = useState<bridge.FlujoJob | null>(null);
  const [tab, setTab] = useState<bridge.Tablero | null>(null);
  const [picks, setPicks] = useState<Record<string, string>>({});
  const [human, setHuman] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => { bridge.familias().then(setFamilias).catch(() => null); }, []);
  useEffect(() => { bridge.paleta(fuente).then((p) => { setPaleta(p); setPal(Math.max(0, p.options.findIndex((o) => o.recommended))); }).catch(() => null); }, [fuente.montajeId, fuente.mediaId]);
  useEffect(() => { if (!provider && ready[0]) setProvider(ready[0].id); }, [providers]);

  const familia = familias.find((f) => f.id === fam);
  const variante = familia?.variantes.find((v) => v.id === vari) ?? familia?.variantes[0];
  // opciones de color: las del propio video y, si el estilo tiene firma (Kallaway), sus colores originales
  const estilo = familia?.paletaEstilo;
  const opciones: bridge.Paleta["options"] = [...(paleta?.options ?? []), ...(estilo ? [{ name: "Colores del estilo", from: familia!.name, colors: estilo, caption: estilo.highlight ?? estilo.vibrant_bright }] : [])];
  const color = opciones[pal];
  const links = fuentes.split(/\s+/).filter((u) => /^https?:\/\//.test(u));
  const working = flujo?.status === "running" || sending;

  async function poll(id: string) {
    let j = await bridge.getFlujo(id);
    setFlujo(j);
    while (j.status === "running") {
      await new Promise((r) => setTimeout(r, 1500));
      try { j = await bridge.getFlujo(id); setFlujo(j); } catch { /* reintenta */ }
    }
    if (j.status === "tablero" || j.status === "review") {
      const t = await bridge.tablero(id).catch(() => null);
      setTab(t);
      if (t) setPicks(Object.fromEntries(t.beats.beats.map((b) => [b.id, b.pick])));
    }
  }

  async function start() {
    if (!familia || !variante) return;
    if (familia.motor === "rapido") return onRapido(variante.styleId!);
    setSending(true); setTab(null); setFlujo(null);
    try {
      const up = [];
      for (const b of broll) up.push({ mediaId: (await bridge.uploadMedia(b.file)).mediaId, desc: b.desc || b.file.name });
      const j = await bridge.startFlujo({ ...fuente, plantilla: variante.id, provider, broll: up,
        respuestas: { energia, texturas: familia.texturas === false ? 0 : texturas, palette: color?.colors, originales, rapido, notas, fuentes: familia.preguntaFuentes ? links : undefined } });
      setSending(false);
      poll(j.id);
    } catch (e) {
      setSending(false);
      setFlujo({ id: "", project: "", plantilla: variante.id, status: "error", step: "", steps: [], current: 0, log: [], error: (e as Error).message });
    }
  }

  async function construir() { if (!flujo) return; await bridge.elegir(flujo.id, picks); setTab(null); poll(flujo.id); }
  async function otraPropuesta() { if (!flujo) return; await bridge.replan(flujo.id, { energia, texturas, originales, notas }); setTab(null); poll(flujo.id); }

  async function stop3(action: "approve" | "render" | "sound") {
    if (!flujo) return;
    const phrase = (await bridge.vesConfirmPhrase(action, flujo.project)).phrase;
    const typed = window.prompt(`STOP 3 · Revisa el borrador, el storyboard y la hoja de subtítulos.\nPara confirmar escribe:\n${phrase}`);
    if (!typed) return;
    setHuman(`${action}…`);
    try {
      let j = await bridge.vesHuman({ project: flujo.project, action, confirm: typed, skill: flujo.skill });
      while (j.status === "running") { await new Promise((r) => setTimeout(r, 1500)); j = await bridge.vesJob(j.id); }
      setHuman(j.status === "done" ? `${action} ✓` : `Error: ${j.log.slice(-2).join(" ")}`);
      setFlujo(await bridge.getFlujo(flujo.id));
    } catch (e) { setHuman((e as Error).message); }
  }

  const files = flujo?.project_status?.files ?? [];
  const f = (name: string) => files.find((x) => x.endsWith(name));
  const url = (rel?: string) => (rel ? bridge.vesFileUrl(rel, flujo?.skill) : "");
  const started = !!flujo;

  return (
    <div className="plantillas">
      <h2><span className="m-step">2</span> ¿Cómo quieres editarlo? <small className="h-sub">te pregunto antes de editar</small></h2>

      {/* 1 · Estilo y variante */}
      <div className="q">
        <h4>1 · Estilo de edición</h4>
        <div className="fam-row">
          {familias.map((fa) => (
            <button key={fa.id} className={`fam ${fam === fa.id ? "on" : ""}`} disabled={started} onClick={() => { setFam(fa.id); setVari(fa.variantes.find((v) => v.recomendada)?.id ?? fa.variantes[0].id); }}>
              <b>{fa.name}</b><small>{fa.description}</small>
            </button>
          ))}
        </div>
        {familia && familia.variantes.length > 1 && (
          <div className="p-grid">
            {familia.variantes.map((v) => (
              <button key={v.id} className={`p-card ${variante?.id === v.id ? "on" : ""}`} disabled={started} onClick={() => setVari(v.id)}>
                <div className="p-img">{v.preview ? <img src={bridge.abs(`/plantilla-preview/${v.id}`)} alt="" /> : <span>Aa</span>}</div>
                <b>{v.name}</b><small>{v.description}</small><em>Ideal: {v.ideal}</em>
                {v.recomendada && <i className="p-badge">Recomendada</i>}
              </button>
            ))}
          </div>
        )}
      </div>

      {familia?.motor === "ves" && (
        <>
          {/* 2 · Color sacado del video */}
          <div className="q">
            <h4>2 · Color de la edición <small>sacado de tu propio video: elige el que más resalte</small></h4>
            {!paleta && <p className="hint">Analizando los colores del video…</p>}
            {paleta && color && (
              <div className="pal">
                <div className="pal-preview">
                  <div className="frame" style={{ backgroundImage: `url(${bridge.abs(paleta.frame)})` }}>
                    <div className="cap"><small>así se ve tu</small><b style={{ color: color.caption }}>palabra clave</b><small>sobre el video</small></div>
                  </div>
                  <div className="card" style={{ background: color.colors.dull_white }}><small style={{ color: color.colors.dull_black }}>escena en</small><b style={{ color: color.colors.vibrant_bright }}>papel claro</b></div>
                  <div className="card" style={{ background: color.colors.vibrant_bright }}><small style={{ color: "#fff" }}>escena en</small><b style={{ color: "#fff" }}>color pleno</b></div>
                </div>
                <div className="pal-list">
                  {opciones.map((o, i) => (
                    <button key={i} className={pal === i ? "on" : ""} disabled={started} onClick={() => setPal(i)}>
                      <span className="sw">{(["vibrant_bright", "vibrant_dark", "dull_white", "dull_black"] as const).map((k) => <i key={k} style={{ background: o.colors[k] }} />)}</span>
                      <b>{o.name}{o.recommended ? " · recomendado" : ""}</b><small>De {o.from}</small>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 3 · Energía, texturas, originales */}
          <div className="q q-row">
            <div>
              <h4>3 · Energía</h4>
              <div className="seg">
                {([["calma", "Calma", "Respira, elegante"], ["media", "Media", "Cambio cada 2–3 s"], ["viral", "Viral", "Gancho y cambio cada 1–2 s"]] as const).map(([id, l, s]) => (
                  <button key={id} className={energia === id ? "on" : ""} disabled={started} onClick={() => setEnergia(id)}><b>{l}</b><small>{s}</small></button>
                ))}
              </div>
            </div>
            {familia.texturas !== false && <div>
              <h4>4 · Texturas</h4>
              <div className="seg">
                {([[0, "Limpio", "Colores sólidos"], [0.4, "Suaves", "Un toque de papel"], [1, "Como Arthur", "Papel y tela marcados"]] as const).map(([v, l, s]) => (
                  <button key={v} className={texturas === v ? "on" : ""} disabled={started} onClick={() => setTexturas(v)}><b>{l}</b><small>{s}</small></button>
                ))}
              </div>
            </div>}
            <div>
              <h4>5 · Creatividad</h4>
              <label className="toggle">
                <input type="checkbox" checked={originales} disabled={started} onChange={(e) => setOriginales(e.target.checked)} />
                <span><b>Motion graphics originales</b><small>En 2–3 momentos clave, animaciones nuevas inspiradas en el estilo (no copias). Más lento.</small></span>
              </label>
            </div>
          </div>

          {/* 6 · B-roll y notas */}
          <div className="q q-row">
            <div>
              <h4>6 · ¿Tienes b-roll o imágenes?</h4>
              <label className="m-drop small">
                <input type="file" accept="video/*,image/*" multiple hidden disabled={started} onChange={(e) => e.target.files && setBroll((c) => [...c, ...[...e.target.files!].map((file) => ({ file, desc: "" }))])} />
                <Icon name="upload" /><div><strong>Subir b-roll</strong><small>Si no tienes, la IA te dará la lista de assets con sus prompts.</small></div>
              </label>
              {broll.map((b, i) => (
                <div key={i} className="broll-row"><span>{b.file.name}</span>
                  <input placeholder="¿Qué se ve? (ej. prenda colgada en gancho)" value={b.desc} disabled={started} onChange={(e) => setBroll((c) => c.map((x, k) => (k === i ? { ...x, desc: e.target.value } : x)))} />
                  <button className="link" disabled={started} onClick={() => setBroll((c) => c.filter((_, k) => k !== i))}>✕</button></div>
              ))}
            </div>
            <div>
              <h4>7 · Indicaciones para el editor <small>(opcional)</small></h4>
              <textarea placeholder="Ej: que el gancho sea «tres fotos», resalta las prendas, cierre con la palabra FOTOS en grande…" value={notas} disabled={started} onChange={(e) => setNotas(e.target.value)} />
              {familia.preguntaFuentes && (
                <>
                  <h4>8 · Fuentes y pruebas <small>enlaces de la noticia, el producto o el post (uno por línea)</small></h4>
                  <textarea className="fuentes" placeholder={"https://… (el titular)\nhttps://… (la página del producto)"} value={fuentes} disabled={started} onChange={(e) => setFuentes(e.target.value)} />
                  <p className="hint">{links.length ? `${links.length} enlace(s): se capturan de verdad y van arriba, con el dato resaltado.` : "Sin enlaces: usará gráficos en código, tu b-roll y te pedirá las capturas que falten."}</p>
                </>
              )}
            </div>
          </div>

          <div className="p-go">
            <label>Tu IA
              <select value={provider} onChange={(e) => setProvider(e.target.value)} disabled={started}>
                {ready.length ? ready.map((p) => <option key={p.id} value={p.id}>{p.label}</option>) : <option value="">Conecta una IA (Claude, ChatGPT o Gemini)</option>}
              </select>
            </label>
            <label className="toggle mini">
              <input type="checkbox" checked={rapido} disabled={started} onChange={(e) => setRapido(e.target.checked)} />
              <span><b>Sin tablero</b><small>usar las recomendaciones directo</small></span>
            </label>
            <button className="btn primary big" disabled={!variante || working || started || !provider} onClick={start}>
              <Icon name="spark" /> {sending ? "Subiendo b-roll…" : "Empezar edición"}
            </button>
          </div>
        </>
      )}
      {familia?.motor === "rapido" && (
        <div className="p-go"><button className="btn primary big" onClick={start}><Icon name="spark" /> Editar en el editor rápido</button></div>
      )}

      {flujo && (
        <section className="p-flow">
          <h2><span className="m-step">3</span> {flujo.status === "tablero" ? "Tablero de preedición: tú diriges" : flujo.status === "review" ? "Borrador listo para revisar" : flujo.status === "error" ? "Edición detenida" : "Editando…"}</h2>
          <ol className="p-steps">
            {flujo.steps.map((s, i) => <li key={s} className={i < flujo.current ? "ok" : i === flujo.current && flujo.status !== "error" ? "now" : ""}>{s}</li>)}
          </ol>
          {flujo.status === "error" && (
            <div className="row">
              <p className="err">{flujo.error}</p>
              <button className="btn" onClick={() => (tab || flujo.beats ? construir() : otraPropuesta())}>Reintentar</button>
            </div>
          )}

          {flujo.status === "tablero" && tab && (
            <div className="board">
              <p className="hint">Tu IA propuso {tab.beats.beats.length} beats. En cada uno elige A, B o C (marcada la recomendada). ✦ = motion graphic original · 📎 = necesita un asset.</p>
              {tab.beats.beats.map((b) => (
                <div key={b.id} className="beat">
                  <div className="beat-head"><span>{b.start.toFixed(1)}–{b.end.toFixed(1)} s</span><b>«{b.script}»</b><small>{b.seen}</small></div>
                  <div className="opts">
                    {b.opts.map((o, k) => {
                      const L = "ABC"[k];
                      const media = (o.props as { media?: string } | undefined)?.media;
                      return (
                        <button key={k} className={`opt ${picks[b.id] === L ? "on" : ""}`} onClick={() => setPicks((p) => ({ ...p, [b.id]: L }))}>
                          <div className="thumb">{o.scenes ? (o.scenes.some((x) => x.props?.top?.original) ? <span>✦<small>original</small></span> : !o.scenes.length || o.scenes.every((x) => x.type === "k_word") ? <img src={bridge.cuadroUrl(flujo.id, (b.start + b.end) / 2)} alt="" /> : tab.thumbs[o.ref ?? ""] ? <img src={tab.thumbs[o.ref ?? ""]} alt="" /> : <span>Aa</span>) : o.type === "mg_original" ? <span>✦<small>original</small></span> : o.type === null || o.type === "aroll" ? <img src={bridge.cuadroUrl(flujo.id, (b.start + b.end) / 2)} alt="" /> : tab.thumbs[o.ref ?? ""] ? <img src={tab.thumbs[o.ref ?? ""]} alt="" /> : <span>Aa</span>}</div>
                          <div className="opt-txt"><div><i>{L}</i> <b>{o.title}</b>{o.type === "mg_original" && <em> ✦ original</em>}{media && String(media).includes("assets/") && <em> 📎 asset</em>}{o.scenes?.some((x) => x.props?.top?.original) && <em> ✦ original</em>}{o.scenes?.some((x) => x.props?.top?.placeholder && !x.props?.top?.media?.length && !x.props?.top?.original) && <em> 📎 asset</em>}{o.scenes?.some((x) => x.props?.top?.media?.some((m) => m.includes("evidence/"))) && <em> 🔎 prueba</em>}</div>
                          {o.scenes && o.scenes.length > 0 && <small className="ref">{o.scenes.length} escena(s): {[...new Set(o.scenes.map((x) => x.type === "k_split" ? `arriba ${x.props?.top?.kind ?? "media"}` : x.type === "k_pip" ? "pantalla completa + cara" : x.type === "k_hook" ? "franja gancho" : "palabra gigante"))].join(" · ")}</small>}
                          <small>{o.desc || o.cats}</small>
                          {o.ref && o.type !== "mg_original" && <small className="ref">inspirado en {o.ref}</small>}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
              {tab.beats.assets?.length ? (
                <details>
                  <summary>📎 {tab.beats.assets.length} assets que piden las opciones B/C · prompts en 7 bloques</summary>
                  <div className="assets">{tab.beats.assets.map((a) => <AssetCard key={a.id} a={a} />)}</div>
                </details>
              ) : null}
              <div className="row">
                <button className="btn ghost" onClick={otraPropuesta}>Pedir otra propuesta</button>
                <button className="btn primary" onClick={construir}><Icon name="bolt" /> Construir el borrador con estas elecciones</button>
              </div>
            </div>
          )}

          {flujo.status === "review" && (
            <div className="p-review">
              <video src={url(f("BORRADOR_web.mp4"))} controls playsInline />
              <div className="p-side">
                <p className="hint">Borrador al 60–70 % (así dice el método). {flujo.scenes} escenas{flujo.originales ? ` · ${flujo.originales} motion graphics originales` : ""}.</p>
                <div className="p-links">
                  <a href={url(f("storyboard.html"))} target="_blank" rel="noreferrer">Storyboard</a>
                  <a href={url(f("caption_sheet.jpg"))} target="_blank" rel="noreferrer">Hoja de subtítulos</a>
                  {f(`ASSETS_${flujo.project}.md`) && <a href={url(f(`ASSETS_${flujo.project}.md`))} target="_blank" rel="noreferrer">Assets que faltan ({flujo.assets})</a>}
                </div>
                {tab?.beats.assets?.length ? (
                  <details open>
                    <summary>📎 Assets para generar ({tab.beats.assets.length}) · prompts profesionales en 7 bloques</summary>
                    <p className="hint">Genera primero el que dice HERO (los demás lo usan de referencia). Entrega todo en un zip con estos nombres de archivo.</p>
                    <div className="assets">{tab.beats.assets.map((a) => <AssetCard key={a.id} a={a} />)}</div>
                  </details>
                ) : null}
                <button className="btn ghost" onClick={() => setFlujo({ ...flujo, status: "tablero" })}>Volver al tablero y cambiar escenas</button>
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

const BLOQUES: [keyof NonNullable<bridge.Asset["bloques"]>, string][] = [
  ["referencias", "1 · Referencias"], ["contexto", "2 · Contexto"], ["mapa_espacial", "3 · Mapa espacial"], ["accion", "4 · Acción"],
  ["camara", "5 · Cámara"], ["luz_textura", "6 · Luz y textura"], ["bloqueos", "7 · Bloqueos"],
];
function AssetCard({ a }: { a: bridge.Asset }) {
  const copy = (t?: string) => t && navigator.clipboard?.writeText(t);
  return (
    <div className="asset-card">
      <div className="asset-head">
        <b>{a.id} · {a.name}</b>{a.is_ref && <span className="hero">HERO · primero</span>}
        <small>{a.kind} · {a.ar} · {a.resolucion ?? ""}{a.duracion ? ` · ${a.duracion}` : ""}{a.en_pantalla ? ` · ${a.en_pantalla}` : ""}</small>
      </div>
      {a.resumen && <p className="asset-sum">{a.resumen}</p>}
      <div className="asset-meta">
        {a.modelo && <span><em>Modelo</em>{a.modelo}</span>}
        {a.referencia && <span><em>Referencia</em>{a.referencia}</span>}
        {a.archivo && <span><em>Archivo</em><code>{a.archivo}</code></span>}
      </div>
      {a.bloques && (
        <dl className="bloques">{BLOQUES.map(([k, l]) => a.bloques?.[k] ? (<div key={k}><dt>{l}</dt><dd>{a.bloques[k]}</dd></div>) : null)}</dl>
      )}
      <div className="asset-prompt"><em>Prompt completo</em><p>{a.prompt}</p></div>
      {a.negative && <div className="asset-prompt neg"><em>Negativo</em><p>{a.negative}</p></div>}
      <div className="row">
        <button className="btn" onClick={() => copy(a.prompt)}>Copiar prompt</button>
        {a.negative && <button className="btn ghost" onClick={() => copy(a.negative)}>Copiar negativo</button>}
        <button className="btn ghost" onClick={() => copy(`${a.prompt}\n\nNegative: ${a.negative ?? ""}\nAspect ratio: ${a.ar} · ${a.resolucion ?? ""}${a.duracion ? ` · ${a.duracion}` : ""}\nFile: ${a.archivo ?? ""}`)}>Copiar todo</button>
      </div>
    </div>
  );
}
