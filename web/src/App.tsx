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

type Tab = "media" | "styles" | "ai" | "motion";
const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

export default function App() {
  const [tab, setTab] = useState<Tab>("media");
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState<string>("");
  const [duration, setDuration] = useState(0);
  const [words, setWords] = useState<Word[]>([]);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [styles, setStyles] = useState<Style[]>(BUILTIN_STYLES);
  const [styleId, setStyleId] = useState("impacto");
  const [status, setStatus] = useState("Arrastra un clip para empezar");
  const [busy, setBusy] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [t, setT] = useState(0);
  const [providers, setProviders] = useState<bridge.Provider[] | null>(null);
  const [provider, setProvider] = useState("claude-api");
  const [prompt, setPrompt] = useState("");
  const [job, setJob] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioRef = useRef<{ ctx: AudioContext; dest: MediaStreamAudioDestinationNode } | null>(null);

  const style = styles.find((s) => s.id === styleId) ?? styles[0];
  const chunks = useMemo(
    () => chunkWords(plan ? keptWords(words, plan.segments) : words, style.caption.wordsPerChunk),
    [words, plan, style],
  );

  // Bridge (opcional)
  useEffect(() => {
    bridge.health().then((h) => {
      if (!h) return;
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
    setFile(f); setUrl(URL.createObjectURL(f)); setWords([]); setPlan(null);
    setBusy(true);
    try {
      setStatus("Extrayendo audio…");
      const audio = await decodeAudio16k(f);
      const w = await transcribe(audio, setStatus);
      setWords(w);
      setStatus(`${w.length} palabras transcritas. Listo para editar.`);
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
    setStatus(`Trabajo ${id} en cola. En Claude, ChatGPT o Gemini pide: “edita el trabajo ${id} de Kairo”.`);
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
    a.download = `kairo-${style.id}.${blob.type.includes("mp4") ? "mp4" : "webm"}`;
    a.click();
    setExporting(false); setStatus("Exportado ✓");
  }

  // Gancho de pruebas automatizadas (solo en desarrollo)
  if (import.meta.env.DEV) (window as any).__kairo = { setWords, setDuration, localEdit: () => setPlan(autoPlan(words, duration, style)) };

  const outLen = plan ? outDuration(plan.segments) : duration;

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand"><span className="logo">K</span>Kairo <em>Studio</em></div>
        <div className="project">{file?.name ?? "Proyecto sin título"}</div>
        <div className="top-actions">
          <span className={`chip ${providers ? "on" : ""}`}>
            <i />{providers ? "Bridge IA conectado" : "Modo offline"}
          </span>
          <button className="btn primary" disabled={!plan || exporting} onClick={exportVideo}>
            <Icon name="export" /> Exportar
          </button>
        </div>
      </header>

      <nav className="rail">
        {([["media", "film", "Medios"], ["styles", "palette", "Estilos"], ["ai", "spark", "Director IA"], ["motion", "shapes", "Motion"]] as const).map(([id, icon, label]) => (
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
            <h3>Style DNA</h3>
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
            <textarea placeholder="Ej: hazlo de 30 segundos, gancho fuerte, resalta los números…" value={prompt} onChange={(e) => setPrompt(e.target.value)} />
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

        {tab === "motion" && (
          <>
            <h3>Gráficos de movimiento</h3>
            <p className="hint">Se generan desde el plan. Clic para saltar.</p>
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
        <div className="status">{busy && <span className="spinner" />}{status}</div>
      </footer>
    </div>
  );
}
