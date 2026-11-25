// Estilo Kallaway (styles/kallaway): pantalla dividida evidencia/cara, franja del gancho, círculo con la cara sobre material
// a pantalla completa. Medidas sacadas de 20 reels (styles/kallaway/references): costura 47.7–50.7 %, cortes secos en la palabra.
// Todos los tiempos de props son ABSOLUTOS (s del transcript); `start` = inicio de la escena.
import React from "react";
import { AbsoluteFill, Easing, Img, OffthreadVideo, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { roles, useStyle } from "./kit";

type P = { props: any; dur: number; project: string; video: string; start: number };
const SANS = "'Inter'";
const W = 1080, H = 1920;
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const out3 = Easing.bezier(0.16, 1, 0.3, 1);
const src = (project: string, p: string) => (p.startsWith("http") ? p : staticFile(`${project}/${p}`));
const isVid = (p?: string) => !!p && /\.(mp4|mov|webm|m4v)$/i.test(p);
export const KAL = { ink: "#0B0B0D", red: "#8B1A1E", yellow: "#F5B942", hi: "rgba(255,221,51,.62)" };
// Emperador Santiago: los colores de Kallaway siguen la paleta del proyecto (con la paleta del estilo quedan igual)
const applyKal = (pal: any) => {
  if (!pal) return;
  KAL.red = pal.vibrant_dark ?? "#8B1A1E";
  KAL.yellow = pal.highlight ?? pal.vibrant_bright ?? "#F5B942";
  const y = KAL.yellow.replace("#", "");
  KAL.hi = y.length === 6 ? `rgba(${parseInt(y.slice(0, 2), 16)},${parseInt(y.slice(2, 4), 16)},${parseInt(y.slice(4, 6), 16)},.55)` : KAL.hi;
};

const useT = (start: number) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  return { f, fps, t: start + f / fps, at: (x?: number) => (x === undefined ? 0 : Math.round((x - start) * fps)) };
};
/** aparece en su palabra: 0→1 en `n` frames */
const pop = (f: number, f0: number, n = 5) => interpolate(f, [f0, f0 + n], [0, 1], { ...clamp, easing: out3 });

/** A-roll recortado dentro de una caja: la cara (fracciones del video fuente) queda en (cx, cy) de la caja */
export const FaceCrop: React.FC<{ video: string; start: number; w: number; h: number; face?: any; zoom?: number; cx?: number; cy?: number }> = ({ video, start, w, h, face, zoom = 1, cx = 0.5, cy = 0.42 }) => {
  const { fps } = useVideoConfig();
  const fa = { x: 0.5, y: 0.36, ...(face ?? {}) };
  const s = Math.max(w / W, h / H) * zoom;
  const vw = W * s, vh = H * s;
  const left = Math.min(0, Math.max(w - vw, w * cx - fa.x * vw));
  const top = Math.min(0, Math.max(h - vh, h * cy - fa.y * vh));
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", background: "#000" }}>
      <OffthreadVideo muted src={staticFile(video)} startFrom={Math.round(start * fps)} style={{ position: "absolute", left, top, width: vw, height: vh, objectFit: "cover" }} />
    </div>
  );
};

// ── contenidos de la mitad superior ─────────────────────────────────────────────────────────────────────────────
type TopP = { p: any; project: string; start: number; w: number; h: number };

/** material real (captura, foto, video): corte interno, zoom lento, resaltado amarillo que barre, etiquetas y flecha */
const TopMedia: React.FC<TopP> = ({ p, project, start, w, h }) => {
  const { f, t, at, fps } = useT(start);
  const media: string[] = p.media ?? [];
  const cuts: number[] = p.cuts ?? [];
  let i = 0;
  cuts.forEach((c, k) => { if (t >= c) i = Math.min(k + 1, media.length - 1); });
  const f0 = i === 0 ? 0 : at(cuts[i - 1]);
  const k = (f - f0) / (fps * 3);
  const mv = p.move ?? "in";
  const sc = mv === "in" ? 1.02 + 0.07 * k : mv === "out" ? 1.1 - 0.07 * k : 1.04;
  const ty = mv === "scroll" ? -Math.min(1, k * 1.2) * (p.scroll ?? 18) : 0;
  const m = media[i];
  const st: React.CSSProperties = { position: "absolute", inset: 0, width: "100%", height: mv === "scroll" ? "auto" : "100%", objectFit: p.fit ?? "cover", objectPosition: p.pos ?? "50% 30%", transform: `translateY(${ty}%) scale(${sc})`, transformOrigin: p.origin ?? "50% 40%" };
  const hl = p.highlight;
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", background: p.bg ?? KAL.ink }}>
      {m ? (isVid(m) ? <OffthreadVideo muted src={src(project, m)} style={st} /> : <Img src={src(project, m)} style={st} />) : <Placeholder label={p.placeholder ?? "MATERIAL"} />}
      {hl ? <div style={{ position: "absolute", left: `${hl.x * 100}%`, top: `${hl.y * 100}%`, height: `${hl.h * 100}%`, width: `${hl.w * 100 * pop(f, at(hl.t), 9)}%`, background: KAL.hi, mixBlendMode: "multiply", borderRadius: 4 }} /> : null}
      {(p.labels ?? []).map((l: any, j: number) => {
        const a = pop(f, at(l.t), 5);
        return (
          <div key={j} style={{ position: "absolute", left: `${l.x * 100}%`, top: `${l.y * 100}%`, transform: `translate(-50%,-50%) scale(${0.8 + 0.2 * a})`, opacity: a, fontFamily: SANS, fontWeight: 900, fontSize: l.px ?? 54, color: l.color ?? "#fff", background: l.box ? KAL.red : "transparent", padding: l.box ? "6px 18px" : 0, borderRadius: 10, WebkitTextStroke: l.box ? "0" : "10px #000", paintOrder: "stroke fill", letterSpacing: "-0.02em", whiteSpace: "nowrap" }}>{l.text}</div>
        );
      })}
      {p.arrow ? <Arrow a={p.arrow} k={pop(f, at(p.arrow.t), 8)} w={w} h={h} /> : null}
    </div>
  );
};

const Arrow: React.FC<{ a: any; k: number; w: number; h: number }> = ({ a, k, w, h }) => {
  const x1 = a.x1 * w, y1 = a.y1 * h, x2 = a.x2 * w, y2 = a.y2 * h;
  const mx = (x1 + x2) / 2 + (y2 - y1) * 0.25, my = (y1 + y2) / 2 - (x2 - x1) * 0.25;
  const len = Math.hypot(x2 - x1, y2 - y1) * 1.15;
  const ang = (Math.atan2(y2 - my, x2 - mx) * 180) / Math.PI;
  return (
    <svg width={w} height={h} style={{ position: "absolute", inset: 0 }}>
      <path d={`M${x1},${y1} Q${mx},${my} ${x2},${y2}`} fill="none" stroke={a.color ?? KAL.yellow} strokeWidth={10} strokeLinecap="round" strokeDasharray={len} strokeDashoffset={len * (1 - k)} />
      {k > 0.95 ? <polygon points="0,-20 36,0 0,20" fill={a.color ?? KAL.yellow} transform={`translate(${x2},${y2}) rotate(${ang}) translate(-14,0)`} /> : null}
    </svg>
  );
};

const Placeholder: React.FC<{ label: string }> = ({ label }) => (
  <AbsoluteFill style={{ background: "repeating-linear-gradient(45deg,#17171b,#17171b 28px,#1d1d22 28px,#1d1d22 56px)", justifyContent: "center", alignItems: "center" }}>
    <div style={{ fontFamily: SANS, fontWeight: 800, fontSize: 44, color: "rgba(255,255,255,.55)", border: "3px dashed rgba(255,255,255,.35)", padding: "18px 30px", borderRadius: 16, textAlign: "center", maxWidth: "80%" }}>{label}</div>
  </AbsoluteFill>
);

/** chat (cliente que pregunta): burbujas que aparecen en su palabra; si no caben, la conversación sube */
const TopChat: React.FC<TopP> = ({ p, start, h }) => {
  const { f, at } = useT(start);
  const msgs: any[] = p.messages ?? [];
  const shown = msgs.filter((m) => f >= at(m.t));
  const rowH = 112, head = 120;
  const over = Math.max(0, shown.length * rowH + head + 30 - h);
  return (
    <div style={{ position: "absolute", inset: 0, background: "#0B141A", overflow: "hidden" }}>
      <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: head, background: "#1F2C34", display: "flex", alignItems: "center", gap: 26, padding: "0 44px", zIndex: 2 }}>
        <div style={{ width: 72, height: 72, borderRadius: 72, background: "#6B7C85" }} />
        <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: 42, color: "#E9EDEF" }}>{p.title ?? "Cliente"}</div>
        {p.badge ? <div style={{ marginLeft: "auto", fontFamily: SANS, fontWeight: 900, fontSize: 40, color: "#0B141A", background: "#25D366", borderRadius: 40, padding: "4px 22px" }}>{shown.length}</div> : null}
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: head + 22 - over }}>
        {msgs.map((m, i) => {
          const a = pop(f, at(m.t), 4);
          return (
            <div key={i} style={{ height: rowH, display: "flex", justifyContent: m.me ? "flex-end" : "flex-start", padding: "0 40px", opacity: a, transform: `translateY(${(1 - a) * 26}px) scale(${0.94 + 0.06 * a})`, transformOrigin: m.me ? "100% 50%" : "0% 50%" }}>
              <div style={{ alignSelf: "center", fontFamily: SANS, fontWeight: 600, fontSize: 52, color: "#E9EDEF", background: m.me ? "#005C4B" : "#202C33", borderRadius: 22, padding: "16px 28px", maxWidth: "82%", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.text}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

/** casillas (la publicación con N fotos): cada casilla se llena en su palabra; vacías = borde punteado */
const TopSlots: React.FC<TopP> = ({ p, project, start }) => {
  const { f, at } = useT(start);
  const slots: any[] = p.slots ?? [];
  const n = slots.length || 3;
  const gap = 26, sw = (W - 120 - gap * (n - 1)) / n, sh = sw * 1.3;
  return (
    <AbsoluteFill style={{ background: p.bg ?? KAL.ink, justifyContent: "center", alignItems: "center", flexDirection: "column", gap: 34 }}>
      {p.title ? <div style={{ fontFamily: SANS, fontWeight: 800, fontSize: 56, color: "#fff", letterSpacing: "-0.03em" }}>{p.title}</div> : null}
      <div style={{ display: "flex", gap }}>
        {slots.map((s, i) => {
          const a = s.t === undefined ? 1 : pop(f, at(s.t), 5);
          const on = a > 0 && !s.empty;
          const hot = s.hot !== undefined && f >= at(s.hot);
          return (
            <div key={i} style={{ width: sw, height: sh, borderRadius: 22, overflow: "hidden", position: "relative", border: on ? `5px solid ${hot ? KAL.yellow : "rgba(255,255,255,.9)"}` : "5px dashed rgba(255,255,255,.28)", background: on ? "#1c1c21" : "transparent", transform: `scale(${on ? 0.9 + 0.1 * a : 1})`, boxShadow: hot ? `0 0 44px ${KAL.yellow}88` : "none" }}>
              {on && s.media ? <Img src={src(project, s.media)} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: s.pos ?? "50% 30%" }} /> : null}
              {!on || !s.media ? <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", fontFamily: SANS, fontWeight: 900, fontSize: 110, color: on ? KAL.yellow : "rgba(255,255,255,.25)" }}>{on ? s.icon ?? i + 1 : "?"}</AbsoluteFill> : null}
              {on && s.label ? <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, padding: "34px 10px 12px", background: "linear-gradient(transparent, rgba(0,0,0,.85))", fontFamily: SANS, fontWeight: 800, fontSize: 34, color: "#fff", textAlign: "center" }}>{s.label}</div> : null}
            </div>
          );
        })}
      </div>
      {p.caption ? <div style={{ fontFamily: SANS, fontWeight: 600, fontSize: 40, color: "rgba(255,255,255,.7)" }}>{p.caption}</div> : null}
    </AbsoluteFill>
  );
};

/** cifra gigante (amarilla) con etiqueta; con `vs` son dos cifras enfrentadas */
const TopNumber: React.FC<TopP> = ({ p, start }) => {
  const { f, at } = useT(start);
  const items: any[] = p.vs ? [p, p.vs] : [p];
  return (
    <AbsoluteFill style={{ background: p.bg ?? KAL.ink, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 70 }}>
      {items.map((it, i) => {
        const a = pop(f, at(it.t), 6);
        const dim = i === 0 && p.vs && f >= at(p.vs.t);
        return (
          <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", opacity: a * (dim ? 0.35 : 1), transform: `scale(${0.8 + 0.2 * a})` }}>
            <div style={{ fontFamily: SANS, fontWeight: 900, fontSize: Math.min(p.vs ? 300 : 380, (p.vs ? 440 : 900) / (String(it.value).length * 0.6)), lineHeight: 0.9, letterSpacing: "-0.06em", color: it.color ?? (i === 0 && p.vs ? "#fff" : KAL.yellow) }}>{it.value}</div>
            <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: 48, color: "#fff", marginTop: 18, textAlign: "center", maxWidth: 460, lineHeight: 1.1 }}>{it.label}</div>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

/** lista numerada: cada punto entra en su palabra, el actual en amarillo */
const TopList: React.FC<TopP> = ({ p, start }) => {
  const { f, at } = useT(start);
  const items: any[] = p.items ?? [];
  const cur = items.reduce((acc, it, i) => (f >= at(it.t) ? i : acc), -1);
  return (
    <AbsoluteFill style={{ background: p.bg ?? KAL.ink, justifyContent: "center", padding: "0 90px", gap: 30 }}>
      {p.title ? <div style={{ fontFamily: SANS, fontWeight: 900, fontSize: 60, color: "#fff", letterSpacing: "-0.03em", marginBottom: 10 }}>{p.title}</div> : null}
      {items.map((it, i) => {
        const a = pop(f, at(it.t), 5);
        return (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 30, opacity: a * (i === cur ? 1 : 0.5), transform: `translateX(${(1 - a) * 60}px)` }}>
            <div style={{ width: 92, height: 92, borderRadius: 92, background: i === cur ? KAL.yellow : "rgba(255,255,255,.16)", color: i === cur ? KAL.ink : "#fff", fontFamily: SANS, fontWeight: 900, fontSize: 54, display: "flex", justifyContent: "center", alignItems: "center", flexShrink: 0 }}>{i + 1}</div>
            <div style={{ fontFamily: SANS, fontWeight: 800, fontSize: 58, color: "#fff", letterSpacing: "-0.03em", lineHeight: 1.05 }}>{it.text}</div>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

const TOPS: Record<string, React.FC<TopP>> = { media: TopMedia, chat: TopChat, slots: TopSlots, number: TopNumber, list: TopList };

// ── k_split: evidencia arriba, cara abajo ───────────────────────────────────────────────────────────────────────
export const KSplit: React.FC<P> = ({ props: p, project, video, start }) => {
  applyKal((useStyle() as any).palette);
  const { style } = useStyle();
  const r = p.ratio ?? style.kallaway?.split_ratio ?? 0.49;
  const seam = Math.round(H * r);
  const top = p.top ?? { kind: "media" };
  const T = TOPS[top.kind ?? "media"] ?? TopMedia;
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <div style={{ position: "absolute", left: 0, top: 0, width: W, height: seam, overflow: "hidden" }}><T p={top} project={project} start={start} w={W} h={seam} /></div>
      <div style={{ position: "absolute", left: 0, top: seam, width: W, height: H - seam, overflow: "hidden" }}>
        <FaceCrop video={video} start={start} w={W} h={H - seam} face={p.face} zoom={p.zoom ?? 1} cy={p.face_cy ?? 0.6} />
        <AbsoluteFill style={{ background: "linear-gradient(rgba(0,0,0,.38), transparent 26%)" }} />
      </div>
    </AbsoluteFill>
  );
};

// ── k_pip: material a pantalla completa con la cara en un círculo ───────────────────────────────────────────────
export const KPip: React.FC<P> = ({ props: p, project, video, start }) => {
  applyKal((useStyle() as any).palette);
  const { f } = useT(start);
  const d = p.pip_size ?? 310;
  const a = pop(f, 0, 5);
  const top = p.top ?? { kind: "media", media: p.media, cuts: p.cuts };
  const T = TOPS[top.kind ?? "media"] ?? TopMedia;
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <T p={top} project={project} start={start} w={W} h={H} />
      {p.pip === false ? null : (
        <div style={{ position: "absolute", left: 70, top: 250, width: d, height: d, borderRadius: d, overflow: "hidden", boxShadow: "0 10px 40px rgba(0,0,0,.55)", transform: `scale(${0.7 + 0.3 * a})`, opacity: a }}>
          <FaceCrop video={video} start={start} w={d} h={d} face={p.face} zoom={p.pip_zoom ?? 2.1} cy={0.5} />
        </div>
      )}
    </AbsoluteFill>
  );
};

// ── k_hook: franja del gancho pegada encima de la costura, entra deslizando desde la derecha ────────────────────
export const KHook: React.FC<P> = ({ props: p, dur }) => {
  applyKal((useStyle() as any).palette);
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const ctx = useStyle();
  const r = p.ratio ?? ctx.style.kallaway?.split_ratio ?? 0.49;
  const seam = Math.round(H * r);
  const v = p.variant ?? "red";
  const bg = v === "black" ? "#0B0B0D" : v === "white" ? "#F7F5F0" : v === "brand" ? roles(ctx).accent : KAL.red;
  const c1 = v === "white" ? "#0B0B0D" : "#fff";
  const c2 = v === "white" ? "#B8862B" : KAL.yellow;
  const x = interpolate(f, [0, Math.round((p.slide_s ?? 0.9) * fps)], [W, 0], { ...clamp, easing: out3 });
  const o = interpolate(f, [dur - 4, dur - 1], [1, 0], clamp);
  const lines = [p.line1, p.line2].filter(Boolean);
  const hgt = lines.length > 1 ? 168 : 104;
  const fit = (s: string) => Math.min(66, (W * 0.86) / (s.length * 0.72));
  return (
    <AbsoluteFill style={{ opacity: o }}>
      <div style={{ position: "absolute", left: 48, right: 48, top: seam - hgt - 6, height: hgt, borderRadius: 18, background: bg, transform: `translateX(${x}px)`, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", boxShadow: "0 8px 30px rgba(0,0,0,.45)" }}>
        {lines.map((l: string, i: number) => (
          <div key={i} style={{ fontFamily: SANS, fontWeight: 900, fontSize: fit(l), lineHeight: 1.08, color: i === lines.length - 1 && lines.length > 1 ? c2 : c1, textTransform: "uppercase", letterSpacing: "0.01em", transform: "scaleX(1.12)", whiteSpace: "nowrap" }}>{l}</div>
        ))}
      </div>
    </AbsoluteFill>
  );
};

export const KALLAWAY_REGISTRY: Record<string, React.FC<any>> = { k_split: KSplit, k_pip: KPip, k_hook: KHook };
