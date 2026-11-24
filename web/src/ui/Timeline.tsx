import type { Chunk, Plan } from "../engine/types";

export function Timeline(props: { duration: number; t: number; plan: Plan | null; chunks: Chunk[]; onSeek: (s: number) => void }) {
  const { duration, t, plan, chunks, onSeek } = props;
  const pct = (s: number) => `${(s / (duration || 1)) * 100}%`;
  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    onSeek(((e.clientX - r.left) / r.width) * duration);
  };
  return (
    <div className="timeline" onClick={seek}>
      <div className="ruler">{Array.from({ length: Math.ceil(duration / 5) + 1 }, (_, i) => <span key={i} style={{ left: pct(i * 5) }}>{i * 5}s</span>)}</div>
      <Track label="Video">
        {(plan?.segments ?? (duration ? [{ start: 0, end: duration }] : [])).map((s, i) => (
          <div key={i} className="clip video" style={{ left: pct(s.start), width: pct(s.end - s.start) }} />
        ))}
      </Track>
      <Track label="Texto">
        {chunks.map((c, i) => (
          <div key={i} className="clip text" style={{ left: pct(c.start), width: pct(Math.max(0.2, c.end - c.start)) }}>{c.words.map((w) => w.w).join(" ")}</div>
        ))}
      </Track>
      <Track label="Motion">
        {(plan?.motion ?? []).filter((m) => m.kind !== "progress").map((m, i) => (
          <div key={i} className={`clip motion ${m.kind}`} style={{ left: pct(m.start), width: pct(m.end - m.start) }}>{m.text}</div>
        ))}
        {(plan?.zooms ?? []).map((z, i) => <div key={`z${i}`} className="clip zoom" style={{ left: pct(z.at), width: pct(z.dur) }} />)}
      </Track>
      <div className="overlay"><div className="playhead" style={{ left: pct(t) }} /></div>
    </div>
  );
}

function Track({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="track"><span className="track-label">{label}</span><div className="lane">{children}</div></div>;
}
