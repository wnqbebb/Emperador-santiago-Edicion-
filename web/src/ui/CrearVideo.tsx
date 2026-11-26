// Crear video: un clip (ya unido o en bruto) + plantilla de estilo → el sistema te pregunta, propone el tablero y edita.
import { useEffect, useState } from "react";
import * as bridge from "../engine/bridge";
import { Icon } from "./Icon";
import { Plantillas, Catalogo, type Eleccion } from "./Plantillas";

type Props = { online: boolean; providers: bridge.Provider[] | null; desdeMontaje: string | null; reanudar?: string | null; onRapido: (f: File, styleId: string) => void; onIrAUnir: () => void };

// La sesión se guarda en el navegador: si cierras o recargas, vuelves al mismo video y al mismo paso.
const leer = <T,>(k: string): T | null => { try { return JSON.parse(localStorage.getItem(k) ?? "null"); } catch { return null; } };
const guardar = (k: string, v: unknown) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, JSON.stringify(v)); } catch { /* sin almacenamiento */ } };

export function CrearVideo({ online, providers, desdeMontaje, reanudar, onRapido, onIrAUnir }: Props) {
  const [fuente, setFuenteRaw] = useState<bridge.Fuente | null>(desdeMontaje ? { montajeId: desdeMontaje } : leer<bridge.Fuente>("emp.fuente"));
  const [flujoId, setFlujoId] = useState<string | null>(desdeMontaje ? null : leer<string>("emp.flujo"));
  const setFuente = (f: bridge.Fuente | null) => { setFuenteRaw(f); guardar("emp.fuente", f); };
  const alFlujo = (id: string | null) => { setFlujoId(id); guardar("emp.flujo", id); };
  // «Seguir editando» desde Mis videos
  useEffect(() => { if (reanudar) { bridge.getFlujo(reanudar).then(() => { setFuente({ flujoId: reanudar }); alFlujo(reanudar); setPreview(""); }).catch(() => null); } }, [reanudar]);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string>("");
  const [subiendo, setSubiendo] = useState(false);
  const [err, setErr] = useState("");
  const [eleccion, setEleccion] = useState<Eleccion>({});

  useEffect(() => { if (desdeMontaje) { setFuente({ montajeId: desdeMontaje }); alFlujo(null); setPreview(bridge.abs(`/montaje/${desdeMontaje}/video-completo-redes.mp4`)); } }, [desdeMontaje]);

  async function elegir(f: File) {
    setFile(f); setPreview(URL.createObjectURL(f)); setErr(""); setSubiendo(true); setFuente(null);
    try { const { mediaId } = await bridge.uploadMedia(f); alFlujo(null); setFuente({ mediaId }); }
    catch (e) { setErr((e as Error).message); }
    setSubiendo(false);
  }

  async function rapido(styleId: string) {
    const f = file ?? (fuente?.montajeId ? new File([await (await fetch(bridge.abs(`/montaje/${fuente.montajeId}/video-completo.mp4`))).blob()], "video-completo.mp4", { type: "video/mp4" }) : null);
    if (f) onRapido(f, styleId);
  }

  return (
    <div className="montaje crear">
      <section className="m-main">
        <header className="m-head">
          <div>
            <h1>Crear video</h1>
            <p>Sube tu clip, eliges el estilo y el sistema te pregunta cómo lo quieres: color de tu propio video, energía, texturas, b-roll. Luego diriges en el tablero y sale el borrador.</p>
            <ol className="wizard">
              <li className={fuente ? "ok" : "now"}>1 · Tu clip</li>
              <li className={fuente ? "now" : ""}>2 · Preguntas y estilo</li>
              <li>3 · Tablero de preedición</li>
              <li>4 · Borrador y aprobación</li>
            </ol>
          </div>
        </header>
        {fuente ? (
          <Plantillas key={fuente.montajeId ?? fuente.mediaId ?? flujoId ?? ""} fuente={fuente} providers={providers} onRapido={rapido} inicial={eleccion} flujoId={flujoId} onFlujo={alFlujo} />
        ) : (
          <div className="c-source">
            <label className="m-drop">
              <input type="file" accept="video/*" hidden disabled={!online || subiendo} onChange={(e) => e.target.files?.[0] && elegir(e.target.files[0])} />
              <Icon name="upload" />
              <div><strong>{subiendo ? "Subiendo…" : "Sube tu clip"}</strong><small>Un video ya unido o una sola toma en bruto. ¿Tienes varias tomas? Únelas primero.</small></div>
              <button type="button" className="btn ghost" onClick={(e) => { e.preventDefault(); onIrAUnir(); }}>Ir a Unir clips</button>
            </label>
            {!online && <p className="hint">Conectando con el motor…</p>}
            {err && <p className="err">{err}</p>}
            {eleccion.vari && <p className="gal-sel">Elegido: <b>{eleccion.vari}</b>{eleccion.sub ? <> · subtítulos <b>{eleccion.sub}</b></> : null}. Sube tu clip para empezar con esto.</p>}
            <Catalogo eleccion={eleccion} onChange={setEleccion} />
          </div>
        )}
      </section>
      <aside className="m-side">
        <h3>Tu clip</h3>
        {preview ? <video className="c-prev" src={preview} controls playsInline /> : <p className="hint">Aquí verás tu clip.</p>}
        {fuente && <button className="btn ghost" onClick={() => { setFuente(null); alFlujo(null); setPreview(""); setFile(null); }}>Nuevo video</button>}
      </aside>
    </div>
  );
}
