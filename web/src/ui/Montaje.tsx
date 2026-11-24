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

export function Montaje({ online, onOpenInEditor }: { online: boolean; onOpenInEditor: (f: File) => void }) {
  const [items, setItems] = useState<Item[]>([]);
  const [ritmo, setRitmo] = useState<Ritmo>("dinamico");
  const [muletillas, setMuletillas] = useState(false);
  const [formato, setFormato] = useState<"vertical" | "original">("vertical");
  const [phase, setPhase] = useState<"idle" | "uploading" | "working" | "done" | "error">("idle");
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

  async function create() {
    setPhase("uploading"); setUpload(0); setJob(null);
    try {
      const clips: { mediaId: string; name: string }[] = [];
      for (const [i, it] of items.entries()) {
        const { mediaId } = await bridge.uploadMedia(it.file);
        clips.push({ mediaId, name: it.file.name });
        setUpload((i + 1) / items.length);
      }
      setPhase("working");
      let j = await bridge.startMontaje({ clips, ritmo, muletillas, formato });
      setJob(j);
      while (j.status === "running") { await new Promise((r) => setTimeout(r, 800)); j = await bridge.getMontaje(j.id); setJob(j); }
      setPhase(j.status === "done" ? "done" : "error");
    } catch (e) {
      setJob({ id: "", status: "error", step: "", progress: 0, clips: [], error: (e as Error).message });
      setPhase("error");
    }
  }

  async function openInEditor() {
    if (!job?.master) return;
    const blob = await (await fetch(bridge.abs(job.master))).blob();
    onOpenInEditor(new File([blob], "video-completo.mp4", { type: "video/mp4" }));
  }

  const busy = phase === "uploading" || phase === "working";
  const before = job?.clips.reduce((t, c) => t + c.before, 0) ?? 0;
  const after = job?.clips.reduce((t, c) => t + c.after, 0) ?? 0;
  const current = stepIndex(job?.step ?? "", phase === "uploading");
  const pct = phase === "uploading" ? upload * 100 : (job?.progress ?? 0) * 100;

  return (
    <div className="montaje">
      <section className="m-main">
        <header className="m-head">
          <div>
            <h1>Unión de clips y recortes de silencio</h1>
            <p>Sube tus clips, revisa el orden y crea el video completo: sin silencios, unido, renderizado y comprimido.</p>
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
                        <div className="m-bar" title={`${rep.cuts} cortes`}>
                          {rep.keep.map(([a, b], k) => <i key={k} style={{ left: `${(a / rep.before) * 100}%`, width: `${((b - a) / rep.before) * 100}%` }} />)}
                        </div>
                      )}
                      {rep && <small className="m-saved">{rep.before.toFixed(1)} s → {rep.after.toFixed(1)} s · {rep.cuts} cortes{rep.fillers ? ` · ${rep.fillers} muletillas` : ""}</small>}
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
          <input type="checkbox" checked={muletillas} disabled={busy} onChange={(e) => setMuletillas(e.target.checked)} />
          <span><b>Quitar muletillas</b><small>eh, mmm… con Whisper. Más lento, cortes más precisos.</small></span>
        </label>
        <h3>Formato</h3>
        <div className="seg two">
          <button className={formato === "vertical" ? "on" : ""} disabled={busy} onClick={() => setFormato("vertical")}><b>Vertical 9:16</b><small>1080×1920, rellena</small></button>
          <button className={formato === "original" ? "on" : ""} disabled={busy} onClick={() => setFormato("original")}><b>Original</b><small>Tamaño del clip 1</small></button>
        </div>

        <button className="btn primary big" disabled={!online || busy || !items.length} onClick={create}>
          <Icon name="bolt" /> {busy ? "Trabajando…" : "Crear video completo"}
        </button>
        {!online && <p className="hint">Enciende el bridge (<code>npm run dev</code>) para procesar.</p>}

        {phase !== "idle" && (
          <div className="m-progress">
            <ol>
              {STEPS.map((s, i) => (
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
            <button className="btn ghost" onClick={openInEditor}>Abrir en el editor (subtítulos y estilo)</button>
          </div>
        )}
      </aside>
    </div>
  );
}
