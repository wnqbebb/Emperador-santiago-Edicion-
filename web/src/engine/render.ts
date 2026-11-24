// Renderizador de cuadros: dibuja video + subtítulos animados + gráficos de movimiento en un <canvas>.
// Es lo mismo para la vista previa y para la exportación, así lo que ves es lo que se exporta.
import type { Chunk, Motion, Plan, Style } from "./types";
import { isEmphasis, outDuration, srcToOut } from "./plan";

export const OUT_W = 1080;
export const OUT_H = 1920;

const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const easeOut = (x: number) => 1 - Math.pow(1 - clamp(x), 3);
const easeOutBack = (x: number) => { const c = 1.9; x = clamp(x); return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); };

export type FrameInput = {
  ctx: CanvasRenderingContext2D;
  video: HTMLVideoElement;
  plan: Plan | null;
  chunks: Chunk[];
  style: Style;
  t: number; // tiempo del original
};

export function drawFrame({ ctx, video, plan, chunks, style, t }: FrameInput) {
  const W = ctx.canvas.width, H = ctx.canvas.height, k = W / OUT_W;
  ctx.save();
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, W, H);

  // --- Video (cover 9:16) + punch-in + color
  let zoom = 1;
  for (const z of plan?.zooms ?? []) {
    if (t >= z.at && t <= z.at + z.dur) {
      const p = (t - z.at) / z.dur;
      const env = p < 0.25 ? easeOut(p / 0.25) : p > 0.8 ? 1 - easeOut((p - 0.8) / 0.2) : 1;
      zoom = 1 + (z.scale - 1) * env;
    }
  }
  if (video.videoWidth) {
    const vr = video.videoWidth / video.videoHeight;
    let dw = W, dh = W / vr;
    if (dh < H) { dh = H; dw = H * vr; }
    dw *= zoom; dh *= zoom;
    const g = style.grade;
    ctx.filter = `contrast(${g.contrast}) saturate(${g.saturate}) brightness(${g.brightness})`;
    ctx.drawImage(video, (W - dw) / 2, (H - dh) / 2, dw, dh);
    ctx.filter = "none";
  }
  // Viñeta suave para legibilidad
  const vg = ctx.createLinearGradient(0, H * 0.55, 0, H);
  vg.addColorStop(0, "rgba(0,0,0,0)");
  vg.addColorStop(1, "rgba(0,0,0,0.45)");
  ctx.fillStyle = vg;
  ctx.fillRect(0, H * 0.55, W, H * 0.45);

  // --- Gráficos de movimiento (debajo de los subtítulos excepto emoji)
  for (const m of plan?.motion ?? []) if (t >= m.start && t <= m.end && m.kind !== "emojiPop") drawMotion(ctx, m, t, k, style, plan!);

  // --- Subtítulos
  const ch = chunks.find((c) => t >= c.start - 0.05 && t <= c.end + 0.12);
  if (ch) drawCaption(ctx, ch, t, k, style, plan);

  for (const m of plan?.motion ?? []) if (t >= m.start && t <= m.end && m.kind === "emojiPop") drawMotion(ctx, m, t, k, style, plan!);
  ctx.restore();
}

function drawCaption(ctx: CanvasRenderingContext2D, ch: Chunk, t: number, k: number, style: Style, plan: Plan | null) {
  const c = style.caption, W = ctx.canvas.width, H = ctx.canvas.height;
  const size = c.size * OUT_H * k;
  ctx.font = `${c.weight} ${size}px "${c.font}", system-ui, sans-serif`;
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  const words = ch.words.map((w) => ({ ...w, text: c.uppercase ? w.w.toUpperCase() : w.w }));
  const space = size * 0.28, maxW = W * 0.84;

  // Reparto en líneas
  const lines: { items: typeof words; width: number }[] = [{ items: [], width: 0 }];
  for (const w of words) {
    const ww = ctx.measureText(w.text).width;
    const line = lines[lines.length - 1];
    if (line.items.length && line.width + space + ww > maxW) lines.push({ items: [w], width: ww });
    else { line.width += (line.items.length ? space : 0) + ww; line.items.push(w); }
  }
  const lh = size * 1.18;
  const y0 = c.position * H - ((lines.length - 1) * lh) / 2;
  const appear = easeOut((t - ch.start) / 0.18);
  ctx.globalAlpha = c.animation === "fade" ? appear : 1;

  lines.forEach((line, li) => {
    let x = (W - line.width) / 2;
    const y = y0 + li * lh;
    for (const w of line.items) {
      const ww = ctx.measureText(w.text).width;
      const spoken = t >= w.t0;
      const active = t >= w.t0 && t <= w.t1 + 0.05;
      const emph = plan ? isEmphasis(plan, w.w) : false;
      let scale = 1, dy = 0;
      if (c.animation === "pop" && active) scale = 1 + 0.22 * (1 - easeOut((t - w.t0) / 0.14));
      if (c.animation === "bounce") dy = spoken ? -size * 0.12 * (1 - easeOutBack((t - w.t0) / 0.25)) : 0;
      if (c.animation === "pop" && !spoken) { x += ww + space; continue; } // pop: aparece palabra a palabra

      let color = c.color;
      if (emph) color = c.highlight;
      if (c.animation === "karaoke") color = spoken ? (emph ? c.highlight : c.color) : "rgba(255,255,255,0.38)";

      ctx.save();
      ctx.translate(x + ww / 2, y + dy);
      ctx.scale(scale, scale);
      if (c.animation === "karaoke" && active) { ctx.shadowColor = c.highlight; ctx.shadowBlur = 28 * k; }
      if (c.stroke !== "transparent") {
        ctx.strokeStyle = c.stroke;
        ctx.lineWidth = size * 0.16;
        ctx.strokeText(w.text, -ww / 2, 0);
      } else {
        ctx.shadowColor = ctx.shadowColor === "rgba(0, 0, 0, 0)" ? "rgba(0,0,0,0.55)" : ctx.shadowColor;
        ctx.shadowBlur = Math.max(ctx.shadowBlur, 18 * k);
      }
      ctx.fillStyle = color;
      ctx.fillText(w.text, -ww / 2, 0);
      ctx.restore();
      x += ww + space;
    }
  });
  ctx.globalAlpha = 1;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

function drawMotion(ctx: CanvasRenderingContext2D, m: Motion, t: number, k: number, style: Style, plan: Plan) {
  const W = ctx.canvas.width, H = ctx.canvas.height;
  const p = (t - m.start) / Math.max(0.01, m.end - m.start);
  const inP = easeOut((t - m.start) / 0.35), outP = easeOut((m.end - t) / 0.3);
  const vis = Math.min(inP, outP);
  const accent = style.caption.highlight;
  ctx.save();
  switch (m.kind) {
    case "title": {
      const size = 54 * k;
      ctx.font = `800 ${size}px "${style.caption.font}", system-ui`;
      const text = style.caption.uppercase ? m.text.toUpperCase() : m.text;
      const tw = Math.min(ctx.measureText(text).width, W * 0.8);
      const bw = tw + 70 * k, bh = size * 1.9, x = (W - bw) / 2, y = H * 0.12 - (1 - vis) * 40 * k;
      ctx.globalAlpha = vis;
      ctx.fillStyle = "rgba(12,12,16,0.72)";
      roundRect(ctx, x, y, bw, bh, 26 * k); ctx.fill();
      ctx.fillStyle = accent;
      roundRect(ctx, x, y + bh - 8 * k, bw * easeOut(p * 1.5), 8 * k, 4 * k); ctx.fill();
      ctx.fillStyle = "#fff"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(text, W / 2, y + bh / 2, W * 0.8);
      break;
    }
    case "lowerThird": {
      const [name, role = ""] = m.text.split("|");
      const x = 60 * k - (1 - vis) * 300 * k, y = H * 0.56;
      ctx.globalAlpha = vis;
      ctx.fillStyle = accent; ctx.fillRect(x, y, 10 * k, 120 * k);
      ctx.fillStyle = "rgba(10,10,14,0.78)"; ctx.fillRect(x + 10 * k, y, 520 * k * inP, 120 * k);
      ctx.fillStyle = "#fff"; ctx.font = `700 ${46 * k}px "${style.caption.font}", system-ui`; ctx.textBaseline = "top";
      ctx.fillText(name.trim(), x + 36 * k, y + 16 * k);
      ctx.fillStyle = "rgba(255,255,255,0.7)"; ctx.font = `500 ${30 * k}px Inter, system-ui`;
      ctx.fillText(role.trim(), x + 36 * k, y + 72 * k);
      break;
    }
    case "emojiPop": {
      const s = easeOutBack((t - m.start) / 0.35) * outP;
      ctx.translate(W * 0.78, H * 0.5 - Math.sin(p * Math.PI) * 30 * k);
      ctx.rotate((1 - s) * -0.6 + Math.sin(p * 6) * 0.05);
      ctx.scale(s, s);
      ctx.font = `${150 * k}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(m.text, 0, 0);
      break;
    }
    case "highlightBox": {
      ctx.globalAlpha = vis;
      ctx.font = `800 ${64 * k}px "${style.caption.font}", system-ui`;
      const tw = ctx.measureText(m.text).width, bw = tw + 80 * k, bh = 120 * k;
      ctx.translate(W / 2, H * 0.3); ctx.rotate(-0.03); ctx.scale(0.9 + 0.1 * inP, 0.9 + 0.1 * inP);
      ctx.fillStyle = accent; roundRect(ctx, -bw / 2, -bh / 2, bw, bh, 18 * k); ctx.fill();
      ctx.fillStyle = "#0b0b0f"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(m.text, 0, 4 * k);
      break;
    }
    case "counter": {
      const target = parseFloat(m.text.replace(/[^\d.]/g, "")) || 0;
      const prefix = m.text.match(/^\D*/)?.[0] ?? "", suffix = m.text.match(/\D*$/)?.[0] ?? "";
      const val = Math.round(target * easeOut(p * 1.6));
      ctx.globalAlpha = vis;
      ctx.font = `900 ${150 * k}px "${style.caption.font}", system-ui`;
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.shadowColor = accent; ctx.shadowBlur = 40 * k;
      ctx.fillStyle = accent;
      ctx.fillText(`${prefix}${val.toLocaleString("es")}${suffix}`, W / 2, H * 0.32);
      break;
    }
    case "progress": {
      const total = outDuration(plan.segments) || 1;
      const prog = srcToOut(plan.segments, t) / total;
      ctx.fillStyle = "rgba(255,255,255,0.18)"; ctx.fillRect(0, 0, W, 10 * k);
      ctx.fillStyle = accent; ctx.fillRect(0, 0, W * prog, 10 * k);
      break;
    }
  }
  ctx.restore();
}
