import { useEffect, useMemo, useRef, useState } from "react";
import type { Plan, Style, Word } from "./engine/types";
import { BUILTIN_STYLES } from "./engine/styles";
import { autoPlan, chunkWords, keptWords, nextJump, outDuration } from "./engine/plan";
import { drawFrame, OUT_H, OUT_W } from "./engine/render";
import { decodeAudio16k, transcribe } from "./engine/media";
import * as bridge from "./engine/bridge";
import { startRecording } from "./engine/exporter";
import { Timeline } from "./ui/Timeline";
import { Icon } from "./ui/Icon";
import { Lab } from "./ui/Lab";
import { Montaje } from "./ui/Montaje";
import { PIXEL_FX_META, fxDuration } from "../../shared/fxmeta";
import type { Motion } from "./engine/types";

type Tab = "media" | "styles" | "ai" | "motion" | "lab";
const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

export default function App() {
  const [tab, setTab] = useState<Tab>("media");
  const [mode, setMode] = useState<"editor" | "montaje">("editor");
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState<string>("");
  const [duration, setDuration] = useState(0);
  const [words, setWords] = useState<Word[]>([]);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [styles, setStyles] = useState<Style[]>(BUILTIN_STYLES);
  const [styleId, setStyleId] = useState("imperial");
  const [status, setStatus] = useState("Arrastra un clip para empezar");
  const [busy, setBusy] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [t, setT] = useState(0);
  const [providers, setProviders] = useState<bridge.Provider[] | null>(null);
  const [provider, setProvider] = useState("claude-api");
  const [prompt, setPrompt] = useState("");
  const [job, setJob] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [mediaId, setMediaId] = useState<string | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [render, setRender] = useState<bridge.RenderJob | null>(null);
  const [rea, setRea] = useState(false);
  const [learnName, setLearnName] = useState("");
  const [learnLog, setLearnLog] = useState("");
  const [ideaQ, setIdeaQ] = useState("");
  const [ideaCat, setIdeaCat] = useState("motion");
  const [ideas, setIdeas] = useState<bridge.Idea[]>([]);
  const [idea, setIdea] = useState("");
  const [mSeconds, setMSeconds] = useState(5);
  const [motions, setMotions] = useState<bridge.MotionJob[]>([]);

  const videoRef = useRef<HTMLVideoElement>(null);
  const autoStyle = useRef<string | null>(null); // plantilla "rápida": editar sola en cuanto termine la transcripción
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioRef = useRef<{ ctx: AudioContext; dest: MediaStreamAudioDestinationNode } | null>(null);

  const style = styles.find((s) => s.id === styleId) ?? styles[0];
  const chunks = useMemo(
    () => chunkWords(plan ? keptWords(words, plan.segments) : words, style.caption.wordsPerChunk),
    [words, plan, style],
  );

  // Bridge (opcional)
  useEffect(() => {
    bridge.healthFull().then((h) => {
      if (!h) return;
      setRea(h.rea);
      setProviders(h.providers);
      const first = h.providers.find((p) => p.ready);
      if (first) setProvider(first.id);
      bridge.fetchStyles().then((s) => s.length && setStyles(s));
    });
  }, []);

  // Bucle de render
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      const v = videoRef.current, c = canvasRef.current;
      if (v && c) {
        if (plan && !v.paused) {
          const j = nextJump(plan.segments, v.currentTime);
          if (j === -1) { v.pause(); setPlaying(false); finishExport(); }
          else if (j !== null) v.currentTime = j;
        }
        drawFrame({ ctx: c.getContext("2d")!, video: v, plan, chunks, style, t: v.currentTime });
        setT(v.currentTime);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  });

  // Encolado de MCP: espera a que tu suscripción (Claude/ChatGPT/Gemini) entregue el plan
  useEffect(() => {
    if (!job) return;
    const id = setInterval(async () => {
      const j = await bridge.getJob(job).catch(() => null);
      if (j?.plan) { setPlan(j.plan); setStatus(`Plan recibido de ${j.plannedBy} · ${j.plan.summary}`); setJob(null); }
    }, 2500);
    return () => clearInterval(id);
  }, [job]);

  async function loadFile(f: File) {
    setFile(f); setUrl(URL.createObjectURL(f)); setWords([]); setPlan(null); setMediaId(null);
    if (providers) bridge.uploadMedia(f).then((m) => setMediaId(m.mediaId)).catch(() => null);
    setBusy(true);
    try {
      setStatus("Extrayendo audio…");
      const audio = await decodeAudio16k(f);
      const w = await transcribe(audio, setStatus);
      setWords(w);
      setStatus(`${w.length} palabras transcritas. Listo para editar.`);
      if (autoStyle.current) {
        const st = styles.find((x) => x.id === autoStyle.current) ?? style;
        const v = videoRef.current;
        const p = autoPlan(w, v?.duration || duration, st);
        setPlan(p); setStatus(`Plantilla ${st.name}: ${p.summary}`);
        autoStyle.current = null;
      }
      setTab("ai");
    } catch (e) {
      setStatus(`Error al transcribir: ${(e as Error).message}`);
    } finally { setBusy(false); }
  }

  function localEdit() {
    const p = autoPlan(words, duration, style);
    setPlan(p); setStatus(p.summary);
  }

  async function aiEdit() {
    setBusy(true); setStatus("La IA está dirigiendo la edición…");
    try {
      const { plan } = await bridge.requestPlan({ provider, styleId, words, duration, prompt });
      setPlan(plan); setStatus(plan.summary);
    } catch (e) { setStatus(`IA: ${(e as Error).message}`); }
    finally { setBusy(false); }
  }

  async function mcpEdit() {
    const { id } = await bridge.createJob({ styleId, words, duration, prompt });
    setJob(id);
    setStatus(`Trabajo ${id} en cola. En Claude, ChatGPT o Gemini pide: “edita el trabajo ${id} de Emperador Santiago”.`);
  }

  function ensureAudio() {
    const v = videoRef.current!;
    if (!audioRef.current) {
      const ctx = new AudioContext();
      const src = ctx.createMediaElementSource(v);
      const dest = ctx.createMediaStreamDestination();
      src.connect(dest); src.connect(ctx.destination);
      audioRef.current = { ctx, dest };
    }
    audioRef.current.ctx.resume();
    return audioRef.current;
  }

  function togglePlay() {
    const v = videoRef.current; if (!v) return;
    ensureAudio();
    if (v.paused) { if (plan && nextJump(plan.segments, v.currentTime) === -1) v.currentTime = plan.segments[0].start; v.play(); setPlaying(true); }
    else { v.pause(); setPlaying(false); }
  }

  const recRef = useRef<ReturnType<typeof startRecording> | null>(null);
  async function exportVideo() {
    const v = videoRef.current!, c = canvasRef.current!;
    const a = ensureAudio();
    c.width = OUT_W; c.height = OUT_H;
    v.currentTime = plan?.segments[0]?.start ?? 0;
    await new Promise((r) => (v.onseeked = r));
    setExporting(true); setStatus("Exportando en 1080×1920…");
    recRef.current = startRecording(c, a.dest.stream);
    v.play(); setPlaying(true);
  }
  async function finishExport() {
    if (!recRef.current) return;
    const blob = await recRef.current.stop();
    recRef.current = null;
    const c = canvasRef.current!; c.width = 540; c.height = 960;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `emperador-santiago-${style.id}.${blob.type.includes("mp4") ? "mp4" : "webm"}`;
    a.click();
    setExporting(false); setStatus("Exportado ✓");
  }

  // Gancho de pruebas automatizadas (solo en desarrollo)
  if (import.meta.env.DEV) (window as any).__santi = { setWords, setDuration, localEdit: () => setPlan(autoPlan(words, duration, style)) };

  // Render en el equipo con Remotion o HyperFrames (vía bridge)
  async function renderWith(engine: "remotion" | "hyperframes") {
    setExportOpen(false);
    if (!plan || !mediaId) return setStatus("Necesitas el bridge encendido y un plan de edición.");
    const job = await bridge.startRender({ engine, mediaId, styleId, plan, words });
    setRender(job);
    const poll = setInterval(async () => {
      const j = await bridge.getRender(job.id).catch(() => null);
      if (!j) return;
      setRender(j);
      setStatus(`${engine === "remotion" ? "Remotion" : "HyperFrames"}: ${j.status === "done" ? "listo ✓" : j.status === "error" ? j.error : `renderizando ${Math.round(j.progress * 100)}%`}`);
      if (j.status === "done" || j.status === "error") clearInterval(poll);
    }, 1500);
  }

  // Insertar un gráfico en el momento actual del clip
  function insertMotion(m: Omit<Motion, "start" | "end">, dur: number) {
    const at = videoRef.current?.currentTime ?? 0;
    const base: Plan = plan ?? { summary: "Edición manual", segments: [{ start: 0, end: duration }], emphasis: [], zooms: [], motion: [] };
    setPlan({ ...base, motion: [...base.motion, { ...m, start: at, end: at + dur }] });
    setStatus(`Insertado ${m.kind} en ${fmt(at)}`);
  }

  // Aprender un Estilo de Santi de un video de referencia (rea-video)
  async function learnFrom(f: File) {
    const name = learnName.trim() || f.name.replace(/\.[^.]+$/, "");
    setLearnLog("Subiendo referencia…");
    const { mediaId } = await bridge.uploadMedia(f);
    const a = await bridge.startAnalysis({ mediaId, name, provider: providers?.find((p) => p.id === provider && p.ready) ? provider : undefined });
    const poll = setInterval(async () => {
      const r = await bridge.getAnalysis(a.id).catch(() => null);
      if (!r) return;
      setLearnLog(r.status === "running" ? `rea-video: ${r.log.at(-1) ?? "analizando…"}` : r.status === "error" ? `Error: ${r.error}` : `✓ Estilo “${r.style?.name}” aprendido`);
      if (r.status === "done" && r.style) { const st = r.style; setStyles((s) => [...s.filter((x) => x.id !== st.id), st]); setStyleId(st.id); }
      if (r.status !== "running") clearInterval(poll);
    }, 2000);
  }

  async function findIdeas() { setIdeas(await bridge.searchIdeas(ideaQ, ideaCat).catch(() => [])); }

  async function generateMotion() {
    const job = await bridge.startMotion({ provider, idea, seconds: mSeconds, styleId });
    setMotions((m) => [job, ...m]);
    const poll = setInterval(async () => {
      const j = await bridge.getMotion(job.id).catch(() => null);
      if (!j) return;
      setMotions((m) => m.map((x) => (x.id === j.id ? j : x)));
      if (j.status === "done" || j.status === "error") clearInterval(poll);
    }, 2500);
  }

  const outLen = plan ? outDuration(plan.segments) : duration;

  return (
    <div className={`app ${mode === "montaje" ? "is-montaje" : ""}`}>
      <header className="topbar">
        <div className="brand"><span className="logo"><Icon name="crown" /></span><div><b>Emperador Santiago</b><em>Edición de Videos</em></div></div>
        <div className="modes">
          <button className={mode === "editor" ? "on" : ""} onClick={() => setMode("editor")}>Editor</button>
          <button className={mode === "montaje" ? "on" : ""} onClick={() => setMode("montaje")}>Crear video</button>
        </div>
        <div className="top-actions">
          <span className={`chip ${providers ? "on" : ""}`}>
            <i />{providers ? "Bridge IA conectado" : "Modo offline"}
          </span>
          <div className="export" style={{ visibility: mode === "editor" ? "visible" : "hidden" }}>
            <button className="btn primary" disabled={!plan || exporting} onClick={() => setExportOpen(!exportOpen)}>
              <Icon name="export" /> Exportar
            </button>
            {exportOpen && (
              <div className="menu">
                <button onClick={() => { setExportOpen(false); exportVideo(); }}><b>Navegador</b><small>Rápido y sin internet · tiempo real</small></button>
                <button disabled={!mediaId} onClick={() => renderWith("remotion")}><b>Remotion</b><small>Calidad máxima · cuadro a cuadro</small></button>
                <button disabled={!mediaId} onClick={() => renderWith("hyperframes")}><b>HyperFrames</b><small>MP4 + proyecto HTML editable</small></button>
                {!mediaId && <p>Remotion y HyperFrames necesitan el bridge (<code>npm run dev</code>).</p>}
              </div>
            )}
          </div>
        </div>
      </header>

      {mode === "montaje" && <Montaje online={!!providers} providers={providers} onOpenInEditor={(f, styleId) => { setMode("editor"); if (styleId) { setStyleId(styleId); autoStyle.current = styleId; } loadFile(f); setTab("ai"); }} />}

      <div className="editor-view" style={{ display: mode === "editor" ? "contents" : "none" }}>
      <nav className="rail">
        {([["media", "film", "Medios"], ["styles", "crown", "Estilos de Santi"], ["ai", "spark", "Director IA"], ["motion", "shapes", "Motion"], ["lab", "flask", "Laboratorio"]] as const).map(([id, icon, label]) => (
          <button key={id} className={tab === id ? "active" : ""} onClick={() => setTab(id)} title={label}>
            <Icon name={icon} /><span>{label}</span>
          </button>
        ))}
      </nav>

      <aside className="panel">
        {tab === "media" && (
          <>
            <h3>Medios</h3>
            <label className="drop" onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; f && loadFile(f); }}>
              <input type="file" accept="video/*" hidden onChange={(e) => e.target.files?.[0] && loadFile(e.target.files[0])} />
              <Icon name="upload" />
              <strong>Suelta tu clip aquí</strong>
              <small>MP4 · MOV · WebM — se procesa en tu equipo</small>
            </label>
            {file && <div className="asset"><Icon name="film" /><div><b>{file.name}</b><small>{fmt(duration)} · {words.length} palabras</small></div></div>}
          </>
        )}

        {tab === "styles" && (
          <>
            <h3>Estilos de Santi</h3>
            <div className="learn">
              <b>Aprender de un video</b>
              <small>rea-video desarma tu referencia (cortes, subtítulos, sonido, look) y crea un estilo nuevo{providers?.some((p) => p.ready) ? " con tu IA" : ""}.</small>
              <input placeholder="Nombre del estilo" value={learnName} onChange={(e) => setLearnName(e.target.value)} />
              <label className={`btn wide ${!rea ? "disabled" : ""}`}>
                <input type="file" accept="video/*" hidden disabled={!rea} onChange={(e) => e.target.files?.[0] && learnFrom(e.target.files[0])} />
                <Icon name="upload" /> {rea ? "Subir video de referencia" : "Instala rea-video: npm run setup:rea"}
              </label>
              {learnLog && <p className="hint">{learnLog}</p>}
            </div>
            <p className="hint">Cada estilo define tipografía, ritmo, zooms y gráficos. Entrena nuevos con <code>npm run learn</code> o desde tu IA vía MCP.</p>
            <div className="styles">
              {styles.map((s) => (
                <button key={s.id} className={`style-card ${s.id === styleId ? "active" : ""}`} onClick={() => { setStyleId(s.id); if (plan && words.length) setPlan(autoPlan(words, duration, s)); }}>
                  <div className="swatch" style={{ fontFamily: s.caption.font, fontWeight: s.caption.weight, color: s.caption.color, textTransform: s.caption.uppercase ? "uppercase" : "none", WebkitTextStroke: s.caption.stroke !== "transparent" ? `1px ${s.caption.stroke}` : undefined }}>
                    Hola <span style={{ color: s.caption.highlight }}>mundo</span>
                  </div>
                  <b>{s.name}</b><small>{s.description}</small>
                </button>
              ))}
            </div>
          </>
        )}

        {tab === "ai" && (
          <>
            <h3>Director IA</h3>
            <textarea placeholder="Ej: estilo imperial, 30 segundos, gancho fuerte, resalta los números…" value={prompt} onChange={(e) => setPrompt(e.target.value)} />
            <button className="btn primary wide" disabled={!words.length || busy} onClick={localEdit}><Icon name="bolt" /> Edición automática (offline)</button>
            <div className="divider"><span>con IA</span></div>
            <select value={provider} onChange={(e) => setProvider(e.target.value)} disabled={!providers}>
              {(providers ?? [{ id: "claude-api", label: "Inicia el bridge para usar IA", ready: false }]).map((p) => (
                <option key={p.id} value={p.id} disabled={!p.ready}>{p.ready ? "● " : "○ "}{p.label}</option>
              ))}
            </select>
            <button className="btn wide" disabled={!words.length || busy || !providers} onClick={aiEdit}><Icon name="spark" /> Dirigir con IA</button>
            <button className="btn ghost wide" disabled={!words.length || !providers} onClick={mcpEdit}><Icon name="plug" /> Enviar a mi suscripción (MCP)</button>
            {job && <div className="job">Esperando plan del trabajo <b>{job}</b>…</div>}
            {plan && <div className="summary"><b>Plan</b><p>{plan.summary}</p></div>}
          </>
        )}

        {tab === "lab" && <Lab mediaId={mediaId} fileName={file?.name} />}

        {tab === "motion" && (
          <>
            <h3>Efectos especiales</h3>
            <p className="hint">Se insertan en el momento actual del clip.</p>
            <div className="fx-grid">
              <button onClick={() => insertMotion({ kind: "intro3d", text: "" }, fxDuration("intro3d", ""))}><span>👑</span>Corona 3D</button>
              {Object.entries(PIXEL_FX_META).map(([id, m]) => (
                <button key={id} onClick={() => insertMotion({ kind: "pixelfx", text: id }, m.duration)} title={m.uso}><span>✦</span>{m.label}</button>
              ))}
            </div>

            <h3 className="mt">Generar motion graphic</h3>
            <div className="ideas-search">
              <input placeholder="Buscar ideas (ej. chart, text, logo)" value={ideaQ} onChange={(e) => setIdeaQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && findIdeas()} />
              <select value={ideaCat} onChange={(e) => setIdeaCat(e.target.value)}>
                <option value="motion">Motion</option><option value="explainer">Explicativo</option><option value="3d">3D</option><option value="">Todas</option>
              </select>
              <button className="btn" disabled={!providers} onClick={findIdeas}>Buscar</button>
            </div>
            {ideas.length > 0 && (
              <ul className="ideas">
                {ideas.map((i) => <li key={i.id} onClick={() => setIdea(i.prompt)} title={i.prompt}><span className="tag">{i.category}</span>{i.prompt}</li>)}
              </ul>
            )}
            <textarea placeholder="Describe el motion graphic o elige una idea de la biblioteca" value={idea} onChange={(e) => setIdea(e.target.value)} />
            <div className="row">
              <label>Duración <input type="number" min={2} max={30} value={mSeconds} onChange={(e) => setMSeconds(+e.target.value)} /> s</label>
              <button className="btn primary" disabled={!idea || !providers?.some((p) => p.id === provider && p.ready)} onClick={generateMotion}><Icon name="spark" /> Generar</button>
            </div>
            {motions.map((m) => (
              <div key={m.id} className="motion-job">
                <span>{m.status === "done" ? "✓ Listo" : m.status === "error" ? "Error" : m.status === "writing" ? "La IA escribe la animación…" : "HyperFrames renderiza…"}</span>
                {m.url && <button className="btn" onClick={() => insertMotion({ kind: "broll", text: m.url! }, m.seconds)}>Insertar aquí</button>}
                {m.error && <small>{m.error.slice(0, 160)}</small>}
              </div>
            ))}

            <h3 className="mt">En este video</h3>
            <ul className="motion-list">
              {(plan?.motion ?? []).map((m, i) => (
                <li key={i} onClick={() => videoRef.current && (videoRef.current.currentTime = m.start)}>
                  <span className={`tag ${m.kind}`}>{m.kind}</span><span>{m.text || "—"}</span><small>{fmt(m.start)}</small>
                </li>
              ))}
              {!plan && <li className="empty">Aún no hay plan de edición.</li>}
            </ul>
          </>
        )}
      </aside>

      <main className="stage">
        <div className="canvas-wrap">
          <canvas ref={canvasRef} width={540} height={960} />
          {!url && <div className="placeholder"><Icon name="film" /><p>Vista previa 9:16</p></div>}
        </div>
        <video ref={videoRef} src={url} hidden playsInline onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)} />
        <div className="transport">
          <button className="round" onClick={togglePlay} disabled={!url}><Icon name={playing ? "pause" : "play"} /></button>
          <span className="time">{fmt(t)} <i>/ {fmt(outLen)}</i></span>
        </div>
      </main>

      <aside className="inspector">
        <h3>Transcripción</h3>
        <div className="transcript">
          {words.length === 0 && <p className="hint">{busy ? status : "Aparecerá aquí, palabra por palabra."}</p>}
          {words.map((w, i) => {
            const kept = !plan || plan.segments.some((s) => w.t0 >= s.start - 0.01 && w.t1 <= s.end + 0.01);
            const now = t >= w.t0 && t <= w.t1;
            return (
              <span key={i} className={`${kept ? "" : "cut"} ${now ? "now" : ""}`} onClick={() => videoRef.current && (videoRef.current.currentTime = w.t0)}>{w.w} </span>
            );
          })}
        </div>
      </aside>

      <footer className="timeline-area">
        <Timeline duration={duration} t={t} plan={plan} chunks={chunks} onSeek={(s) => videoRef.current && (videoRef.current.currentTime = s)} />
        <div className="status">
          {busy && <span className="spinner" />}{status}
          {render?.status === "rendering" && <span className="bar"><i style={{ width: `${render.progress * 100}%` }} /></span>}
          {render?.status === "done" && <a className="dl" href={bridge.renderFileUrl(render.id)} download>Descargar MP4 ({render.engine})</a>}
          {render?.projectDir && render.status === "done" && <code title="Ábrelo con: npx hyperframes preview">{render.projectDir}</code>}
        </div>
      </footer>
      </div>
    </div>
  );
}
