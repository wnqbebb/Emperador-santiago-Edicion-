// Mis videos: todo lo que terminaste (Crear video y Unir clips). Vive en disco: no se pierde al cerrar o reiniciar.
import { useEffect, useState } from "react";
import * as bridge from "../engine/bridge";

const hace = (t: number) => {
  const m = Math.round((Date.now() - t) / 60000);
  if (m < 1) return "ahora"; if (m < 60) return `hace ${m} min`;
  const h = Math.round(m / 60); if (h < 24) return `hace ${h} h`;
  const d = Math.round(h / 24); return d < 7 ? `hace ${d} día${d > 1 ? "s" : ""}` : new Date(t).toLocaleDateString("es");
};
const ESTADO: Record<string, string> = { done: "Listo", review: "Listo para revisar", tablero: "En el tablero", running: "Trabajando…", error: "Detenido" };

export function Historial({ visible, onSeguir }: { visible: boolean; onSeguir: (id: string) => void }) {
  const [items, setItems] = useState<bridge.ItemHistorial[] | null>(null);
  const [filtro, setFiltro] = useState<"todo" | "crear" | "unir">("todo");
  const cargar = () => bridge.historial().then(setItems).catch(() => setItems([]));
  useEffect(() => { if (visible) cargar(); }, [visible]);
  useEffect(() => {                         // mientras haya algo trabajando, se actualiza solo
    if (!visible || !items?.some((i) => i.status === "running")) return;
    const t = setTimeout(cargar, 4000); return () => clearTimeout(t);
  }, [items, visible]);
  const lista = (items ?? []).filter((i) => filtro === "todo" || i.tipo === filtro);
  return (
    <div className="historial">
      <header className="h-head">
        <div><h1>Mis videos</h1><p>Todo lo que has hecho queda guardado aquí, aunque cierres el programa.</p></div>
        <div className="seg three h-filtro">
          {([["todo", "Todos"], ["crear", "Crear video"], ["unir", "Unir clips"]] as const).map(([id, l]) => <button key={id} className={filtro === id ? "on" : ""} onClick={() => setFiltro(id)}><b>{l}</b></button>)}
        </div>
      </header>
      {items === null ? <p className="hint">Cargando…</p> : !lista.length ? <p className="hint">Aún no hay videos aquí. Cuando termines uno, aparece solo.</p> : (
        <div className="h-grid">
          {lista.map((it) => (
            <div key={`${it.tipo}-${it.id}`} className="h-card">
              <div className="h-vid">
                {it.video ? <video src={`${bridge.abs(it.video)}#t=1`} preload="metadata" controls playsInline /> : <div className="h-sin">{it.status === "running" ? "Trabajando…" : "Sin video todavía"}</div>}
                <span className={`h-estado ${it.status}`}>{ESTADO[it.status] ?? it.status}</span>
              </div>
              <div className="h-info">
                <b title={it.titulo}>{it.titulo}</b>
                <small>{it.tipo === "unir" ? "Unir clips" : it.estilo} · {hace(it.fecha)}</small>
                <div className="h-acc">
                  {it.video && <a className="btn primary" href={bridge.abs(it.video)} download>Descargar</a>}
                  {it.tipo === "crear" && <button className="btn" onClick={() => onSeguir(it.id)}>Seguir editando</button>}
                  <button className="link h-quitar" title="Quitarlo de la lista (los archivos no se borran)" onClick={async () => { await bridge.ocultarHistorial(it.tipo, it.id); cargar(); }}>Quitar</button>
                </div>
                {it.extras.length > 0 && <div className="h-extras">{it.extras.map((e) => <a key={e.url} href={bridge.abs(e.url)} target="_blank" rel="noreferrer">{e.nombre}</a>)}</div>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
