// Estilo Pedro Buerbaum (styles/pedro-buerbaum): busto parlante minimal y elegante. Plano único cuyo zoom nunca para,
// golpes de zoom en la palabra con carga, palabra grande color arena DETRÁS de la cabeza, panel negro arriba con gráfico de
// línea fina, video en tarjeta redondeada sobre negro. Medido en 20 reels (495 escenas). Tiempos de props ABSOLUTOS (s).
import React from "react";
import { AbsoluteFill, Easing, Img, OffthreadVideo, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { useStyle } from "./kit";
import { FaceCrop } from "./scenes_kallaway";

type P = { props: any; dur: number; project: string; video: string; start: number };
const SANS = "'Inter'";
const SERIF = "'Playfair Display'";
const W = 1080, H = 1920;
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const io = Easing.bezier(0.65, 0, 0.35, 1);
export const PED = { sand: "#EBB07B", sandDim: "#A9815D", white: "#F8F2F0", grey: "#D5D5D5" };
const src = (project: string, p: string) => (p.startsWith("http") ? p : staticFile(`${project}/${p}`));

/** escala del A-roll en el segundo t: deriva lenta que cambia de sentido + asentamiento inicial + golpes (p_punch) */
export const driftZ = (t: number, style: any, scenes: any[]) => {
  const d = style.aroll?.drift;
  if (!d) return { z: 1, blur: 0 };
  let z = 1 + (d.amount ?? 0.07) * (0.5 - 0.5 * Math.cos((2 * Math.PI * t) / (d.period_s ?? 22)));
  const s0 = d.settle_s ?? 0.13;
  const open = t < s0 ? 1 - t / s0 : 0;
  z += (d.settle ?? 0.15) * open;
  let blur = open * 14;
  for (const s of scenes) {
    if (s.type !== "p_punch") continue;
    const a = s.props?.amount ?? d.punch ?? 0.1, tin = s.props?.in_s ?? 0.3, tout = s.props?.out_s ?? 0.45;
    const k = interpolate(t, [s.start, s.start + tin, s.end - tout, s.end], [0, 1, 1, 0], { ...clamp, easing: io });
    z += a * k;
    if (t >= s.start && t < s.start + 0.1) blur = Math.max(blur, 5);
  }
  return { z, blur };
};

const useT = (start: number) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  return { f, fps, t: start + f / fps, at: (x?: number) => (x === undefined ? 0 : Math.round((x - start) * fps)) };
};
/** entra con desenfoque + fundido y sale igual (0.25 s / 0.2 s) */
const useInOut = (dur: number, f0 = 0) => {
  const f = useCurrentFrame();
  const a = interpolate(f, [f0, f0 + 8], [0, 1], clamp) * interpolate(f, [dur - 7, dur - 1], [1, 0], clamp);
  return { opacity: a, filter: `blur(${(1 - a) * 12}px)` };
};

/** el A-roll a pantalla completa con la MISMA escala que la capa base (para escenas que lo vuelven a dibujar) */
const PVideo: React.FC<{ video: string; start: number; file?: string; t0?: number; transparent?: boolean; project?: string }> = ({ video, start, file, t0, transparent, project }) => {
  const { style } = useStyle();
  const { t, fps } = useT(start);
  const { z } = driftZ(t, style, []);
  const oy = style.aroll?.punch_origin_y ?? 0.36;
  const st: React.CSSProperties = { width: "100%", height: "100%", objectFit: "cover", transform: `scale(${z})`, transformOrigin: `50% ${oy * 100}%` };
  return file
    ? <OffthreadVideo muted transparent={transparent} src={src(project!, file)} startFrom={Math.max(0, Math.round((start - (t0 ?? start)) * fps))} style={{ ...st, position: "absolute", inset: 0 }} />
    : <OffthreadVideo muted src={staticFile(video)} startFrom={Math.round(start * fps)} style={{ ...st, position: "absolute", inset: 0 }} />;
};

// ── p_word: palabra o cifra grande color arena en el tercio superior, DETRÁS de la cabeza ───────────────────────
export const PWord: React.FC<P> = ({ props: p, dur, project, video, start }) => {
  const { f, at, fps } = useT(start);
  const io_ = useInOut(dur);
  const words: any[] = p.words ?? [{ w: p.text ?? "", t: start }];
  const serif = !!p.serif;
  const txt = words.map((w) => w.w).join(" ");
  const px = Math.min(p.px ?? (p.front ? 112 : 128), (W * 0.9) / (Math.max(...txt.split("\n").map((l) => l.length)) * (serif ? 0.5 : 0.56)));
  let count: string | null = null;
  if (p.count) {
    const k = interpolate(f, [at(p.count.t), at(p.count.t) + Math.round((p.count.dur ?? 0.8) * fps)], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
    count = (p.count.prefix ?? "") + Math.round((p.count.from ?? 0) + (p.count.to - (p.count.from ?? 0)) * k).toLocaleString("es-ES") + (p.count.suffix ?? "");
  }
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <PVideo video={video} start={start} />
      <AbsoluteFill style={{ top: `${(p.y ?? (p.front ? 0.69 : 0.165)) * 100 - 8}%`, height: "16%", justifyContent: "center", alignItems: "center", ...io_ }}>
        <div style={{ fontFamily: serif ? SERIF : SANS, fontStyle: serif ? "italic" : "normal", fontWeight: serif ? 500 : 800, fontSize: px, letterSpacing: serif ? "-0.01em" : "-0.045em", lineHeight: 1, textAlign: "center", whiteSpace: "pre", textShadow: p.front ? "0 4px 26px rgba(0,0,0,.7)" : "none" }}>
          {count !== null ? <span style={{ color: PED.sand }}>{count}</span> : words.map((w, i) => {
            const k = interpolate(f, [at(w.t), at(w.t) + 5], [0, 1], clamp);
            return <span key={i} style={{ color: k > 0.5 ? PED.sand : PED.sandDim, opacity: 0.75 + 0.25 * k }}>{w.w}{i < words.length - 1 ? " " : ""}</span>;
          })}
        </div>
      </AbsoluteFill>
      {p.matte && !p.front ? <PVideo video={video} start={start} file={p.matte} t0={p.matte_t0} transparent project={project} /> : null}
    </AbsoluteFill>
  );
};

// ── gráficos de línea fina (panel superior o pantalla completa) ─────────────────────────────────────────────────
type G = { g: any; project: string; start: number; w: number; h: number };
const Blur: React.FC<{ k: number; children: React.ReactNode; style?: React.CSSProperties }> = ({ k, children, style }) => (
  <div style={{ opacity: k, filter: `blur(${(1 - k) * 10}px)`, transform: `translateY(${(1 - k) * 10}px)`, ...style }}>{children}</div>
);
const GFlow: React.FC<G> = ({ g, start, w }) => {
  const { f, at } = useT(start);
  const nodes: any[] = g.nodes ?? [];
  const nw = Math.min(250, (w - 80 - (nodes.length - 1) * 90) / nodes.length);
  return (
    <AbsoluteFill style={{ flexDirection: "row", justifyContent: "center", alignItems: "center" }}>
      {nodes.map((n, i) => {
        const k = interpolate(f, [at(n.t), at(n.t) + 8], [0, 1], clamp);
        return (
          <React.Fragment key={i}>
            {i > 0 ? <svg width={90} height={30} style={{ opacity: k }}><line x1={8} y1={15} x2={8 + 66 * k} y2={15} stroke="#fff" strokeWidth={3} strokeLinecap="round" strokeDasharray={n.dotted ? "2 9" : undefined} /><polyline points="64,6 76,15 64,24" fill="none" stroke="#fff" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" opacity={k > 0.9 ? 1 : 0} /></svg> : null}
            <Blur k={k} style={{ width: nw, display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
              <div style={{ width: nw * 0.8, height: nw * 0.8, borderRadius: n.round ? nw : 26, border: `3px solid ${n.hot ? PED.sand : "#fff"}`, display: "flex", justifyContent: "center", alignItems: "center", fontFamily: SANS, fontWeight: 300, fontSize: nw * 0.38, color: n.hot ? PED.sand : "#fff" }}>{n.icon ?? i + 1}</div>
              <div style={{ fontFamily: SANS, fontWeight: 400, fontSize: 38, color: PED.white, textAlign: "center", lineHeight: 1.1 }}>{n.label}</div>
            </Blur>
          </React.Fragment>
        );
      })}
    </AbsoluteFill>
  );
};
const GNumber: React.FC<G> = ({ g, start }) => {
  const { f, at, fps } = useT(start);
  const k = interpolate(f, [at(g.t), at(g.t) + 8], [0, 1], clamp);
  const c = g.count_to !== undefined ? Math.round(interpolate(f, [at(g.t), at(g.t) + Math.round(0.8 * fps)], [g.count_from ?? 0, g.count_to], { ...clamp, easing: Easing.out(Easing.cubic) })).toLocaleString("es-ES") : g.value;
  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", flexDirection: "column", gap: 14 }}>
      <Blur k={k}><div style={{ fontFamily: SANS, fontWeight: 800, fontSize: Math.min(g.px ?? 190, 900 / (String(c).length * 0.6)), letterSpacing: "-0.05em", color: g.color ?? PED.sand, lineHeight: 1 }}>{g.prefix ?? ""}{c}{g.suffix ?? ""}</div></Blur>
      {g.label ? <Blur k={interpolate(f, [at(g.t) + 6, at(g.t) + 14], [0, 1], clamp)}><div style={{ fontFamily: SANS, fontWeight: 400, fontSize: 40, color: PED.white }}>{g.label}</div></Blur> : null}
    </AbsoluteFill>
  );
};
const GCards: React.FC<G> = ({ g, project, start, h }) => {
  const { f, at } = useT(start);
  const cards: any[] = g.cards ?? [];
  const ch = Math.min(h * 0.74, 520), cw = ch * (2 / 3);
  return (
    <AbsoluteFill style={{ flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 46 }}>
      {cards.map((c, i) => {
        const k = interpolate(f, [at(c.t), at(c.t) + 8], [0, 1], clamp);
        return (
          <Blur key={i} k={k} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
            <div style={{ width: cw, height: ch, borderRadius: 27, border: "5px solid #fff", overflow: "hidden", background: "#141414", display: "flex", justifyContent: "center", alignItems: "center" }}>
              {c.media ? <Img src={src(project, c.media)} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <div style={{ fontFamily: SANS, fontWeight: 300, fontSize: 30, color: "rgba(255,255,255,.5)", textAlign: "center", padding: 16 }}>{c.placeholder ?? "foto"}</div>}
            </div>
            {c.label ? <div style={{ fontFamily: SANS, fontWeight: 400, fontSize: 32, color: PED.white }}>{c.label}</div> : null}
          </Blur>
        );
      })}
    </AbsoluteFill>
  );
};
/** frases entre comillas que entran con desenfoque y se tachan con una raya que se dibuja */
const GStrike: React.FC<G> = ({ g, start }) => {
  const { f, at } = useT(start);
  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", flexDirection: "column", gap: 34 }}>
      {(g.lines ?? []).map((l: any, i: number) => {
        const k = interpolate(f, [at(l.t), at(l.t) + 9], [0, 1], clamp);
        const s = l.strike_t === undefined ? 0 : interpolate(f, [at(l.strike_t), at(l.strike_t) + 14], [0, 1], { ...clamp, easing: io });
        return (
          <Blur key={i} k={k} style={{ position: "relative" }}>
            <div style={{ fontFamily: l.bold ? SANS : SANS, fontWeight: l.bold ? 800 : 400, fontSize: l.bold ? 78 : 50, color: l.bold ? PED.sand : PED.white, opacity: 1 - 0.5 * s, letterSpacing: "-0.02em", whiteSpace: "nowrap" }}>{l.text}</div>
            <div style={{ position: "absolute", left: "-3%", top: "52%", height: 4, width: `${106 * s}%`, background: "#fff", borderRadius: 4 }} />
          </Blur>
        );
      })}
    </AbsoluteFill>
  );
};
const GS: Record<string, React.FC<G>> = { flow: GFlow, number: GNumber, cards: GCards, strike: GStrike };
const Grid: React.FC = () => (
  <AbsoluteFill style={{ backgroundImage: "linear-gradient(rgba(255,255,255,.13) 2px, transparent 2px), linear-gradient(90deg, rgba(255,255,255,.13) 2px, transparent 2px)", backgroundSize: "135px 135px", maskImage: "radial-gradient(ellipse at 50% 50%, black 30%, transparent 75%)", WebkitMaskImage: "radial-gradient(ellipse at 50% 50%, black 30%, transparent 75%)" }} />
);

// ── p_split: panel negro arriba (≈36.5 %) con gráfico de línea; él abajo más abierto ────────────────────────────
export const PSplit: React.FC<P> = ({ props: p, dur, project, video, start }) => {
  const f = useCurrentFrame();
  const r = p.ratio ?? 0.365;
  const ph = Math.round(H * r);
  const kin = interpolate(f, [0, 4], [0, 1], clamp), kout = interpolate(f, [dur - 6, dur - 1], [1, 0], clamp);
  const g = p.graphic ?? {};
  const Gc = GS[g.kind ?? "flow"] ?? GFlow;
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <AbsoluteFill style={{ filter: `blur(${(1 - Math.min(kin, kout)) * 14}px)`, transform: `scale(${1.12 - 0.12 * kin})` }}>
        <div style={{ position: "absolute", left: 0, top: ph - 70, width: W, height: H - ph + 70, overflow: "hidden" }}>
          <FaceCrop video={video} start={start} w={W} h={H - ph + 70} face={p.face} zoom={p.zoom ?? 1} cy={p.face_cy ?? 0.5} />
        </div>
        <div style={{ position: "absolute", left: 0, top: 0, width: W, height: ph, background: "#000" }} />
        <div style={{ position: "absolute", left: 0, top: ph - 1, width: W, height: 60, background: "linear-gradient(#000, transparent)" }} />
      </AbsoluteFill>
      <div style={{ position: "absolute", left: 0, top: H * 0.1, width: W, height: ph - H * 0.1, opacity: kout }}>{g.grid ? <Grid /> : null}<Gc g={g} project={project} start={start} w={W} h={ph - H * 0.1} /></div>
    </AbsoluteFill>
  );
};

// ── p_full: gráfico a pantalla completa sobre negro, sin él ─────────────────────────────────────────────────────
export const PFull: React.FC<P> = ({ props: p, dur, project, start }) => {
  const f = useCurrentFrame();
  const o = interpolate(f, [0, 5], [0, 1], clamp) * interpolate(f, [dur - 5, dur - 1], [1, 0], clamp);
  const g = p.graphic ?? {};
  const Gc = GS[g.kind ?? "number"] ?? GNumber;
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <AbsoluteFill style={{ opacity: o, top: "22%", height: "50%" }}>{g.grid !== false ? <Grid /> : null}<Gc g={g} project={project} start={start} w={W} h={H * 0.5} /></AbsoluteFill>
    </AbsoluteFill>
  );
};

// ── p_card: el video encogido en una tarjeta redondeada sobre negro puro, con rótulo serif opcional ─────────────
export const PCard: React.FC<P> = ({ props: p, video, start }) => {
  const { f, at } = useT(start);
  const cw = W * (p.w ?? 0.84), ch = H * (p.h ?? 0.564);
  const top = (H - ch) / 2;
  const k = p.title ? interpolate(f, [at(p.title_t ?? start), at(p.title_t ?? start) + 8], [0, 1], clamp) : 0;
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <div style={{ position: "absolute", left: (W - cw) / 2, top, width: cw, height: ch, borderRadius: p.radius ?? 48, overflow: "hidden" }}>
        <FaceCrop video={video} start={start} w={cw} h={ch} face={p.face} zoom={p.zoom ?? 1} cy={p.face_cy ?? 0.42} />
      </div>
      {p.title ? <div style={{ position: "absolute", left: 0, right: 0, top: top - 150, textAlign: "center", fontFamily: p.sans ? SANS : SERIF, fontStyle: p.sans ? "normal" : "italic", fontWeight: p.sans ? 600 : 500, fontSize: p.px ?? 84, color: PED.white, opacity: k, filter: `blur(${(1 - k) * 10}px)` }}>{p.title}</div> : null}
    </AbsoluteFill>
  );
};

export const PEDRO_REGISTRY: Record<string, React.FC<any>> = { p_word: PWord, p_split: PSplit, p_full: PFull, p_card: PCard };
