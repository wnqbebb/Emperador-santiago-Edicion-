// Tipos compartidos con el bridge (bridge/src/schema.ts es la fuente de verdad del plan).
export type Word = { w: string; t0: number; t1: number };
export type Segment = { start: number; end: number };
export type MotionKind = "title" | "lowerThird" | "emojiPop" | "highlightBox" | "counter" | "progress";
export type Motion = { kind: MotionKind; start: number; end: number; text: string };
export type Zoom = { at: number; dur: number; scale: number };

export type Plan = {
  summary: string;
  segments: Segment[];
  emphasis: string[];
  zooms: Zoom[];
  motion: Motion[];
};

export type Style = {
  id: string;
  name: string;
  description: string;
  caption: {
    font: string; weight: number; size: number; color: string; highlight: string; stroke: string;
    uppercase: boolean; wordsPerChunk: number; animation: "pop" | "karaoke" | "fade" | "bounce"; position: number;
  };
  pacing: { maxSilence: number; zoomEvery: number; cutsPerMinute: number };
  motion: { emojis: boolean; hookTitle: boolean; progress: boolean; lowerThird: boolean };
  grade: { contrast: number; saturate: number; brightness: number };
  notes: string;
};

export type Chunk = { start: number; end: number; words: Word[] };
