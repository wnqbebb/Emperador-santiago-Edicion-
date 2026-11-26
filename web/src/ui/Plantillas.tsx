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
  // estilos con colores de firma (Nick, Lobo): arrancan con sus colores; los demás con el color recomendado del video
  useEffect(() => {
    if (familia?.paletaPorDefecto === "estilo" && estilo) setPal((paleta?.options.length ?? 0));
    else if (paleta) setPal(Math.max(0, paleta.options.findIndex((o) => o.recommended)));
  }, [fam, paleta]);
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

  async function construir() {
    if (!flujo) return;
    const faltan = (await bridge.tablero(flujo.id).catch(() => null))?.faltan ?? [];
    if (faltan.length && !window.confirm(`Faltan ${faltan.length} assets (${faltan.join(", ")}).\n¿Construir igual? Saldrá un marcador en su lugar y podrás subirlos después.`)) return;
    await bridge.elegir(flujo.id, picks); setTab(null); poll(flujo.id);
  }
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
  const reel = flujo?.motor === "reels";
  const sky = flujo?.motor === "skylight" || reel;
  const url = (rel?: string) => (rel ? (reel ? bridge.reelFileUrl(flujo!.project, rel) : sky ? bridge.skyFileUrl(flujo!.project, rel) : bridge.vesFileUrl(rel, flujo?.skill)) : "");
  const started = !!flujo;

  return (
    <div className="plantillas">
      <h2><span className="m-step">2</span> ¿Cómo quieres editarlo? <small className="h-sub">te pregunto antes de editar</small></h2>

      {/* 1 · Estilo: galería visual (todas las variantes de todas las skills) */}
      <Galeria familias={familias} fam={fam} vari={variante?.id} disabled={started}
        onPick={(f, v) => { setFam(f); setVari(v); }} />

      {familia && familia.motor !== "rapido" && (
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
            {familia.originales !== false && <div>
              <h4>5 · Creatividad</h4>
              <label className="toggle">
                <input type="checkbox" checked={originales} disabled={started} onChange={(e) => setOriginales(e.target.checked)} />
                <span><b>Motion graphics originales</b><small>En 2–3 momentos clave, animaciones nuevas inspiradas en el estilo (no copias). Más lento.</small></span>
              </label>
            </div>}
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
              <BriefCard brief={tab.beats.brief} title={tab.beats.title} />
              <DireccionBox flujo={flujo} onDone={async () => { const j = await bridge.getFlujo(flujo.id); setFlujo(j); const t = await bridge.tablero(flujo.id); setTab(t); setPicks(Object.fromEntries(t.beats.beats.map((b) => [b.id, b.pick]))); }} />
              <p className="hint">Tu IA propuso {tab.beats.beats.length} beats. En cada uno elige A, B o C (marcada la recomendada). ✦ = motion graphic original · 📎 = necesita un asset.</p>
              {tab.beats.beats.map((b) => (
                <div key={b.id} className="beat">
                  <div className="beat-head"><span>{b.start.toFixed(1)}–{b.end.toFixed(1)} s</span>{(b as { rol?: string }).rol && <em className="rol">{(b as { rol?: string }).rol}</em>}<b>«{b.script}»</b><small>{b.seen}</small></div>
                  <div className="opts">
                    {b.opts.map((o, k) => {
                      const L = "ABC"[k];
                      const media = (o.props as { media?: string } | undefined)?.media;
                      return (
                        <button key={k} className={`opt ${picks[b.id] === L ? "on" : ""}`} onClick={() => setPicks((p) => ({ ...p, [b.id]: L }))}>
                          <div className="thumb">{o.layout ? (o.layout === "cara" && !o.grafico ? <img src={bridge.cuadroUrl(flujo.id, (b.start + b.end) / 2)} alt="" /> : <span className="sky-ico">{REEL_ICON[o.layout] ?? "▦"}<small>{o.layout === "grande" ? (o.palabra ?? "").toUpperCase() : REEL_NAME[o.layout]}</small></span>) : sky && o.scenes ? (o.scenes.every((x) => x.type === "aroll") ? <img src={bridge.cuadroUrl(flujo.id, (b.start + b.end) / 2)} alt="" /> : <span className="sky-ico">{SKY_ICON[o.scenes.find((x) => x.type !== "aroll")!.type] ?? "▦"}<small>{SKY_NAME[o.scenes.find((x) => x.type !== "aroll")!.type]}</small></span>) : o.scenes ? (o.scenes.some((x) => x.props?.top?.original) ? <span>✦<small>original</small></span> : !o.scenes.length || o.scenes.every((x) => x.type === "k_word") ? <img src={bridge.cuadroUrl(flujo.id, (b.start + b.end) / 2)} alt="" /> : tab.thumbs[o.ref ?? ""] ? <img src={tab.thumbs[o.ref ?? ""]} alt="" /> : <span>Aa</span>) : o.type === "mg_original" ? <span>✦<small>original</small></span> : o.type === null || o.type === "aroll" ? <img src={bridge.cuadroUrl(flujo.id, (b.start + b.end) / 2)} alt="" /> : tab.thumbs[o.ref ?? ""] ? <img src={tab.thumbs[o.ref ?? ""]} alt="" /> : <span>Aa</span>}</div>
                          <div className="opt-txt"><div><i>{L}</i> <b>{o.title}</b>{o.type === "mg_original" && <em> ✦ original</em>}{media && String(media).includes("assets/") && <em> 📎 asset</em>}{o.scenes?.some((x) => x.props?.top?.original) && <em> ✦ original</em>}{o.scenes?.some((x) => x.props?.top?.placeholder && !x.props?.top?.media?.length && !x.props?.top?.original) && <em> 📎 asset</em>}{o.scenes?.some((x) => x.props?.top?.media?.some((m) => m.includes("evidence/"))) && <em> 🔎 prueba</em>}</div>
                          {o.scenes && o.scenes.length > 0 && <small className="ref">{o.scenes.length} escena(s): {[...new Set(o.scenes.map((x) => SKY_NAME[x.type] ? (x.type === "world" ? `mundo ${x.plate ?? ""}`.trim() : SKY_NAME[x.type]) : x.type === "k_split" ? `arriba ${x.props?.top?.kind ?? "media"}` : x.type === "k_pip" ? "pantalla completa + cara" : x.type === "k_hook" ? "franja gancho" : "palabra gigante"))].join(" · ")}</small>}
                          <small>{o.desc || o.cats}</small>
                          {o.ref && o.type !== "mg_original" && <small className="ref">inspirado en {o.ref}</small>}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
              <PromptBox flujo={flujo} onDone={async () => { setTab(await bridge.tablero(flujo.id)); setFlujo(await bridge.getFlujo(flujo.id)); }} />
              {tab.beats.assets?.length ? (
                <div className="paso-assets">
                  <h4>📎 Paso de assets <small>genera cada uno con su prompt y súbelo: ESOS archivos son los que se montan</small></h4>
                  <p className="hint">{tab.faltan?.length ? `Faltan ${tab.faltan.length} que usan las opciones elegidas: ${tab.faltan.join(", ")}.` : "✓ Están todos los assets que usan las opciones elegidas."} Genera primero el que dice HERO.</p>
                  <div className="assets">{tab.beats.assets.map((a) => <AssetCard key={a.id} a={a} subir={async (f) => { await bridge.subirAsset(flujo.id, a.id, f); setTab(await bridge.tablero(flujo.id)); }} />)}</div>
                </div>
              ) : null}
              <div className="row">
                <button className="btn ghost" onClick={otraPropuesta}>Pedir otra propuesta</button>
                <button className="btn primary" onClick={construir}><Icon name="bolt" /> Construir el borrador con estas elecciones</button>
              </div>
            </div>
          )}

          {flujo.status === "review" && (
            <div className="p-review">
              <video src={url(sky ? f(`${flujo.project}.mp4`) : f("BORRADOR_web.mp4"))} controls playsInline />
              <div className="p-side">
                <p className="hint">Borrador al 60–70 % (así dice el método). {flujo.scenes} escenas{flujo.originales ? ` · ${flujo.originales} motion graphics originales` : ""}.</p>
                {reel ? (
                <div className="p-links">
                  {f("hoja.jpg") && <a href={url(f("hoja.jpg"))} target="_blank" rel="noreferrer">Hoja de cuadros (1 por segundo)</a>}
                  {f(`${flujo.project}.mp4`) && <a href={url(f(`${flujo.project}.mp4`))} download>Descargar el video</a>}
                </div>) : sky ? (
                <div className="p-links">
                  <a href={url(f("plan.html"))} target="_blank" rel="noreferrer">Plan línea a línea</a>
                  {f("IMAGE_CREDITS.md") && <a href={url(f("IMAGE_CREDITS.md"))} target="_blank" rel="noreferrer">Créditos de imágenes (ponlos en la descripción)</a>}
                  {f(`${flujo.project}.mp4`) && <a href={url(f(`${flujo.project}.mp4`))} download>Descargar el video</a>}
                </div>) : (
                <div className="p-links">
                  <a href={url(f("storyboard.html"))} target="_blank" rel="noreferrer">Storyboard</a>
                  <a href={url(f("caption_sheet.jpg"))} target="_blank" rel="noreferrer">Hoja de subtítulos</a>
                  {f(`ASSETS_${flujo.project}.md`) && <a href={url(f(`ASSETS_${flujo.project}.md`))} target="_blank" rel="noreferrer">Assets que faltan ({flujo.assets})</a>}
                </div>)}
                {flujo.revision && <KatanaCard rev={flujo.revision} />}
                <EfectosBox flujo={flujo} url={url} onDone={async () => setFlujo(await bridge.getFlujo(flujo.id))} />
                <PromptBox flujo={flujo} onDone={async () => { setTab(await bridge.tablero(flujo.id)); setFlujo(await bridge.getFlujo(flujo.id)); }} />
                {tab?.beats.assets?.length ? (
                  <details open>
                    <summary>📎 Assets para generar ({tab.beats.assets.length}) · prompts profesionales en 7 bloques</summary>
                    <p className="hint">Genera primero el que dice HERO (los demás lo usan de referencia) y súbelo aquí. Luego «Volver al tablero» → «Construir» para montarlos.</p>
                    <div className="assets">{tab.beats.assets.map((a) => <AssetCard key={a.id} a={a} subir={async (f) => { await bridge.subirAsset(flujo.id, a.id, f); setTab(await bridge.tablero(flujo.id)); }} />)}</div>
                  </details>
                ) : null}
                <button className="btn ghost" onClick={() => setFlujo({ ...flujo, status: "tablero" })}>Volver al tablero y cambiar escenas</button>
                {!sky && <div className="p-stop3">
                  <b>⏸ STOP 3 · Tu aprobación</b>
                  <div className="row">
                    <button className="btn" onClick={() => stop3("approve")}>Aprobar</button>
                    <button className="btn primary" disabled={!flujo.project_status?.approved} onClick={() => stop3("render")}>Render final</button>
                    <button className="btn" disabled={!flujo.project_status?.approved} onClick={() => stop3("sound")}>Sonido final</button>
                  </div>
                  {human && <small>{human}</small>}
                  {f("master.mp4") && <a className="btn primary" href={url(f("master.mp4"))} download>Descargar video final</a>}
                </div>}
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

/** Galería de estilos tipo Captions: tarjetas 9:16 que se mueven al pasar el ratón, filtros por familia y vista previa grande. */
function Galeria({ familias, fam, vari, disabled, onPick }: { familias: bridge.Familia[]; fam: string; vari?: string; disabled: boolean; onPick: (fam: string, vari: string) => void }) {
  const [filtro, setFiltro] = useState("todos");
  const [q, setQ] = useState("");
  const [ver, setVer] = useState<{ f: bridge.Familia; v: bridge.Variante } | null>(null);
  const todas = familias.flatMap((f) => f.variantes.map((v) => ({ f, v })));
  const lista = todas.filter(({ f, v }) => (filtro === "todos" || f.id === filtro) && (!q || `${f.name} ${v.name} ${v.ideal ?? ""} ${v.description}`.toLowerCase().includes(q.toLowerCase())));
  const elegida = todas.find(({ v }) => v.id === vari);
  return (
    <div className="galeria">
      <div className="gal-head">
        <div><h4>1 · Elige el estilo de edición</h4><small>Pasa el ratón para verlo en movimiento · clic para la vista previa</small></div>
        <input className="gal-search" placeholder="Buscar estilos…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="gal-chips">
        <button className={filtro === "todos" ? "on" : ""} onClick={() => setFiltro("todos")}>Todos <i>{todas.length}</i></button>
        {familias.map((f) => <button key={f.id} className={filtro === f.id ? "on" : ""} onClick={() => setFiltro(f.id)}>{f.name} <i>{f.variantes.length}</i></button>)}
      </div>
      <div className="gal-grid">
        {lista.map(({ f, v }) => (
          <button key={v.id} className={`gal-card ${vari === v.id ? "on" : ""}`} disabled={disabled} onClick={() => setVer({ f, v })}
            onMouseEnter={(e) => e.currentTarget.querySelector("video")?.play().catch(() => null)}
            onMouseLeave={(e) => { const vd = e.currentTarget.querySelector("video"); if (vd && vari !== v.id) { vd.pause(); vd.currentTime = 0; } }}>
            <video src={`/estilos/${v.id}.mp4`} poster={`/estilos/${v.id}.jpg`} muted loop playsInline preload="none" autoPlay={vari === v.id} />
            {v.recomendada && <span className="gal-badge">Recomendada</span>}
            {vari === v.id && <span className="gal-check">✓</span>}
            <div className="gal-label"><b>{v.name}</b><small>{f.name}</small></div>
          </button>
        ))}
      </div>
      {elegida && <p className="gal-sel">Estilo elegido: <b>{elegida.f.name} · {elegida.v.name}</b> — {elegida.v.description}</p>}
      {ver && (
        <div className="gal-modal" onClick={() => setVer(null)}>
          <div className="gal-sheet" onClick={(e) => e.stopPropagation()}>
            <video src={`/estilos/${ver.v.id}.mp4`} poster={`/estilos/${ver.v.id}.jpg`} muted loop playsInline autoPlay />
            <div className="gal-info">
              <small className="gal-fam">{ver.f.name}</small>
              <h3>{ver.v.name}</h3>
              <p>{ver.v.description}</p>
              {ver.v.ideal && <p className="gal-ideal"><b>Ideal para:</b> {ver.v.ideal}</p>}
              <p className="gal-desc">{ver.f.description}</p>
              <p className="hint">La vista previa está hecha con tu propio clip: así se ve tu video en este estilo.</p>
              <div className="row">
                <button className="btn primary big" onClick={() => { onPick(ver.f.id, ver.v.id); setVer(null); }}>Usar este estilo</button>
                <button className="btn ghost" onClick={() => setVer(null)}>Seguir viendo</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const REEL_ICON: Record<string, string> = { cara: "◉", split: "◧", grande: "A", negro: "■" };
const REEL_NAME: Record<string, string> = { cara: "cara + gráfico", split: "dividido", grande: "palabra grande", negro: "corte a negro" };
const SKY_ICON: Record<string, string> = { world: "☁", broll: "🎞", bars: "▮▮", line: "↗", orbs: "●●", days: "▦", duo: "◐", still: "▣" };
const SKY_NAME: Record<string, string> = { aroll: "cara", world: "mundo", broll: "b-roll con trazos", bars: "barras", line: "línea", orbs: "orbes", days: "casillas", duo: "recorte + logos", still: "imagen" };

/** El brief: lo que se va a hacer, en pantalla ANTES de renderizar. */
function BriefCard({ brief, title }: { brief?: bridge.Brief; title: string }) {
  if (!brief) return <div className="brief"><h4>📋 Brief · {title}</h4><p className="hint">Revisa el plan beat a beat abajo antes de construir.</p></div>;
  return (
    <div className="brief">
      <h4>📋 Brief · {title}</h4>
      <div className="brief-grid">
        {brief.idea && <div><em>Idea</em><p>{brief.idea}</p></div>}
        {brief.gancho && <div><em>Gancho</em><p>{brief.gancho}</p></div>}
        {brief.estilo && <div><em>Estilo</em><p>{brief.estilo}</p></div>}
        {brief.material && <div><em>Material que debes generar</em><p>{brief.material}</p></div>}
        {brief.personas && <div className="warn"><em>Personas o cosas reales</em><p>{brief.personas}</p></div>}
      </div>
      {brief.estructura?.length ? <ol className="brief-est">{brief.estructura.map((x, i) => <li key={i}>{x}</li>)}</ol> : null}
    </div>
  );
}

/** Dirección: lo que Santiago le dice al editor; reescribe el plan antes de construir. */
function DireccionBox({ flujo, onDone }: { flujo: bridge.FlujoJob; onDone: () => void }) {
  const [texto, setTexto] = useState("");
  const [msg, setMsg] = useState("");
  async function aplicar() {
    setMsg("Tu IA está aplicando la dirección al plan…");
    try {
      let j = await bridge.dirigir(flujo.id, texto);
      while (j.status === "running") { await new Promise((r) => setTimeout(r, 2000)); j = await bridge.getFlujo(flujo.id); }
      setMsg(j.error?.startsWith("Dirección") ? j.error : "✓ Plan actualizado con tu dirección"); setTexto(""); onDone();
    } catch (e) { setMsg((e as Error).message); }
  }
  return (
    <div className="direccion">
      <h4>🎬 Dale dirección <small>dile qué cambiar y tu IA rehace el plan antes de construir</small></h4>
      <textarea placeholder="Ej: en el beat 3 usa la opción B pero con la palabra FOTOS más grande; el gancho más agresivo; quita el mundo del atardecer y pon un b-roll de la tienda" value={texto} onChange={(e) => setTexto(e.target.value)} />
      <div className="row"><button className="btn primary" disabled={!texto.trim()} onClick={aplicar}>Aplicar dirección</button>{msg && <small className="hint">{msg}</small>}</div>
    </div>
  );
}

/** Plugin Katana: la revisión medida del video terminado (vale para cualquier estilo). */
function KatanaCard({ rev }: { rev: NonNullable<bridge.FlujoJob["revision"]> }) {
  const ok = rev.checks.filter((c) => c.ok).length;
  return (
    <div className="katana">
      <h4>⚔ Revisión Katana <small>{ok}/{rev.checks.length} bien · medido sobre el video</small></h4>
      <ul>{rev.checks.map((c) => <li key={c.id} className={c.ok ? "ok" : "warn"}><i>{c.ok ? "✓" : "!"}</i><div><b>{c.titulo}</b><small>{c.detalle}</small></div></li>)}</ul>
    </div>
  );
}

/** Plugin Edit Studio: efectos con nombre en un momento exacto sobre el video terminado (cualquier estilo, cualquier IA). */
function EfectosBox({ flujo, url, onDone }: { flujo: bridge.FlujoJob; url: (r?: string) => string; onDone: () => void }) {
  const [texto, setTexto] = useState("");
  const [lista, setLista] = useState<{ id: string; nombre: string }[]>([]);
  const [msg, setMsg] = useState("");
  useEffect(() => { bridge.listaEfectos().then(setLista).catch(() => null); }, []);
  const ef = flujo.efectos;
  async function aplicar() {
    setMsg("Aplicando efectos con Edit Studio… (unos minutos)");
    try {
      let j = await bridge.efectos(flujo.id, texto);
      while (j.efectos?.status === "running") { await new Promise((r) => setTimeout(r, 3000)); j = await bridge.getFlujo(flujo.id); }
      setMsg(j.efectos?.status === "done" ? `✓ ${j.efectos.aplicados?.join(" · ")}` : `Error: ${j.efectos?.error ?? ""}`);
      onDone();
    } catch (e) { setMsg((e as Error).message); }
  }
  return (
    <div className="efectos-box">
      <h4>✦ Efectos (Edit Studio) <small>escribe qué efecto y cuándo</small></h4>
      <textarea placeholder={"crash zoom en 0:07, destello en 0:12 y glitch donde dice «sola»"} value={texto} onChange={(e) => setTexto(e.target.value)} />
      <div className="ef-chips">{lista.map((e) => <button key={e.id} className="link" onClick={() => setTexto((t) => `${t ? `${t}, ` : ""}${e.nombre.toLowerCase()} en 0:00`)}>{e.nombre}</button>)}</div>
      <div className="row">
        <button className="btn primary" disabled={!texto.trim() || ef?.status === "running"} onClick={aplicar}>Aplicar efectos</button>
        {ef?.status === "done" && ef.video && <a className="btn" href={url(ef.video)} target="_blank" rel="noreferrer">Ver la versión con efectos</a>}
      </div>
      {(msg || ef?.status === "running") && <small className="hint">{msg || "Aplicando efectos…"}</small>}
    </div>
  );
}

/** Pedir prompts: de lo que sugiere el plan o de lo que pide Santiago con sus palabras. */
function PromptBox({ flujo, onDone }: { flujo: bridge.FlujoJob; onDone: () => void }) {
  const [pedido, setPedido] = useState("");
  const [estado, setEstado] = useState("");
  async function pedir(base: "sugerencia" | "pedido") {
    setEstado("Escribiendo prompts…");
    try {
      let j = await bridge.pedirPrompts(flujo.id, { base, pedido });
      while (j.prompts?.status === "running") { await new Promise((r) => setTimeout(r, 2000)); j = await bridge.getFlujo(flujo.id); }
      if (j.prompts?.status === "error") return setEstado(`Error: ${j.prompts.error}`);
      setEstado(`✓ ${j.prompts?.nuevos?.length ?? 0} prompts nuevos (${j.prompts?.nuevos?.join(", ")}) en la lista de assets`);
      if (base === "pedido") setPedido("");
      onDone();
    } catch (e) { setEstado((e as Error).message); }
  }
  return (
    <div className="prompt-box">
      <h4>✍ Pedir prompts <small>para generar tus imágenes y videos</small></h4>
      <textarea placeholder="Escribe lo que quieres. Ej: «3 prompts de b-roll de mi tienda de ropa con luz de día, la prenda puesta en una modelo, y un video de 5 s de la etiqueta en macro»" value={pedido} onChange={(e) => setPedido(e.target.value)} />
      <div className="row">
        <button className="btn" disabled={estado === "Escribiendo prompts…"} onClick={() => pedir("sugerencia")}>Prompts de lo que sugiere el plan</button>
        <button className="btn primary" disabled={!pedido.trim() || estado === "Escribiendo prompts…"} onClick={() => pedir("pedido")}>Prompts de lo que pido</button>
      </div>
      {estado && <small className="hint">{estado}</small>}
    </div>
  );
}

const BLOQUES: [keyof NonNullable<bridge.Asset["bloques"]>, string][] = [
  ["referencias", "1 · Referencias"], ["contexto", "2 · Contexto"], ["mapa_espacial", "3 · Mapa espacial"], ["accion", "4 · Acción"],
  ["camara", "5 · Cámara"], ["luz_textura", "6 · Luz y textura"], ["bloqueos", "7 · Bloqueos"],
];
function AssetCard({ a, subir }: { a: bridge.Asset; subir?: (f: File) => Promise<void> }) {
  const copy = (t?: string) => t && navigator.clipboard?.writeText(t);
  const [estado, setEstado] = useState("");
  return (
    <div className="asset-card">
      <div className="asset-head">
        <b>{a.id} · {a.name}</b>{a.subido && <span className="hero ok">✓ subido</span>}{a.is_ref && <span className="hero">HERO · primero</span>}{a.origen && <span className="hero">{a.origen === "pedido" ? "lo que pediste" : "sugerido"}</span>}
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
        {subir && (
          <label className="btn primary">
            <input type="file" accept="image/*,video/*" hidden onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; setEstado("Subiendo…"); try { await subir(f); setEstado("✓ Listo: se usará en la edición"); } catch (er) { setEstado((er as Error).message); } }} />
            {a.subido ? "Cambiar archivo" : "Subir el asset"}
          </label>
        )}
      </div>
      {estado && <small className="hint">{estado}</small>}
    </div>
  );
}
