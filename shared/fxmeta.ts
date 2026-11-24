// Metadatos de los efectos especiales (sin dependencias: los usan web, bridge, Remotion y HyperFrames).
export const INTRO3D_DURATION = 2.8;
export const PIXEL_FX_META: Record<string, { label: string; size: [number, number]; duration: number; scale: number; uso: string }> = {
  "firework-burst": { label: "Fuegos artificiales", size: [240, 248], duration: 3.6, scale: 3.4, uso: "celebraciones, logros, anuncios" },
  "cartoon-pow": { label: "¡POW! cómic", size: [184, 144], duration: 1.05, scale: 4, uso: "golpes de efecto, sorpresas, remates" },
  confetti: { label: "Confeti", size: [200, 140], duration: 3.4, scale: 4.6, uso: "victorias, cierres, buenas noticias" },
  "coin-collect": { label: "Monedas", size: [176, 116], duration: 2.45, scale: 4.4, uso: "dinero, ventas, ganancias" },
  "lightning-strike": { label: "Rayo", size: [240, 264], duration: 3, scale: 3.6, uso: "energía, impacto, ideas fuertes" },
  sunburst: { label: "Resplandor", size: [128, 128], duration: 4, scale: 6, uso: "revelaciones, momentos épicos" },
};
export const PIXEL_FX_IDS = Object.keys(PIXEL_FX_META);

export function fxDuration(kind: string, id: string) {
  return kind === "intro3d" ? INTRO3D_DURATION : (PIXEL_FX_META[id]?.duration ?? 2);
}

/** Caja del efecto en el lienzo de salida 1080×1920. */
export function fxBox(kind: string, id: string) {
  if (kind === "intro3d") return { x: 140, y: 420, w: 800, h: 800 };
  const m = PIXEL_FX_META[id];
  if (!m) return { x: 0, y: 0, w: 0, h: 0 };
  const w = m.size[0] * m.scale, h = m.size[1] * m.scale;
  return { x: 540 - w / 2, y: 820 - h / 2, w, h };
}
