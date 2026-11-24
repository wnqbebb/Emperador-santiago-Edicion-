import { Composition } from "remotion";
import { SantiEdit, type SantiEditProps } from "./SantiEdit";
import { outDuration } from "../../shared/plan";
import imperial from "../../styles/imperial.json";
import type { Style } from "../../shared/types";

const FPS = 30;

// Props de ejemplo para Remotion Studio (npm run remotion:studio). El bridge las reemplaza al renderizar.
const demo: SantiEditProps = {
  videoSrc: "https://remotion.media/video.mp4",
  style: imperial as Style,
  words: "Así se construye un imperio paso a paso".split(" ").map((w, i) => ({ w, t0: 0.3 + i * 0.4, t1: 0.65 + i * 0.4 })),
  plan: {
    summary: "demo",
    segments: [{ start: 0, end: 4 }],
    emphasis: ["imperio"],
    zooms: [{ at: 1.5, dur: 1.2, scale: 1.15 }],
    motion: [
      { kind: "title", start: 0, end: 2.2, text: "El secreto del imperio" },
      { kind: "emojiPop", start: 1.6, end: 2.8, text: "👑" },
      { kind: "progress", start: 0, end: 4, text: "" },
    ],
  },
};

export const RemotionRoot = () => (
  <Composition
    id="SantiEdit"
    component={SantiEdit}
    width={1080}
    height={1920}
    fps={FPS}
    durationInFrames={120}
    defaultProps={demo}
    calculateMetadata={({ props }) => ({
      durationInFrames: Math.max(1, Math.round(outDuration(props.plan.segments) * FPS)),
    })}
  />
);
