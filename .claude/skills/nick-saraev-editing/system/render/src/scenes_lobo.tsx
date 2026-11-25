// Estilo Lobo de Wall Street (styles/lobo-de-wall-street): look casual de celular o estudio con micrófono. Subtítulo blanco bold
// sobre el pecho, frase clave AMARILLA ~2× que se escribe letra a letra, objeto/cifra sobre la cabeza, lista numerada amarilla en
// itálica, foto insertada bajo el subtítulo, clip de película a pantalla completa con él abajo a la izquierda, tarjeta de comentario
// arriba y tarjeta de perfil con clic «Follow → Following». Medido en 17 reels válidos (392 escenas). Tiempos ABSOLUTOS (s).
import React from "react";
import { AbsoluteFill, Easing, Img, OffthreadVideo, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { FaceCrop } from "./scenes_kallaway";

type P = { props: any; dur: number; project: string; video: string; start: number };
const SANS = "'Inter'";
const W = 1080, H = 1920;
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
export const LOBO = { yellow: "#F2D10F", purple: "#8B5CF6" };
const src = (project: string, p: string) => (p.startsWith("http") ? p : staticFile(`${project}/${p}`));
const isVid = (p?: string) => !!p && /\.(mp4|mov|webm|m4v)$/i.test(p);
const useT = (start: number) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  return { f, fps, at: (x?: number) => (x === undefined ? 0 : Math.round((x - start) * fps)) };
};
const Media: React.FC<{ m?: string; project: string; style?: React.CSSProperties; label?: string }> = ({ m, project, style, label }) =>
  m ? (isVid(m) ? <OffthreadVideo muted src={src(project, m)} style={{ width: "100%", height: "100%", objectFit: "cover", ...style }} /> : <Img src={src(project, m)} style={{ width: "100%", height: "100%", objectFit: "cover", ...style }} />)
    : <AbsoluteFill style={{ background: "repeating-linear-gradient(45deg,#1a1a1a,#1a1a1a 26px,#222 26px,#222 52px)", justifyContent: "center", alignItems: "center", fontFamily: SANS, fontWeight: 800, fontSize: 40, color: "rgba(255,255,255,.55)", textAlign: "center", padding: 30, whiteSpace: "pre-line" }}>{label ?? "material"}</AbsoluteFill>;

// ── l_icon: objeto 3D (imagen) o cifra/palabra gigante sobre o detrás de la cabeza, entra con la palabra ──────────────
export const LIcon: React.FC<P> = ({ props: p, dur, project, start }) => {
  const { f, at } = useT(start);
  const k = interpolate(f, [at(p.t ?? start), at(p.t ?? start) + 7], [0, 1], { ...clamp, easing: Easing.out(Easing.back(1.6)) });
  const o = interpolate(f, [dur - 4, dur - 1], [1, 0], clamp);
  const mode = p.enter ?? "drop";
  const tr = mode === "slide" ? `translateX(${(1 - k) * 600}px) rotate(${(1 - k) * 25 + (p.tilt ?? -12)}deg)` : mode === "pop" ? `scale(${0.3 + 0.7 * k}) rotate(${p.tilt ?? -12}deg)` : `translateY(${(1 - k) * -500}px) rotate(${p.tilt ?? -12}deg)`;
  const w = W * (p.w ?? 0.5);
  return (
    <AbsoluteFill style={{ opacity: o }}>
      <div style={{ position: "absolute", left: (W - w) / 2, top: H * (p.y ?? 0.17) - w * 0.4, width: w, height: w * 0.8, display: "flex", justifyContent: "center", alignItems: "center", transform: tr, opacity: Math.min(1, k * 1.5) }}>
        {p.media ? <Img src={src(project, p.media)} style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain", filter: "drop-shadow(0 18px 30px rgba(0,0,0,.55))" }} />
          : p.text ? <div style={{ fontFamily: SANS, fontWeight: 900, fontStyle: "italic", fontSize: p.px ?? 300, color: p.color ?? "#fff", letterSpacing: "-0.05em", textShadow: "0 10px 40px rgba(0,0,0,.6)", WebkitTextStroke: p.stroke ? `6px ${LOBO.yellow}` : undefined }}>{p.text}</div>
          : <div style={{ width: w * 0.62, height: w * 0.62, border: `6px dashed ${LOBO.yellow}`, borderRadius: 24, display: "flex", justifyContent: "center", alignItems: "center", fontFamily: SANS, fontWeight: 800, fontSize: 40, color: "#fff", textAlign: "center", padding: 20, background: "rgba(0,0,0,.35)", whiteSpace: "pre-line" }}>{p.placeholder ?? "objeto 3D"}</div>}
      </div>
    </AbsoluteFill>
  );
};

// ── l_list: número amarillo en itálica a la izquierda + título blanco en itálica mayúsculas ──────────────────────────
export const LList: React.FC<P> = ({ props: p, dur }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const k1 = interpolate(f, [0, 5], [0, 1], clamp), k2 = interpolate(f, [Math.round(0.45 * fps), Math.round(0.45 * fps) + 5], [0, 1], clamp);
  const o = interpolate(f, [dur - 4, dur - 1], [1, 0], clamp);
  return (
    <AbsoluteFill style={{ opacity: o }}>
      <div style={{ position: "absolute", left: W * 0.08, top: H * (p.y ?? 0.16), display: "flex", alignItems: "center", gap: 26 }}>
        <div style={{ fontFamily: SANS, fontWeight: 900, fontStyle: "italic", fontSize: 150, color: LOBO.yellow, lineHeight: 1, opacity: k1, transform: `scale(${0.7 + 0.3 * k1})`, textShadow: "0 6px 24px rgba(0,0,0,.6)" }}>{p.n}</div>
        <div style={{ fontFamily: SANS, fontWeight: 900, fontStyle: "italic", fontSize: 58, color: "#fff", textTransform: "uppercase", lineHeight: 1.02, opacity: k2, transform: `translateX(${(1 - k2) * -40}px)`, maxWidth: W * 0.62, textShadow: "0 4px 18px rgba(0,0,0,.7)" }}>{p.title}</div>
      </div>
    </AbsoluteFill>
  );
};

// ── l_insert: foto rectangular sin borde bajo el subtítulo, corte seco (varias en el mismo sitio) ────────────────────
export const LInsert: React.FC<P> = ({ props: p, project, start }) => {
  const { f, at } = useT(start);
  const items: any[] = p.items ?? [{ media: p.media, t: start, label: p.placeholder }];
  const cur = items.reduce((a, it, i) => (f >= at(it.t) ? i : a), 0);
  const w = W * (p.w ?? 0.52), h = w * (p.ratio ?? 0.72);
  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", left: (W - w) / 2, top: H * (p.y ?? 0.67), width: w, height: h, overflow: "hidden", boxShadow: "0 12px 40px rgba(0,0,0,.5)" }}>
        <Media m={items[cur].media} project={project} label={items[cur].label} />
      </div>
    </AbsoluteFill>
  );
};

// ── l_movie: clip a pantalla completa; en el look casual, él abajo a la izquierda (recortado o en recuadro) ──────────
export const LMovie: React.FC<P> = ({ props: p, project, video, start }) => {
  const f = useCurrentFrame();
  const z = 1 + (p.push ?? 0) * (f / 120);
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <AbsoluteFill style={{ transform: `scale(${z})` }}><Media m={p.media} project={project} label={p.placeholder ?? "clip de película\n(tú lo eliges)"} /></AbsoluteFill>
      {p.me === false ? null : p.matte
        ? <OffthreadVideo muted transparent src={src(project, p.matte)} style={{ position: "absolute", left: -W * 0.06, top: H * 0.47, width: W * 0.62, height: H * 0.62 * 0.62 * 1.1, objectFit: "cover" }} />
        : <div style={{ position: "absolute", left: 0, top: H * 0.48, width: W * 0.5, height: H * 0.36, overflow: "hidden" }}><FaceCrop video={video} start={start} w={W * 0.5} h={H * 0.36} face={p.face} zoom={1.05} cy={0.4} /></div>}
    </AbsoluteFill>
  );
};

// ── l_comment: tarjeta blanca redondeada arriba con el comentario/pregunta que él responde ───────────────────────────
export const LComment: React.FC<P> = ({ props: p, dur }) => {
  const f = useCurrentFrame();
  const o = interpolate(f, [dur - 3, dur - 1], [1, 0], clamp);
  return (
    <AbsoluteFill style={{ opacity: o }}>
      <div style={{ position: "absolute", left: W * 0.105, width: W * 0.79, top: H * 0.105, background: "#fff", borderRadius: 18, padding: "22px 28px", boxShadow: "0 10px 34px rgba(0,0,0,.35)", display: "flex", gap: 18 }}>
        <div style={{ width: 56, height: 56, borderRadius: 56, background: "linear-gradient(135deg,#999,#555)", flexShrink: 0 }} />
        <div>
          <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: 28, color: "#111" }}>{p.user ?? "cliente"} <span style={{ fontWeight: 400, color: "#888" }}>· 2 h</span></div>
          <div style={{ fontFamily: SANS, fontWeight: 500, fontSize: 36, color: "#111", lineHeight: 1.2, marginTop: 4 }}>{p.text}</div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ── l_follow: tarjeta de perfil con cursor que pulsa «Follow» → «Following» ──────────────────────────────────────────
export const LFollow: React.FC<P> = ({ props: p, project }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const k = interpolate(f, [0, 6], [0, 1], { ...clamp, easing: Easing.out(Easing.back(1.5)) });
  const tc = Math.round((p.click_s ?? 0.7) * fps);
  const cx = interpolate(f, [4, tc], [W * 0.95, W * 0.72], { ...clamp, easing: Easing.inOut(Easing.cubic) }), cy = interpolate(f, [4, tc], [H * 0.84, H * (p.y ?? 0.69) + 52], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  const on = f >= tc, press = f >= tc && f < tc + 4 ? 0.92 : 1;
  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", left: W * 0.15, width: W * 0.7, top: H * (p.y ?? 0.69), height: 104, background: "#fff", borderRadius: 26, display: "flex", alignItems: "center", padding: "0 22px", gap: 18, transform: `scale(${k})`, boxShadow: "0 10px 34px rgba(0,0,0,.4)" }}>
        <div style={{ width: 66, height: 66, borderRadius: 66, overflow: "hidden", background: "#333", flexShrink: 0 }}>{p.avatar ? <Img src={src(project, p.avatar)} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : null}</div>
        <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: 34, color: "#111", flex: 1 }}>{p.handle ?? "tu_marca"}</div>
        <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: 30, color: "#fff", background: on ? LOBO.purple : "#0095F6", borderRadius: 14, padding: "12px 24px", transform: `scale(${press})` }}>{on ? "Following" : "Follow"}</div>
      </div>
      <svg width={60} height={60} viewBox="0 0 24 24" style={{ position: "absolute", left: cx, top: cy, opacity: k }}><path d="M3 2l7 19 2.6-7.4L20 11z" fill="#fff" stroke="#000" strokeWidth={1.4} strokeLinejoin="round" /></svg>
    </AbsoluteFill>
  );
};

// ── l_full: gráfico sobre negro con grano (cifra o frase), entra deslizando con desenfoque ───────────────────────────
export const LFull: React.FC<P> = ({ props: p, dur, project }) => {
  const f = useCurrentFrame();
  const k = interpolate(f, [0, 7], [0, 1], clamp), o = interpolate(f, [dur - 4, dur - 1], [1, 0], clamp);
  return (
    <AbsoluteFill style={{ background: "#050505", justifyContent: "center", alignItems: "center", flexDirection: "column", gap: 30 }}>
      <AbsoluteFill style={{ opacity: 0.12, backgroundImage: "radial-gradient(rgba(255,255,255,.6) 1px, transparent 1px)", backgroundSize: "5px 5px" }} />
      <div style={{ opacity: k * o, filter: `blur(${(1 - k) * 14}px)`, transform: `translateX(${(1 - k) * 160}px)`, textAlign: "center" }}>
        {p.media ? <div style={{ width: W * 0.7, height: W * 0.7, margin: "0 auto" }}><Img src={src(project, p.media)} style={{ width: "100%", height: "100%", objectFit: "contain" }} /></div> : null}
        {p.big ? <div style={{ fontFamily: SANS, fontWeight: 900, fontStyle: "italic", fontSize: Math.min(300, 880 / (String(p.big).length * 0.58)), color: LOBO.yellow, letterSpacing: "-0.04em", lineHeight: 1 }}>{p.big}</div> : null}
        {p.text ? <div style={{ fontFamily: SANS, fontWeight: 800, fontSize: 56, color: "#fff", marginTop: 18, padding: "0 80px" }}>{p.text}</div> : null}
      </div>
    </AbsoluteFill>
  );
};

export const LOBO_REGISTRY: Record<string, React.FC<any>> = { l_icon: LIcon, l_list: LList, l_insert: LInsert, l_movie: LMovie, l_comment: LComment, l_follow: LFollow, l_full: LFull };
