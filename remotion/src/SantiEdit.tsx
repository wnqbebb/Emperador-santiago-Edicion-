// Composición de Remotion: renderiza el mismo Plan (EDL) que el editor web, cuadro a cuadro y con calidad máxima.
import "@fontsource/anton/400.css";
import "@fontsource/oswald/700.css";
import "@fontsource/playfair-display/500.css";
import "@fontsource/space-grotesk/700.css";
import "@fontsource/inter/600.css";
import { AbsoluteFill, Easing, interpolate, OffthreadVideo, Sequence, spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { Motion, Plan, Style, Word } from "../../shared/types";
import { chunkWords, isEmphasis, keptWords, outDuration, outToSrc, srcToOut } from "../../shared/plan";

export type SantiEditProps = { videoSrc: string; plan: Plan; words: Word[]; style: Style };

export const SantiEdit = ({ videoSrc, plan, words, style }: SantiEditProps) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const tOut = frame / fps;
  const t = outToSrc(plan.segments, tOut); // tiempo del original

  let acc = 0;
  const seqs = plan.segments.map((s) => {
    const from = Math.round(acc * fps);
    const dur = Math.max(1, Math.round((s.end - s.start) * fps));
    acc += s.end - s.start;
    return { s, from, dur };
  });

  let zoom = 1;
  for (const z of plan.zooms) {
    if (t >= z.at && t <= z.at + z.dur) {
      const p = (t - z.at) / z.dur;
      const env = p < 0.25 ? Easing.out(Easing.cubic)(p / 0.25) : p > 0.8 ? 1 - Easing.out(Easing.cubic)((p - 0.8) / 0.2) : 1;
      zoom = 1 + (z.scale - 1) * env;
    }
  }
  const g = style.grade;
  const chunks = chunkWords(keptWords(words, plan.segments), style.caption.wordsPerChunk);
  const chunk = chunks.find((c) => t >= c.start - 0.05 && t <= c.end + 0.12);

  return (
    <AbsoluteFill style={{ backgroundColor: "black" }}>
      <AbsoluteFill style={{ transform: `scale(${zoom})`, filter: `contrast(${g.contrast}) saturate(${g.saturate}) brightness(${g.brightness})` }}>
        {seqs.map(({ s, from, dur }, i) => (
          <Sequence key={i} from={from} durationInFrames={dur} premountFor={fps}>
            <OffthreadVideo src={videoSrc} trimBefore={Math.round(s.start * fps)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          </Sequence>
        ))}
      </AbsoluteFill>
      <AbsoluteFill style={{ background: "linear-gradient(180deg, transparent 55%, rgba(0,0,0,.45))" }} />
      {plan.motion.filter((m) => m.kind !== "emojiPop" && t >= m.start && t <= m.end).map((m, i) => (
        <MotionLayer key={i} m={m} t={t} style={style} plan={plan} fps={fps} />
      ))}
      {chunk && <Caption words={chunk.words} start={chunk.start} t={t} style={style} plan={plan} />}
      {plan.motion.filter((m) => m.kind === "emojiPop" && t >= m.start && t <= m.end).map((m, i) => (
        <MotionLayer key={`e${i}`} m={m} t={t} style={style} plan={plan} fps={fps} />
      ))}
    </AbsoluteFill>
  );
};

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const easeOut = (x: number) => Easing.out(Easing.cubic)(clamp01(x));

function Caption({ words, start, t, style, plan }: { words: Word[]; start: number; t: number; style: Style; plan: Plan }) {
  const c = style.caption;
  const size = c.size * 1920;
  const appear = easeOut((t - start) / 0.18);
  return (
    <AbsoluteFill style={{ top: c.position * 1920 - size, height: "auto", bottom: "auto", alignItems: "center" }}>
      <div style={{ width: 920, textAlign: "center", fontFamily: `"${c.font}", sans-serif`, fontWeight: c.weight, fontSize: size, lineHeight: 1.18, opacity: c.animation === "fade" ? appear : 1, textTransform: c.uppercase ? "uppercase" : "none" }}>
        {words.map((w, i) => {
          const spoken = t >= w.t0;
          const active = spoken && t <= w.t1 + 0.05;
          if (c.animation === "pop" && !spoken) return <span key={i} style={{ visibility: "hidden" }}>{w.w} </span>;
          const emph = isEmphasis(plan, w.w);
          let color = emph ? c.highlight : c.color;
          if (c.animation === "karaoke") color = spoken ? color : "rgba(255,255,255,0.38)";
          const scale = c.animation === "pop" && active ? 1 + 0.22 * (1 - easeOut((t - w.t0) / 0.14)) : 1;
          const dy = c.animation === "bounce" && spoken ? -size * 0.12 * (1 - easeOut((t - w.t0) / 0.25)) : 0;
          return (
            <span key={i} style={{
              display: "inline-block", marginRight: size * 0.28, color, transform: `translateY(${dy}px) scale(${scale})`,
              WebkitTextStroke: c.stroke !== "transparent" ? `${size * 0.08}px ${c.stroke}` : undefined, paintOrder: "stroke fill",
              textShadow: c.animation === "karaoke" && active ? `0 0 28px ${c.highlight}` : c.stroke === "transparent" ? "0 4px 18px rgba(0,0,0,.55)" : undefined,
            }}>{w.w}</span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
}

function MotionLayer({ m, t, style, plan, fps }: { m: Motion; t: number; style: Style; plan: Plan; fps: number }) {
  const accent = style.caption.highlight;
  const font = `"${style.caption.font}", sans-serif`;
  const p = (t - m.start) / Math.max(0.01, m.end - m.start);
  const vis = Math.min(easeOut((t - m.start) / 0.35), easeOut((m.end - t) / 0.3));
  const pop = spring({ frame: Math.round((t - m.start) * fps), fps, config: { damping: 9 } });
  switch (m.kind) {
    case "title":
      return (
        <AbsoluteFill style={{ top: 230, height: "auto", alignItems: "center", opacity: vis, transform: `translateY(${(1 - vis) * -40}px)` }}>
          <div style={{ padding: "26px 40px", borderRadius: 26, background: "rgba(12,12,16,.72)", color: "#fff", fontFamily: font, fontWeight: 800, fontSize: 54, maxWidth: 900, textAlign: "center", textTransform: style.caption.uppercase ? "uppercase" : "none", borderBottom: `8px solid ${accent}` }}>{m.text}</div>
        </AbsoluteFill>
      );
    case "lowerThird": {
      const [name, role = ""] = m.text.split("|");
      return (
        <div style={{ position: "absolute", left: 60 - (1 - vis) * 300, top: 1075, opacity: vis, display: "flex" }}>
          <div style={{ width: 10, background: accent }} />
          <div style={{ background: "rgba(10,10,14,.78)", padding: "16px 30px", minWidth: 480 }}>
            <div style={{ color: "#fff", fontFamily: font, fontWeight: 700, fontSize: 46 }}>{name.trim()}</div>
            <div style={{ color: "rgba(255,255,255,.7)", fontFamily: "Inter", fontSize: 30 }}>{role.trim()}</div>
          </div>
        </div>
      );
    }
    case "emojiPop":
      return <div style={{ position: "absolute", left: 842 - 75, top: 960 - 90 - Math.sin(p * Math.PI) * 30, fontSize: 150, transform: `scale(${pop * Math.min(1, (m.end - t) / 0.3)}) rotate(${(1 - pop) * -34}deg)` }}>{m.text}</div>;
    case "highlightBox":
      return (
        <AbsoluteFill style={{ top: 520, height: "auto", alignItems: "center", opacity: vis }}>
          <div style={{ background: accent, color: "#0b0b0f", fontFamily: font, fontWeight: 800, fontSize: 64, padding: "18px 40px", borderRadius: 18, transform: `rotate(-2deg) scale(${0.9 + 0.1 * pop})` }}>{m.text}</div>
        </AbsoluteFill>
      );
    case "counter": {
      const target = parseFloat(m.text.replace(/[^\d.]/g, "")) || 0;
      const prefix = m.text.match(/^\D*/)?.[0] ?? "", suffix = m.text.match(/\D*$/)?.[0] ?? "";
      const val = Math.round(interpolate(p, [0, 0.62], [0, target], { extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) }));
      return (
        <AbsoluteFill style={{ top: 520, height: "auto", alignItems: "center", opacity: vis }}>
          <div style={{ color: accent, fontFamily: font, fontWeight: 900, fontSize: 150, textShadow: `0 0 40px ${accent}` }}>{prefix}{val.toLocaleString("es")}{suffix}</div>
        </AbsoluteFill>
      );
    }
    case "progress": {
      const prog = srcToOut(plan.segments, t) / (outDuration(plan.segments) || 1);
      return (
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 10, background: "rgba(255,255,255,.18)" }}>
          <div style={{ height: "100%", width: `${prog * 100}%`, background: accent }} />
        </div>
      );
    }
  }
}
