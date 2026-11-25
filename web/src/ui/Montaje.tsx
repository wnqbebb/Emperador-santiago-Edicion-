// Unión de clips y recortes de silencio — vista completa.
// Subes los clips (no se procesa nada todavía), se ordenan solos por nombre (clip 1, clip 2 … clip 10),
// los reordenas si hace falta y con un botón: busca silencios, recorta, une, renderiza y comprime.
import { useEffect, useMemo, useRef, useState } from "react";
import * as bridge from "../engine/bridge";
import { Icon } from "./Icon";

type Item = { id: string; file: File; url: string; duration: number; w: number; h: number; thumb: string };
type Ritmo = "natural" | "dinamico" | "agresivo";
const coll = new Intl.Collator("es", { numeric: true, sensitivity: "base" });
const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;
const STEPS = ["Subiendo clips", "Buscando silencios", "Recortando y uniendo", "Renderizando", "Comprimiendo", "Listo"];
const stepIndex = (step: string, uploading: boolean) =>
  uploading ? 0 : /silencios|palabras/i.test(step) ? 1 : /Recortando/i.test(step) ? 2 : /Renderizando/i.test(step) ? 3 : /Comprimiendo/i.test(step) ? 4 : /Listo/i.test(step) ? 5 : 1;

async function describe(file: File): Promise<Item> {
  const url = URL.createObjectURL(file);
  const v = document.createElement("video");
  v.muted = true; v.preload = "metadata"; v.src = url;
  await new Promise((r, j) => { v.onloadedmetadata = r; v.onerror = j; });
  v.currentTime = Math.min(0.5, v.duration / 2);
  await new Promise((r) => (v.onseeked = r));
  const c = document.createElement("canvas");
  c.width = 120; c.height = 160;
  const s = Math.max(120 / v.videoWidth, 160 / v.videoHeight);
  c.getContext("2d")!.drawImage(v, (120 - v.videoWidth * s) / 2, (160 - v.videoHeight * s) / 2, v.videoWidth * s, v.videoHeight * s);
  return { id: crypto.randomUUID(), file, url, duration: v.duration, w: v.videoWidth, h: v.videoHeight, thumb: c.toDataURL("image/jpeg", 0.75) };
}

export function Montaje({ online, onOpenInEditor, onCrearVideo }: { online: boolean; onOpenInEditor: (f: File) => void; onCrearVideo: (montajeId: string) => void }) {
  const [items, setItems] = useState<Item[]>([]);
  const [ritmo, setRitmo] = useState<Ritmo>("dinamico");
  const [muletillas, setMuletillas] = useState(false);
  const [formato, setFormato] = useState<"vertical" | "original">("vertical");
  const [repetidas, setRepetidas] = useState(true);
  const [mejorarAudio, setMejorarAudio] = useState(true);
  const [velocidad, setVelocidad] = useState(1);
  const [srt, setSrt] = useState(true);
  const [restaurar, setRestaurar] = useState<Record<number, number[]>>({});
  const [phase, setPhase] = useState<"idle" | "uploading" | "working" | "review" | "done" | "error">("idle");
  const [upload, setUpload] = useState(0);
  const [job, setJob] = useState<bridge.MontajeJob | null>(null);
  const [drag, setDrag] = useState<string | null>(null);
  const [over, setOver] = useState(false);
  const folderRef = useRef<HTMLInputElement>(null);

  // al terminar, mostrar el video completo sin tener que buscarlo
  useEffect(() => { if (phase === "done") setTimeout(() => document.querySelector(".m-result")?.scrollIntoView({ behavior: "smooth", block: "center" }), 150); }, [phase]);

  const total = useMemo(() => items.reduce((t, i) => t + i.duration, 0), [items]);

  async function add(list: FileList | File[]) {
    const vids = [...list].filter((f) => f.type.startsWith("video/") || /\.(mp4|mov|m4v|webm|mkv)$/i.test(f.name));
    const described = (await Promise.all(vids.map((f) => describe(f).catch(() => null)))).filter(Boolean) as Item[];
    // orden automático por nombre: clip 1, clip 2, … clip 10 (no "clip 10" antes de "clip 2")
    setItems((cur) => [...cur, ...described].sort((a, b) => coll.compare(a.file.name, b.file.name)));
    setPhase("idle"); setJob(null);
  }
  const move = (i: number, d: number) => setItems((cur) => { const n = [...cur]; const j = i + d; if (j < 0 || j >= n.length) return cur; [n[i], n[j]] = [n[j], n[i]]; return n; });
  const drop = (target: string) => setItems((cur) => {
    if (!drag || drag === target) return cur;
    const n = cur.filter((x) => x.id !== drag); const at = n.findIndex((x) => x.id === target);
    n.splice(at, 0, cur.find((x) => x.id === drag)!); return n;
  });

  const usaWhisper = muletillas || repetidas || srt;
  async function waitJob(j: bridge.MontajeJob) {
    setJob(j);
    while (j.status === "running") { await new Promise((r) => setTimeout(r, 800)); j = await bridge.getMontaje(j.id); setJob(j); }
    return j;
  }

  /** revisar = true: analiza y se detiene para que revises cada corte; false: todo de una. */
  async function create(revisar: boolean) {
    setPhase("uploading"); setUpload(0); setJob(null); setRestaurar({});
    try {
      const clips: { mediaId: string; name: string }[] = [];
      for (const [i, it] of items.entries()) {
        const { mediaId } = await bridge.uploadMedia(it.file);
        clips.push({ mediaId, name: it.file.name });
        setUpload((i + 1) / items.length);
      }
      setPhase("working");
      const opts = { clips, ritmo, muletillas, formato, repetidas, mejorarAudio, velocidad, srt };
      const j = await waitJob(revisar ? await bridge.analizarMontaje(opts) : await bridge.startMontaje(opts));
      setPhase(j.status === "analizado" ? "review" : j.status === "done" ? "done" : "error");
    } catch (e) {
      setJob({ id: "", status: "error", step: "", progress: 0, clips: [], error: (e as Error).message });
      setPhase("error");
    }
  }

  async function renderizar() {
    if (!job) return;
    setPhase("working");
    const j = await waitJob(await bridge.renderMontaje(job.id, restaurar, { mejorarAudio, velocidad, srt }));
    setPhase(j.status === "done" ? "done" : "error");
  }
  const toggleCorte = (ci: number, k: number) => setRestaurar((r) => {
    const cur = new Set(r[ci] ?? []); cur.has(k) ? cur.delete(k) : cur.add(k);
    return { ...r, [ci]: [...cur] };
  });

  async function openInEditor() {
    if (!job?.master) return;
    const blob = await (await fetch(bridge.abs(job.master))).blob();
    onOpenInEditor(new File([blob], "video-completo.mp4", { type: "video/mp4" }));
  }

  const busy = phase === "uploading" || phase === "working";
  const quitados = (ci: number) => (job?.clips[ci]?.cortes ?? []).filter((_, k) => !(restaurar[ci] ?? []).includes(k));
  const estimado = job?.clips.reduce((t, c, ci) => t + c.before - quitados(ci).reduce((x, q) => x + q.end - q.start, 0), 0) ?? 0;
  const before = job?.clips.reduce((t, c) => t + c.before, 0) ?? 0;
  const after = job?.clips.reduce((t, c) => t + c.after, 0) ?? 0;
  const current = stepIndex(job?.step ?? "", phase === "uploading");
  const pct = phase === "uploading" ? upload * 100 : (job?.progress ?? 0) * 100;

  return (
    <div className="montaje">
      <section className="m-main">
        <header className="m-head">
          <div>
            <h1>Unir clips y recortar</h1>
            <p>Sube tus tomas en bruto: se ordenan solas, analizo silencios, muletillas y tomas repetidas, revisas cada corte y sale el video unido, con la voz mejorada y listo para redes.</p>
            <ol className="wizard">
              <li className={phase === "idle" ? "now" : "ok"}>1 · Subir y ordenar</li>
              <li className={phase === "working" && !job?.clips.length ? "now" : job?.clips.length ? "ok" : ""}>2 · Analizar</li>
              <li className={phase === "review" ? "now" : phase === "done" ? "ok" : ""}>3 · Revisar cortes</li>
              <li className={phase === "done" ? "ok" : ""}>4 · Video final</li>
            </ol>
          </div>
          {items.length > 0 && <div className="m-count"><b>{items.length}</b> clips · {fmt(total)}</div>}
        </header>

        <label className={`m-drop ${over ? "over" : ""} ${items.length ? "small" : ""}`}
          onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
          onDrop={(e) => { e.preventDefault(); setOver(false); if (!drag) add(e.dataTransfer.files); }}>
          <input type="file" accept="video/*" multiple hidden disabled={busy} onChange={(e) => e.target.files && add(e.target.files)} />
          <Icon name="upload" />
          <div>
            <strong>{items.length ? "Añadir más clips" : "Suelta aquí tus clips"}</strong>
            <small>Nómbralos en orden (clip 1, clip 2 …): se ordenan solos. Aún no se procesa nada.</small>
          </div>
          <button type="button" className="btn ghost" disabled={busy} onClick={(e) => { e.preventDefault(); folderRef.current?.click(); }}>Elegir carpeta</button>
          <input ref={folderRef} type="file" hidden multiple {...({ webkitdirectory: "" } as object)} onChange={(e) => e.target.files && add(e.target.files)} />
        </label>

        {items.length > 0 && (
          <>
            <div className="m-listhead">
              <span>Orden del video</span>
              <div>
                <button className="link" disabled={busy} onClick={() => setItems((c) => [...c].sort((a, b) => coll.compare(a.file.name, b.file.name)))}>Ordenar por nombre</button>
                <button className="link" disabled={busy} onClick={() => setItems([])}>Quitar todos</button>
              </div>
            </div>
            <ol className="m-list">
              {items.map((it, i) => {
                const rep = job?.clips[i];
                return (
                  <li key={it.id} draggable={!busy} className={drag === it.id ? "dragging" : ""}
                    onDragStart={() => setDrag(it.id)} onDragEnd={() => setDrag(null)}
                    onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); drop(it.id); setDrag(null); }}>
                    <span className="m-num">{i + 1}</span>
                    <img src={it.thumb} alt="" />
                    <div className="m-info">
                      <b title={it.file.name}>{it.file.name}</b>
                      <small>{fmt(it.duration)} · {it.w}×{it.h}{it.w > it.h ? " · horizontal" : ""}</small>
                      {rep && (
                        <div className="wave" title="Dorado = se queda · rojo = silencio · ámbar = muletilla · violeta = toma repetida">
                          <div className="peaks">{(rep.peaks ?? []).map((v, k) => <i key={k} style={{ height: `${8 + v * 92}%` }} />)}</div>
                          {(rep.cortes ?? []).map((c, k) => {
                            const back = (restaurar[i] ?? []).includes(k);
                            return <button key={k} className={`cut ${c.reason.replace(" ", "-")} ${back ? "back" : ""}`} disabled={phase !== "review"} onClick={() => toggleCorte(i, k)}
                              title={`${c.reason}${c.text ? ` «${c.text}»` : ""} · ${(c.end - c.start).toFixed(2)} s — ${back ? "se queda (clic para quitar)" : "se quita (clic para conservar)"}`}
                              style={{ left: `${(c.start / rep.before) * 100}%`, width: `${Math.max(0.4, ((c.end - c.start) / rep.before) * 100)}%` }} />;
                          })}
                        </div>
                      )}
                      {rep && phase === "review" && (rep.cortes ?? []).some((c) => c.reason !== "silencio") && (
                        <div className="cut-chips">{(rep.cortes ?? []).map((c, k) => c.reason === "silencio" ? null : (
                          <button key={k} className={`chip-cut ${c.reason.replace(" ", "-")} ${(restaurar[i] ?? []).includes(k) ? "back" : ""}`} onClick={() => toggleCorte(i, k)}>
                            {c.reason}{c.text ? ` «${c.text.slice(0, 40)}»` : ""} {(restaurar[i] ?? []).includes(k) ? "· se queda" : "· se quita"}</button>))}</div>
                      )}
                      {rep && <small className="m-saved">{rep.before.toFixed(1)} s → {(rep.before - quitados(i).reduce((x, q) => x + q.end - q.start, 0)).toFixed(1)} s · {quitados(i).length} cortes{rep.fillers ? ` · ${rep.fillers} muletillas` : ""}{rep.repeated ? ` · ${rep.repeated} tomas repetidas` : ""}</small>}
                    </div>
                    <div className="m-actions">
                      <button title="Subir" disabled={busy || i === 0} onClick={() => move(i, -1)}>↑</button>
                      <button title="Bajar" disabled={busy || i === items.length - 1} onClick={() => move(i, 1)}>↓</button>
                      <button title="Quitar" disabled={busy} onClick={() => setItems((c) => c.filter((x) => x.id !== it.id))}>✕</button>
                    </div>
                    <span className="m-grip" aria-hidden>⋮⋮</span>
                  </li>
                );
              })}
            </ol>
          </>
        )}
      </section>

      <aside className="m-side">
        <h3>Recorte</h3>
        <div className="seg">
          {([["natural", "Natural", "Respira, deja pausas cortas"], ["dinamico", "Dinámico", "Ritmo de reels"], ["agresivo", "Agresivo", "Sin aire entre frases"]] as const).map(([id, label, sub]) => (
            <button key={id} className={ritmo === id ? "on" : ""} disabled={busy} onClick={() => setRitmo(id)}><b>{label}</b><small>{sub}</small></button>
          ))}
        </div>
        <label className="toggle">
          <input type="checkbox" checked={repetidas} disabled={busy} onChange={(e) => setRepetidas(e.target.checked)} />
          <span><b>Quitar tomas repetidas</b><small>Si empezaste una frase y la repetiste, se queda la última toma.</small></span>
        </label>
        <label className="toggle">
          <input type="checkbox" checked={muletillas} disabled={busy} onChange={(e) => setMuletillas(e.target.checked)} />
          <span><b>Quitar muletillas</b><small>eh, mmm… Nunca corta a mitad de palabra.</small></span>
        </label>
        <h3>Audio y ritmo</h3>
        <label className="toggle">
          <input type="checkbox" checked={mejorarAudio} disabled={busy} onChange={(e) => setMejorarAudio(e.target.checked)} />
          <span><b>Mejorar la voz</b><small>Quita ruido de fondo, da presencia y compresión. Volumen de redes (−14 LUFS).</small></span>
        </label>
        <div className="seg three">
          {[1, 1.1, 1.2].map((v) => <button key={v} className={velocidad === v ? "on" : ""} disabled={busy} onClick={() => setVelocidad(v)}><b>{v === 1 ? "Normal" : `${v}×`}</b><small>{v === 1 ? "como se grabó" : v === 1.1 ? "más ágil" : "ritmo TikTok"}</small></button>)}
        </div>
        <label className="toggle">
          <input type="checkbox" checked={srt} disabled={busy} onChange={(e) => setSrt(e.target.checked)} />
          <span><b>Subtítulos .srt</b><small>Para subir a YouTube, CapCut o Premiere.</small></span>
        </label>
        <h3>Formato</h3>
        <div className="seg two">
          <button className={formato === "vertical" ? "on" : ""} disabled={busy} onClick={() => setFormato("vertical")}><b>Vertical 9:16</b><small>1080×1920, rellena</small></button>
          <button className={formato === "original" ? "on" : ""} disabled={busy} onClick={() => setFormato("original")}><b>Original</b><small>Tamaño del clip 1</small></button>
        </div>

        {phase === "review" ? (
          <>
            <p className="hint">Revisa los cortes de cada clip a la izquierda (clic en un tramo para conservarlo). Quedará en ≈ {fmt(estimado)}.</p>
            <button className="btn primary big" onClick={renderizar}><Icon name="bolt" /> Renderizar video</button>
          </>
        ) : (
          <>
            <button className="btn primary big" disabled={!online || busy || !items.length} onClick={() => create(true)}>
              <Icon name="bolt" /> {busy ? "Trabajando…" : "Analizar cortes"}
            </button>
            <button className="btn ghost" disabled={!online || busy || !items.length} onClick={() => create(false)}>Hacer todo de una (sin revisar)</button>
            {usaWhisper && <p className="hint">Usa Whisper para leer las palabras: el análisis tarda un poco más.</p>}
          </>
        )}
        {!online && <p className="hint">Enciende el bridge (<code>npm run dev</code>) para procesar.</p>}

        {phase !== "idle" && (
          <div className="m-progress">
            <ol>
              {STEPS.filter((st) => phase !== "review" || st !== "Listo").map((s, i) => (
                <li key={s} className={phase === "done" || i < current ? "ok" : i === current && phase !== "error" ? "now" : ""}>{s}</li>
              ))}
            </ol>
            {busy && <div className="bar"><i style={{ width: `${pct}%` }} /></div>}
            {busy && <small>{phase === "uploading" ? `Subiendo ${Math.round(upload * items.length)} de ${items.length}` : job?.step}</small>}
            {phase === "error" && <p className="err">{job?.error}</p>}
          </div>
        )}

        {phase === "done" && job?.web && (
          <div className="m-result">
            <video src={bridge.abs(job.web)} controls playsInline />

            <div className="stats">
              <div><b>{fmt(before)}</b><small>antes</small></div>
              <div><b>{fmt(after)}</b><small>después</small></div>
              <div><b>−{Math.round((1 - after / Math.max(0.1, before)) * 100)}%</b><small>{(before - after).toFixed(1)} s menos</small></div>
            </div>
            <a className="btn primary" href={bridge.abs(job.web)} download="video-completo-redes.mp4"><Icon name="export" /> Descargar para redes · {job.webMB} MB</a>
            <a className="btn" href={bridge.abs(job.master!)} download="video-completo.mp4">Descargar master · {job.masterMB} MB</a>
            {job.srt && <a className="btn" href={bridge.abs(job.srt)} download="video-completo.srt">Descargar subtítulos .srt</a>}
            <button className="btn primary" onClick={() => onCrearVideo(job.id)}><Icon name="spark" /> Editarlo con una plantilla (Crear video)</button>
            <button className="btn ghost" onClick={() => openInEditor()}>Abrir en el editor rápido</button>
          </div>
        )}
      </aside>
    </div>
  );
}
