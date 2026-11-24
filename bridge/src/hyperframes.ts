// Convierte un Plan de edición en un PROYECTO HyperFrames (HTML + GSAP) editable y renderizable.
// El proyecto queda en disco: puedes abrirlo con `npx hyperframes preview` o en la app de HyperFrames.
import { copyFileSync, existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { basename, extname, join } from "node:path";
import { createRequire } from "node:module";
import type { Motion, Plan, Style, Word } from "../../shared/types.js";
import { chunkWords, isEmphasis, keptWords, outDuration, srcToOut } from "../../shared/plan.js";

const require = createRequire(import.meta.url);
const W = 1080, H = 1920;
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const n = (x: number) => Number(x.toFixed(3));

function copyFont(dir: string, family: string, weight: number) {
  const slug = family.toLowerCase().replace(/\s+/g, "-");
  let filesDir: string;
  try { filesDir = join(require.resolve(`@fontsource/${slug}/package.json`), "..", "files"); } catch { return ""; }
  const files = readdirSync(filesDir).filter((f) => /-latin-\d+-normal\.woff2$/.test(f));
  if (!files.length) return "";
  const pick = files.sort((a, b) => Math.abs(+a.match(/-(\d+)-normal/)![1] - weight) - Math.abs(+b.match(/-(\d+)-normal/)![1] - weight))[0];
  mkdirSync(join(dir, "assets/fonts"), { recursive: true });
  copyFileSync(join(filesDir, pick), join(dir, "assets/fonts", pick));
  return `@font-face { font-family: "${family}"; font-weight: ${weight}; src: url('assets/fonts/${pick}') format('woff2'); }`;
}

export function buildHyperframesProject(dir: string, opts: { videoPath: string; plan: Plan; words: Word[]; style: Style }) {
  const { videoPath, plan, words, style } = opts;
  const segs = plan.segments;
  const total = n(outDuration(segs));
  const o = (t: number) => n(srcToOut(segs, t));
  const c = style.caption;
  mkdirSync(join(dir, "assets"), { recursive: true });
  mkdirSync(join(dir, "compositions"), { recursive: true });
  const videoName = `video${extname(videoPath) || ".mp4"}`;
  if (!existsSync(join(dir, "assets", videoName))) copyFileSync(videoPath, join(dir, "assets", videoName));
  copyFileSync(require.resolve("gsap/dist/gsap.min.js"), join(dir, "assets/gsap.min.js"));
  const fontFace = copyFont(dir, c.font, c.weight);

  // ---------- index.html: video por segmentos + zooms + hosts de subtítulos y gráficos
  let acc = 0;
  const videos = segs.map((s, i) => {
    const start = n(acc); acc += s.end - s.start;
    return `        <video id="seg-${i}" class="clip" src="assets/${videoName}" data-start="${start}" data-duration="${n(s.end - s.start)}" data-media-start="${n(s.start)}" data-track-index="0" data-has-audio="true" playsinline></video>`;
  }).join("\n");
  const zoomTweens = plan.zooms.map((z) => {
    const at = o(z.at), d = n(z.dur);
    return `      tl.fromTo("#stage", { scale: 1 }, { scale: ${z.scale}, duration: ${n(d * 0.25)}, ease: "power3.out" }, ${at});\n      tl.to("#stage", { scale: 1, duration: ${n(d * 0.2)}, ease: "power2.inOut" }, ${n(at + d * 0.8)});`;
  }).join("\n");

  writeFileSync(join(dir, "index.html"), `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <title>Emperador Santiago · ${esc(style.name)}</title>
    <script src="assets/gsap.min.js"></script>
    <style>
      body { margin: 0; background: #000; }
      #stage { position: absolute; inset: 0; transform-origin: 50% 50%; overflow: hidden; }
      #stage video { position: absolute; left: 0; top: 0; width: ${W}px; height: ${H}px; object-fit: cover; }
    </style>
  </head>
  <body>
    <div id="root" data-composition-id="main" data-start="0" data-duration="${total}" data-width="${W}" data-height="${H}" data-fps="30">
      <div id="stage">
${videos}
      </div>
      <div id="graphics" data-composition-id="graphics" data-composition-src="compositions/graphics.html" data-start="0" data-duration="${total}" data-track-index="1" data-track-kind="graphics" data-width="${W}" data-height="${H}"></div>
      <div id="captions" data-composition-id="captions" data-composition-src="compositions/captions.html" data-start="0" data-duration="${total}" data-track-index="2" data-track-kind="captions" data-width="${W}" data-height="${H}"></div>
    </div>
    <script>
      const tl = gsap.timeline({ paused: true });
${zoomTweens}
      window.__timelines["main"] = tl;
    </script>
  </body>
</html>
`);

  // ---------- compositions/captions.html: un grupo por frase, palabra por palabra
  const chunks = chunkWords(keptWords(words, segs), c.wordsPerChunk);
  const size = Math.round(c.size * H);
  const groups = chunks.map((ch, gi) => {
    const s = Math.max(0.1, o(ch.start) - 0.05), e = n(o(ch.end) + 0.12);
    const spans = ch.words.map((w, wi) => {
      const emph = isEmphasis(plan, w.w);
      return `<span id="cw-${gi}-${wi}" class="w${emph ? " em" : ""}">${esc(c.uppercase ? w.w.toUpperCase() : w.w)}</span>`;
    }).join(" ");
    return { html: `    <div id="cap-${gi}" class="clip group" data-start="${n(s)}" data-duration="${n(e - s)}"><div class="line">${spans}</div></div>`, s, e, ch, gi };
  });
  const capTweens = groups.map(({ s, e, ch, gi }) => {
    const lines = [`    tl.fromTo("#cap-${gi} .line", { opacity: 0 }, { opacity: 1, duration: ${c.animation === "fade" ? 0.18 : 0.01} }, ${n(s)});`];
    ch.words.forEach((w, wi) => {
      const at = o(w.t0), id = `#cw-${gi}-${wi}`;
      if (c.animation === "pop") lines.push(`    tl.fromTo("${id}", { opacity: 0, scale: 1.25 }, { opacity: 1, scale: 1, duration: 0.14, ease: "back.out(3)" }, ${at});`);
      if (c.animation === "bounce") lines.push(`    tl.fromTo("${id}", { y: ${-size * 0.12} }, { y: 0, duration: 0.25, ease: "bounce.out" }, ${at});`);
      if (c.animation === "karaoke") lines.push(`    tl.fromTo("${id}", { opacity: 0.38 }, { opacity: 1, duration: 0.06 }, ${at});`);
    });
    lines.push(`    tl.to("#cap-${gi} .line", { opacity: 0, duration: 0.1, ease: "power2.in" }, ${n(e - 0.1)});`);
    return lines.join("\n");
  }).join("\n");

  writeFileSync(join(dir, "compositions/captions.html"), `<template>
  <style>
    ${fontFace}
    #root { position: absolute; inset: 0; }
    .group { position: absolute; left: 0; right: 0; top: ${Math.round(c.position * H - size)}px; text-align: center; overflow: visible; }
    .line { display: inline-block; max-width: 900px; font-family: "${c.font}", sans-serif; font-weight: ${c.weight}; font-size: ${size}px; line-height: 1.18; color: ${c.color}; opacity: 0; }
    .w { display: inline-block; ${c.stroke !== "transparent" ? `-webkit-text-stroke: ${Math.round(size * 0.08)}px ${c.stroke}; paint-order: stroke fill;` : "text-shadow: 0 4px 18px rgba(0,0,0,.55);"} }
    .w.em { color: ${c.highlight}; }
  </style>
  <div id="root" data-composition-id="captions" data-width="${W}" data-height="${H}" data-layout-allow-overflow>
${groups.map((g) => g.html).join("\n")}
  </div>
  <script>
    const tl = gsap.timeline({ paused: true });
${capTweens}
    window.__timelines["captions"] = tl;
  </script>
</template>
`);

  // ---------- compositions/graphics.html: título, rótulo, emojis, cajas, contadores, progreso
  const accent = c.highlight;
  const motion = plan.motion.map((m, i) => ({ ...m, i, s: Math.max(0, o(m.start)), d: Math.max(0.2, n(o(m.end) - o(m.start))) }));
  const gHtml = motion.map((m) => graphicHtml(m, total)).join("\n");
  const gTweens = motion.map((m) => graphicTween(m, total)).join("\n");
  writeFileSync(join(dir, "compositions/graphics.html"), `<template>
  <style>
    ${fontFace}
    #root { position: absolute; inset: 0; font-family: "${c.font}", sans-serif; }
    .title { position: absolute; left: 0; right: 0; top: 230px; text-align: center; }
    .title > div { display: inline-block; max-width: 880px; padding: 26px 40px; border-radius: 26px; background: rgba(12,12,16,.72); color: #fff; font-weight: 800; font-size: 54px; border-bottom: 8px solid ${accent}; ${c.uppercase ? "text-transform: uppercase;" : ""} }
    .lower { position: absolute; left: 60px; top: 1075px; display: flex; }
    .lower .bar { width: 10px; background: ${accent}; }
    .lower .box { background: rgba(10,10,14,.78); padding: 16px 30px; min-width: 480px; }
    .lower b { display: block; color: #fff; font-size: 46px; } .lower small { color: rgba(255,255,255,.7); font: 500 30px Inter, sans-serif; }
    .emoji { position: absolute; left: 767px; top: 870px; font-size: 150px; }
    .hbox { position: absolute; left: 0; right: 0; top: 520px; text-align: center; }
    .hbox > div { display: inline-block; background: ${accent}; color: #0b0b0f; font-weight: 800; font-size: 64px; padding: 18px 40px; border-radius: 18px; }
    .counter { position: absolute; left: 0; right: 0; top: 520px; text-align: center; color: ${accent}; font-weight: 900; font-size: 150px; text-shadow: 0 0 40px ${accent}; }
    .progress { position: absolute; left: 0; right: 0; top: 0; height: 10px; background: rgba(255,255,255,.18); }
    .progress > div { height: 100%; width: 100%; background: ${accent}; transform-origin: 0 50%; }
  </style>
  <div id="root" data-composition-id="graphics" data-width="${W}" data-height="${H}" data-layout-allow-overflow>
${gHtml}
  </div>
  <script>
    const tl = gsap.timeline({ paused: true });
${gTweens}
    window.__timelines["graphics"] = tl;
  </script>
</template>
`);
  return { dir, duration: total };
}

type M = Motion & { i: number; s: number; d: number };
function graphicHtml(m: M, total: number) {
  const a = `id="g-${m.i}" class="clip" data-start="${m.s}" data-duration="${m.kind === "progress" ? total : m.d}"`;
  switch (m.kind) {
    case "title": return `    <div ${a}><div class="title"><div id="g-${m.i}-in">${esc(m.text)}</div></div></div>`;
    case "lowerThird": { const [nm, role = ""] = m.text.split("|"); return `    <div ${a}><div id="g-${m.i}-in" class="lower"><div class="bar"></div><div class="box"><b>${esc(nm.trim())}</b><small>${esc(role.trim())}</small></div></div></div>`; }
    case "emojiPop": return `    <div ${a}><div id="g-${m.i}-in" class="emoji">${esc(m.text)}</div></div>`;
    case "highlightBox": return `    <div ${a}><div class="hbox"><div id="g-${m.i}-in">${esc(m.text)}</div></div></div>`;
    case "counter": return `    <div ${a}><div id="g-${m.i}-in" class="counter" data-target="${esc(m.text)}">0</div></div>`;
    case "progress": return `    <div ${a}><div class="progress"><div id="g-${m.i}-in"></div></div></div>`;
  }
}
function graphicTween(m: M, total: number) {
  const id = `#g-${m.i}-in`, s = m.s, out = n(s + m.d - 0.3);
  switch (m.kind) {
    case "title": return `    tl.fromTo("${id}", { opacity: 0, y: -40 }, { opacity: 1, y: 0, duration: 0.35, ease: "power3.out" }, ${s});\n    tl.to("${id}", { opacity: 0, duration: 0.25 }, ${out});`;
    case "lowerThird": return `    tl.fromTo("${id}", { opacity: 0, x: -300 }, { opacity: 1, x: 0, duration: 0.4, ease: "power3.out" }, ${s});\n    tl.to("${id}", { opacity: 0, x: -60, duration: 0.25 }, ${out});`;
    case "emojiPop": return `    tl.fromTo("${id}", { scale: 0, rotation: -34 }, { scale: 1, rotation: 0, duration: 0.45, ease: "back.out(2.5)" }, ${s});\n    tl.to("${id}", { scale: 0, duration: 0.25, ease: "power2.in" }, ${out});`;
    case "highlightBox": return `    tl.fromTo("${id}", { opacity: 0, scale: 0.85, rotation: 0 }, { opacity: 1, scale: 1, rotation: -2, duration: 0.3, ease: "back.out(2)" }, ${s});\n    tl.to("${id}", { opacity: 0, duration: 0.25 }, ${out});`;
    case "counter": {
      const target = parseFloat(m.text.replace(/[^\d.]/g, "")) || 0;
      const pre = m.text.match(/^\D*/)?.[0] ?? "", suf = m.text.match(/\D*$/)?.[0] ?? "";
      return `    { const el = document.querySelector("${id}"); const st = { v: 0 };\n      tl.fromTo(st, { v: 0 }, { v: ${target}, duration: ${n(m.d * 0.62)}, ease: "power3.out", onUpdate: () => { el.textContent = ${JSON.stringify(pre)} + Math.round(st.v).toLocaleString("es") + ${JSON.stringify(suf)}; } }, ${s});\n      tl.to("${id}", { opacity: 0, duration: 0.25 }, ${out}); }`;
    }
    case "progress": return `    tl.fromTo("${id}", { scaleX: 0 }, { scaleX: 1, duration: ${total}, ease: "none" }, 0);`;
  }
}

export const projectName = (p: string) => basename(p);
