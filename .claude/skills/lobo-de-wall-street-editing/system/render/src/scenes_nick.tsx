// Estilo Nick Saraev (styles/nick-saraev): lienzo oscuro o claro, título arriba (sans + serif itálica sobre caja azul), VENTANA
// enmarcada (borde azul fino + asas de selección tipo Figma) con la herramienta, él en un recuadro redondeado abajo cortado por el
// borde, subtítulo de 1–3 palabras en el hueco. Cierre «comment PALABRA». Medido en 20 reels (≈340 escenas). Tiempos ABSOLUTOS (s).
import React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { FaceCrop, TOPS, TopP } from "./scenes_kallaway";

type P = { props: any; dur: number; project: string; video: string; start: number };
const SANS = "'Inter'";
const SERIF = "'Instrument Serif'";
const W = 1080, H = 1920;
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
export const NICK = { blue: "#0282FB", border: "#1D82E0", face: "#5276D5", dark: "#0C0C0C", light: "#DFEAF0", key: "#2898F8" };

/** lienzo: oscuro (con la misma pantalla desenfocada si hay media) o claro con grano */
export const Canvas: React.FC<{ kind?: string; grid?: boolean }> = ({ kind = "dark", grid }) => {
  const light = kind === "light";
  return (
    <AbsoluteFill style={{ background: light ? NICK.light : kind === "white" ? "#fff" : `radial-gradient(ellipse at 50% 35%, #2a2a2a, ${NICK.dark} 70%)` }}>
      {grid ? <AbsoluteFill style={{ backgroundImage: `linear-gradient(${light ? "rgba(0,0,0,.06)" : "rgba(255,255,255,.05)"} 1px, transparent 1px), linear-gradient(90deg, ${light ? "rgba(0,0,0,.06)" : "rgba(255,255,255,.05)"} 1px, transparent 1px)`, backgroundSize: "54px 54px" }} /> : null}
      <AbsoluteFill style={{ opacity: light ? 0.08 : 0.05, backgroundImage: "radial-gradient(#000 1px, transparent 1px)", backgroundSize: "4px 4px" }} />
    </AbsoluteFill>
  );
};

/** marco de selección: borde azul fino + 4 asas cuadradas; entra «redimensionándose» desde ~70 % en 0.35 s */
const Frame: React.FC<{ x: number; y: number; w: number; h: number; k: number; radius?: number; children: React.ReactNode; handles?: boolean }> = ({ x, y, w, h, k, radius = 14, children, handles = true }) => {
  const s = 0.7 + 0.3 * k;
  return (
    <div style={{ position: "absolute", left: x, top: y, width: w, height: h, transform: `scale(${s})`, transformOrigin: "0% 0%", opacity: Math.min(1, k * 2) }}>
      <div style={{ position: "absolute", inset: 0, borderRadius: radius, overflow: "hidden", background: "#0e0e10", boxShadow: `0 0 0 3px ${NICK.border}, 0 0 40px ${NICK.border}55` }}>{children}</div>
      {handles ? [[0, 0], [1, 0], [0, 1], [1, 1]].map(([a, b], i) => <div key={i} style={{ position: "absolute", left: a * w - 9, top: b * h - 9, width: 18, height: 18, background: "#fff", border: `3px solid ${NICK.border}`, borderRadius: 3 }} />) : null}
    </div>
  );
};

/** título del video: línea 1 sans + línea 2 serif itálica blanca sobre caja azul */
const Title: React.FC<{ l1?: string; l2?: string; light: boolean; k: number }> = ({ l1, l2, light, k }) => (
  <div style={{ position: "absolute", left: 0, right: 0, top: H * 0.115, display: "flex", flexDirection: "column", alignItems: "center", gap: 10, opacity: k, transform: `translateY(${(1 - k) * -20}px)` }}>
    {l1 ? <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: 60, color: light ? "#111" : "#fff", letterSpacing: "-0.02em" }}>{l1}</div> : null}
    {l2 ? <div style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: 74, color: "#fff", background: NICK.blue, padding: "0 22px", lineHeight: 1.15 }}>{l2}</div> : null}
  </div>
);

// ── n_frame: título opcional + ventana + (cara en recuadro abajo | sin cara) ────────────────────────────────────────
export const NFrame: React.FC<P> = ({ props: p, project, video, start }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const k = interpolate(f, [0, Math.round(0.35 * fps)], [p.no_enter ? 1 : 0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  const face = p.face_box !== false;
  const titled = !!(p.title1 || p.title2);
  const y0 = titled ? H * 0.268 : H * 0.133, y1 = face ? H * 0.508 : H * 0.665;
  const x = W * 0.09, w = W * 0.82, h = y1 - y0;
  const top = p.top ?? { kind: "media" };
  const T = (TOPS as Record<string, React.FC<TopP>>)[top.kind ?? "media"] ?? TOPS.media;
  const light = p.canvas === "light" || p.canvas === "white";
  const fk = interpolate(f, [0, 5], [p.no_enter ? 1 : 0, 1], clamp);
  return (
    <AbsoluteFill>
      <Canvas kind={p.canvas} grid={p.grid} />
      {titled ? <Title l1={p.title1} l2={p.title2} light={light} k={interpolate(f, [0, 6], [0, 1], clamp)} /> : null}
      <Frame x={x} y={y0} w={w} h={h} k={k}><T p={top} project={project} start={start} w={w} h={h} /></Frame>
      {face ? (
        <div style={{ position: "absolute", left: W * 0.102, top: H * 0.705 + (1 - fk) * 200, width: W * 0.795, height: H * 0.4, borderRadius: 32, overflow: "hidden", boxShadow: `0 0 0 6px ${NICK.face}, 0 0 50px ${NICK.face}66` }}>
          <FaceCrop video={video} start={start} w={W * 0.795} h={H * 0.4} face={p.face} zoom={p.zoom ?? 1.1} cy={0.3} />
        </div>
      ) : null}
    </AbsoluteFill>
  );
};

// ── n_cta: él a pantalla completa con «comment» en serif itálica y la PALABRA en caja de selección ───────────────────
export const NCta: React.FC<P> = ({ props: p, dur }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const k1 = interpolate(f, [0, 6], [0, 1], clamp), tw = Math.round((p.word_s ?? 0.5) * fps), k2 = interpolate(f, [tw, tw + 6], [0, 1], { ...clamp, easing: Easing.out(Easing.back(1.6)) });
  const o = interpolate(f, [dur - 4, dur - 1], [1, 0], clamp);
  return (
    <AbsoluteFill style={{ opacity: o }}>
      <div style={{ position: "absolute", left: 0, right: 0, top: H * 0.64, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
        <div style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: 92, color: "#fff", opacity: k1, textShadow: "0 4px 24px rgba(0,0,0,.6)" }}>comment</div>
        <div style={{ position: "relative", transform: `scale(${0.6 + 0.4 * k2})`, opacity: k2 }}>
          <div style={{ fontFamily: SANS, fontWeight: 800, fontSize: 104, letterSpacing: "-0.03em", padding: "0 26px", backgroundImage: `linear-gradient(180deg, ${p.c1 ?? "#BBFDFE"}, ${p.c2 ?? "#47A9B6"})`, WebkitBackgroundClip: "text", color: "transparent", filter: `drop-shadow(0 0 22px ${p.c2 ?? "#47A9B6"}aa)` }}>“{p.word}”</div>
          <div style={{ position: "absolute", inset: -6, border: `3px solid ${NICK.border}` }} />
        </div>
      </div>
    </AbsoluteFill>
  );
};

export const NICK_REGISTRY: Record<string, React.FC<any>> = { n_frame: NFrame, n_cta: NCta };
