// Motor Skylight (skill .claude/skills/skylight): clip premium 9:16 hecho en código con HyperFrames.
// Cara arriba con subtítulo en dos niveles (lead-in fino + palabra clave en negrita), b-roll con flechas y recuadros,
// animaciones en papel claro (barras, línea, orbes, casillas) y "mundos" (un objeto recortado flotando en un cielo,
// atardecer, estudio o espacio). Imágenes libres de Wikimedia Commons con créditos. Local y gratis.
// Adaptado a Emperador: clips verticales en español, la paleta elegida en las preguntas y tablero A/B/C.
import { spawn } from "node:child_process";
import { existsSync, readFileSync, writeFileSync, mkdirSync, copyFileSync, readdirSync, statSync, rmSync } from "node:fs";
import { join, dirname, resolve, relative, normalize, extname, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { DATA } from "./store.js";
import type { Asset, PlanOpts, Energia } from "./beats.js";
import Anthropic from "@anthropic-ai/sdk";
import { ANTHROPIC_MODEL } from "./providers/anthropic.js";
import { runCli } from "./providers/subscriptions.js";
import type { ProviderId } from "./providers/index.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
export const SKY_SKILL = "skylight";
export const SKY = join(ROOT, ".claude/skills/skylight");
export const SKY_DATA = join(DATA, "skylight");
const PC = join(SKY, "scripts/pc.mjs");

export const skyDir = (project: string) => {
  if (!/^[\w.-]+$/.test(project)) throw new Error("Proyecto inválido");
  return join(SKY_DATA, project);
};

/** Ejecuta un paso de Skylight (node pc.mjs <cmd> <dir> …) con el Python, el HyperFrames y el idioma del proyecto. */
export function pc(args: string[], log: string[] = []): Promise<void> {
  return new Promise((ok, ko) => {
    const child = spawn(process.execPath, [PC, ...args], {
      cwd: ROOT,
      env: {
        ...process.env, PC_PY: join(ROOT, "tools/.venv/bin/python"), PC_LANG: process.env.PC_LANG ?? "es",
        PC_HYPERFRAMES: join(ROOT, "node_modules/.bin/hyperframes"), HYPERFRAMES_NO_TELEMETRY: "1", DO_NOT_TRACK: "1",
      },
    });
    const add = (d: Buffer) => { for (const l of String(d).split(/\r?\n/)) if (l.trim()) log.push(l.slice(0, 300)); if (log.length > 80) log.splice(0, log.length - 80); };
    child.stdout.on("data", add); child.stderr.on("data", add);
    child.on("close", (code) => (code === 0 ? ok() : ko(new Error(`pc ${args[0]}: ${log.slice(-3).join(" ")}`))));
  });
}

/** Mezcla un color hacia otro (t = 0 → a, 1 → b). */
function mix(a: string, b: string, t: number) {
  const p = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [x, y] = [p(a), p(b)];
  return "#" + x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, "0")).join("");
}

/** La paleta elegida en las preguntas pasa a ser la opción 0 de Skylight (bright, dark, pale, white, black). */
export function injectPalette(dir: string, pal?: Record<string, string>) {
  const f = join(dir, "work/palette.json");
  const pj = existsSync(f) ? JSON.parse(readFileSync(f, "utf8")) : { options: [] };
  if (pal?.vibrant_bright) {
    const bright = pal.highlight ?? pal.vibrant_bright, white = pal.dull_white ?? "#eceef5";
    pj.options = [{ name: "Emperador (elegida)", bright, dark: pal.vibrant_dark ?? mix(bright, "#000000", 0.4), pale: mix(bright, "#ffffff", 0.78), white, black: pal.dull_black ?? "#0d0d11", ring: mix(white, "#000000", 0.05), hue: 0 }, ...pj.options.slice(0, 2)];
    pj.pick = 0;
  }
  writeFileSync(f, JSON.stringify(pj, null, 1));
  return pj.options[0];
}

/** Preparar: proyecto, clip completo (ya unido), corte + palabras en español, cara arriba (9:16), paleta. */
export async function skyPrepare(project: string, video: string, log: string[], step: (i: number) => void) {
  const dir = skyDir(project);
  step(0);
  await pc(["new", dir], log);
  await pc(["get", dir, video], log);
  const dur = await new Promise<number>((ok) => {
    const p = spawn("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", join(dir, "raw/podcast.mp4")]);
    let o = ""; p.stdout.on("data", (d) => (o += d)); p.on("close", () => ok(Number(o) || 0));
  });
  writeFileSync(join(dir, "work/clip.json"), JSON.stringify({ title: project, src: "raw/podcast.mp4", why: "clip de Santiago ya unido", segments: [[0, dur]] }));
  step(1);
  await pc(["cut", dir], log);
  await pc(["track", dir], log);
  await pc(["palette", dir], log);
  return dir;
}

const ENERGIA: Record<Energia, string> = {
  calma: "Unos 0.3 cortes por segundo; tomas de 2–4.5 s; 2 mundos.",
  media: "Unos 0.4 cortes por segundo (el ritmo del estilo); toma mediana ~1.9 s; 2–3 mundos.",
  viral: "0.45–0.55 cortes por segundo; tomas de 1.2–3 s; gancho fuerte desde el primer fotograma; 3–4 mundos; nunca más de 3.5 s en la cara.",
};
export const SKY_TYPES = ["aroll", "broll", "bars", "line", "orbs", "days", "duo", "world", "still"];
const NEED_IMG = (s: SScene) => [s.img, s.left, s.right, ...(s.objects ?? []).map((o) => o.img)].filter((x): x is string => typeof x === "string" && x.startsWith("assets/img/"));

export type SScene = { type: string; s: number; e: number; in?: string; img?: string; left?: string; right?: string; objects?: { img?: string; [k: string]: unknown }[]; [k: string]: unknown };
export type SOpt = { title: string; cats?: string; desc?: string; ref?: string; type: null; scenes: SScene[] };
export type SBeat = { id: string; start: number; end: number; script: string; seen: string; pick: "A" | "B" | "C"; opts: SOpt[] };
export type Imagen = { slot: string; buscar: string; como: "white" | "glass" | "cover" | "person" | "logo"; para?: string };
export type SBeats = { title: string; beats: SBeat[]; captions: { s: number; at: string; pos?: string; ink?: string }[]; imagenes: Imagen[]; people?: Record<string, { name: string; title: string }>; special_font?: string; assets?: Asset[] };

const read = (p: string, max = 1e9) => (existsSync(p) ? readFileSync(p, "utf8").slice(0, max) : "");

export function skyPrompt(project: string, po: PlanOpts & { enfoque?: string }) {
  const dir = skyDir(project);
  const w = JSON.parse(read(join(dir, "work/words.json")));
  const words = w.words as { w: string; s: number; e: number }[];
  const duration = Number(w.duration ?? words.at(-1)?.e ?? 0);
  const ex = (n: string) => JSON.stringify(JSON.parse(read(join(SKY, `examples/${n}/work/plan.json`)) || "{}"));
  const system = `Eres el editor de "Emperador Santiago · Edición de Videos" y trabajas con la skill Skylight (clip premium 9:16 hecho en código).
Tu trabajo AHORA: el plan del tablero de preedición (A/B/C por beat), los subtítulos y las imágenes a buscar.

# SKILL
${read(join(SKY, "SKILL.md"))}

# El estilo en números
${read(join(SKY, "reference/style.md"))}

# Dos planes reales terminados (cópiales la forma, no el contenido)
${ex("ai-shutdown-1123")}
${ex("hormozi-ideas-1123")}

# Adaptación Emperador
- El clip YA está elegido y cortado (es de Santiago hablando a cámara, vertical, en español): no hay que buscar el momento.
- Los subtítulos van en ESPAÑOL, en minúscula, con UNA palabra o frase especial por página (marcas !, !!, !!g, !!w, !p, [ ], { }).
- Coordenadas en píxeles de 1080×1920.
- Imágenes: tú NO las ves; das palabras de búsqueda en INGLÉS para Wikimedia Commons (cortas). Para objetos de un "world" o un "duo" pide fotos de producto: añade "white background" o "isolated" a la búsqueda y como "white" (o "glass").
- Las rutas de imagen son assets/img/<slot>.png (white/glass/person/logo) o assets/img/<slot>.jpg (cover).
- Colores: la paleta ya está elegida (${JSON.stringify(po.palette ?? {})}).
- CREATIVIDAD (manda Santiago): los ejemplos son inspiración, no plantilla. Esto es para redes: lo viral manda.${po.plugins ?? ""}`;

  const user = `Clip (${duration.toFixed(2)} s). Palabras con tiempos (inicio fin palabra):
${words.map((x) => `${x.s.toFixed(2)} ${x.e.toFixed(2)} ${x.w}`).join("\n")}

Energía: ${po.energia.toUpperCase()} → ${ENERGIA[po.energia]}
${po.notas ? `Notas de Santiago (mandan): ${po.notas}\n` : ""}${po.broll.length ? `B-roll de Santiago (úsalo tal cual con type "broll", img = la ruta; puede ir en la opción recomendada):\n${po.broll.map((b) => `- ${b.path}: ${b.desc}`).join("\n")}\n` : ""}
Devuelve SOLO un JSON (bloque \`\`\`json) con:
{"title": "…", "special_font": "sans|serif",
 "people": {"santi": {"name": "…", "title": "…"}}  (solo si el clip dice quién habla; si no, omite name cards),
 "beats": [ {"id","start","end","script","seen" (qué regla de Skylight lo justifica),"pick":"A|B|C",
   "opts": [ {"title","cats","desc","type": null,"scenes": [ escenas de Skylight con "s","e" ABSOLUTOS dentro del beat, back to back, cubriendo el beat entero ]}, ×3 ] } ],
 "captions": [ {"s","at","pos"?,"ink"?} … ]   (UNA lista para todo el clip, una página por frase; ink "dark" y pos "top" cuando la escena es blanca: bars/line/orbs/days/duo),
 "imagenes": [ {"slot":"hanger","buscar":"clothes hanger white background","como":"white","para":"b03"} … ] (máx. 8, solo las que usan las opciones),
 "assets": [ … ] (máx. 6: material que Commons no tiene y que Santiago debería grabar o generar; formato {"id":"A01","name","kind":"image|video","modelo","ar":"9:16","resolucion":"1080x1920","duracion","en_pantalla","referencia","is_ref","bloques":{"referencias","contexto","mapa_espacial","accion","camara","luz_textura","bloqueos"},"prompt" (EN INGLÉS, los 7 bloques en un párrafo),"resumen","negative","archivo","for_beat"}) }
Reglas: beats de 1.5–6 s sin huecos ni solapes de 0 a ${duration.toFixed(2)}; el primero abre en la cara (aroll con "in":"focus"); A = lo mejor del estilo para ESTE contenido, B = otra idea (otra animación, otro mundo), C = más sobria (cara, punch-in) u otra idea fuerte. Reparte ~40 % cara, ~25 % b-roll, ~35 % pantallas completas, con 2–4 mundos en las opciones recomendadas.`;
  return { system, user, duration };
}

/** Limpia: tipos válidos, tiempos dentro del beat, rutas de imagen conocidas, subtítulos ordenados. */
export function skySanitize(b: SBeats, duration: number, broll: { path: string }[]): SBeats {
  const slots = new Set((b.imagenes ?? []).slice(0, 8).map((i) => i.slot));
  const known = (p: string) => broll.some((x) => x.path === p) || slots.has(p.replace(/^assets\/img\//, "").replace(/\.\w+$/, ""));
  let beats = (b.beats ?? []).filter((x) => x && typeof x.start === "number" && typeof x.end === "number").sort((x, y) => x.start - y.start);
  const face = (s: number, e: number): SOpt => ({ title: "Quedarse en la cara", cats: "aroll", desc: "Respiro: cara con subtítulo en dos niveles.", type: null, scenes: [{ type: "aroll", s, e, in: "return" }] });
  beats.forEach((x, i) => {
    x.id = `b${String(i + 1).padStart(2, "0")}`;
    x.start = i === 0 ? 0 : Math.max(0, Math.min(duration, beats[i - 1].end));
    x.end = i === beats.length - 1 ? duration : Math.max(x.start + 0.4, Math.min(duration, x.end));
    x.opts = (x.opts ?? []).slice(0, 3);
    while (x.opts.length < 3) x.opts.push(face(x.start, x.end));
    x.opts = x.opts.map((o) => {
      let sc = (Array.isArray(o.scenes) ? o.scenes : []).filter((s) => s && SKY_TYPES.includes(s.type) && typeof s.s === "number" && typeof s.e === "number")
        .map((s) => ({ ...s, s: Math.max(x.start, s.s), e: Math.min(x.end, s.e) })).filter((s) => s.e - s.s >= 0.3).sort((p, q) => p.s - q.s);
      // imágenes que nadie va a traer → esa escena vuelve a la cara
      sc = sc.map((s) => (NEED_IMG(s).every(known) ? s : { type: "aroll", s: s.s, e: s.e, in: "return" }));
      // escenas pegadas: sin huecos dentro del beat
      sc.forEach((s, k) => { s.s = k === 0 ? x.start : sc[k - 1].e; if (k === sc.length - 1) s.e = x.end; });
      return { ...o, type: null, scenes: sc.length ? sc : face(x.start, x.end).scenes };
    });
    if (!"ABC".includes(x.pick)) x.pick = "A";
  });
  const captions = (b.captions ?? []).filter((c) => c && typeof c.s === "number" && typeof c.at === "string" && c.s < duration).sort((p, q) => p.s - q.s);
  const assets = (b.assets ?? []).slice(0, 6).map((a, i) => {
    const id = a.id || `A${String(i + 1).padStart(2, "0")}`;
    const bl = a.bloques;
    const prompt = a.prompt || (bl ? Object.values(bl).filter(Boolean).join(" ") : "");
    const ar = String(a.ar ?? "").match(/\d+\s*[:x/]\s*\d+/)?.[0]?.replace(/\s/g, "") ?? "9:16";
    return { ...a, id, ar, prompt, archivo: a.archivo || `${id}_${(a.name || "asset").replace(/[^\w-]+/g, "-")}.${/video/.test(a.kind) ? "mp4" : "png"}` };
  });
  return { title: b.title || "Plan Skylight", special_font: b.special_font === "serif" ? "serif" : "sans", people: b.people, beats, captions, imagenes: (b.imagenes ?? []).slice(0, 8), assets };
}

type Cand = { slot: string; title: string; file?: string };
/** Tu IA MIRA las candidatas de Commons y elige la que de verdad muestra lo pedido (o ninguna + otra búsqueda).
 *  Sin un modelo con vista, se elige por el título del archivo. */
async function elegirImagenes(provider: ProviderId, dir: string, want: Imagen[], log: string[]) {
  const dl = join(dir, "work/dl");
  const cr = (existsSync(join(dl, "credits.json")) ? JSON.parse(readFileSync(join(dl, "credits.json"), "utf8")) : []) as Cand[];
  const cands = Object.fromEntries(want.map((i) => [i.slot, cr.filter((c) => c.slot === i.slot && c.file && existsSync(c.file)).map((c) => ({ k: Number(c.file!.match(/_(\d+)\.\w+$/)?.[1] ?? -1), title: c.title, file: c.file! })).filter((c) => c.k >= 0)]));
  const ask = want.filter((i) => cands[i.slot]?.length).map((i) => `- ${i.slot}: debe mostrar «${i.buscar}» (${i.como === "white" || i.como === "glass" ? "un objeto suelto para recortarlo" : "una foto a pantalla completa"}) · candidatas: ${cands[i.slot].map((c) => `${basename(c.file)} («${c.title.replace(/^File:/, "").slice(0, 70)}»)`).join(", ")}`).join("\n");
  const pedido = `Eres el editor de fotos de un video vertical. Para cada hueco, MIRA las imágenes candidatas y elige la que de verdad muestra lo pedido, bien encuadrado, nítido, sin texto ni marcas de agua, en color. Si ninguna sirve, pon null y propone otra búsqueda corta en inglés para Wikimedia Commons.
${ask}
Devuelve SOLO JSON: {"<hueco>": {"k": <número de la candidata o null>, "otra": "<búsqueda nueva si k es null>"}, …}`;
  let raw = "";
  try {
    if (provider === "claude-cli") raw = await runCli("claude-cli", `${pedido}\nLas imágenes están en esta carpeta: ábrelas con la herramienta Read.`, 10 * 60_000, { mirar: dl });
    else if (provider === "claude-api") {
      const content: Anthropic.Messages.ContentBlockParam[] = [];
      for (const i of want) for (const c of cands[i.slot] ?? []) {
        content.push({ type: "text", text: `${basename(c.file)}:` });
        content.push({ type: "image", source: { type: "base64", media_type: c.file.endsWith(".png") ? "image/png" : "image/jpeg", data: readFileSync(c.file).toString("base64") } });
      }
      content.push({ type: "text", text: pedido });
      const msg = await new Anthropic().messages.create({ model: ANTHROPIC_MODEL, max_tokens: 4000, messages: [{ role: "user", content }] });
      raw = msg.content.flatMap((c) => (c.type === "text" ? [c.text] : [])).join("");
    }
  } catch (e) { log.push(`⚠ no pude mirar las imágenes: ${(e as Error).message.slice(0, 160)}`); }
  let picks: Record<string, { k: number | null; otra?: string }> = {};
  try { const m = raw.match(/\{[\s\S]*\}/); if (m) picks = JSON.parse(m[0]); } catch { /* sin vista */ }
  // sin vista: por el título (palabras de la búsqueda que aparecen en el nombre del archivo)
  for (const i of want) if (!(i.slot in picks)) {
    const words = i.buscar.toLowerCase().split(/\W+/).filter((w) => w.length > 3 && !["white", "background", "isolated"].includes(w));
    const best = (cands[i.slot] ?? []).map((c) => ({ k: c.k, n: words.filter((w) => c.title.toLowerCase().includes(w)).length })).sort((a, b) => b.n - a.n)[0];
    picks[i.slot] = best && best.n > 0 ? { k: best.k } : { k: null };
  }
  return picks;
}

/** Construir con las elecciones: imágenes de Commons para lo elegido, plan.json, build + render + mezcla. */
export async function skyBuild(project: string, beats: SBeats, log: string[], step: (i: number) => void, provider: ProviderId = "claude-cli") {
  const dir = skyDir(project);
  const w = JSON.parse(readFileSync(join(dir, "work/words.json"), "utf8"));
  const duration = Number(w.duration);
  let scenes = beats.beats.flatMap((b) => b.opts["ABC".indexOf(b.pick)].scenes);
  // imágenes que piden las escenas elegidas
  const used = new Set(scenes.flatMap(NEED_IMG).map((p) => p.replace(/^assets\/img\//, "").replace(/\.\w+$/, "")));
  const want = beats.imagenes.filter((i) => used.has(i.slot) && /^[\w-]+$/.test(i.slot));
  step(4);
  const creditos = new Map<string, Record<string, string>>();   // archivo → crédito (se juntan las dos vueltas)
  const elegidos: string[] = [];
  for (const i of want) for (const ext of [".png", ".jpg"]) { const f = join(dir, "scenes/assets/img", i.slot + ext); if (existsSync(f)) rmSync(f); }
  if (want.length) {
    const fetch = async (list: Imagen[]) => {
      try { await pc(["images", dir, ...list.map((i) => `${i.slot}=${i.buscar.replace(/["\n]/g, " ")}`)], log); } catch (e) { log.push(`⚠ Commons: ${(e as Error).message}`); }
      const cf = join(dir, "work/dl/credits.json");
      if (existsSync(cf)) for (const c of JSON.parse(readFileSync(cf, "utf8")) as Record<string, string>[]) if (c.file) creditos.set(basename(c.file), c);
    };
    await fetch(want);
    let picks = await elegirImagenes(provider, dir, want, log);
    // segunda vuelta: lo que no sirvió se busca con otras palabras
    const again = want.filter((i) => picks[i.slot]?.k == null && picks[i.slot]?.otra).map((i) => ({ ...i, buscar: picks[i.slot].otra! }));
    if (again.length) { log.push(`↻ otra búsqueda: ${again.map((i) => `${i.slot} → ${i.buscar}`).join(" · ")}`); await fetch(again); picks = { ...picks, ...(await elegirImagenes(provider, dir, again, log)) }; }
    for (const i of want) {
      const k = picks[i.slot]?.k;
      if (k == null) { log.push(`⚠ ninguna foto sirve para ${i.slot}: esa escena queda en la cara (pide su prompt)`); continue; }
      log.push(`✓ ${i.slot}: candidata ${k}`);
      try { await pc(["prep", dir, `${i.slot}=${i.slot}_${k}:${i.como ?? "white"}`], log); elegidos.push(...[...creditos.keys()].filter((f) => f.startsWith(`${i.slot}_${k}.`))); } catch (e) { log.push(`⚠ prep ${i.slot}: ${(e as Error).message}`); }
    }
  }
  // lo que no llegó → esa escena vuelve a la cara; el b-roll de Santiago ya está en scenes/assets/img
  const have = (p: string) => existsSync(join(dir, "scenes", p)) || existsSync(join(dir, "scenes", p.replace(/\.\w+$/, ".png"))) || existsSync(join(dir, "scenes", p.replace(/\.\w+$/, ".jpg")));
  const fix = (p: string) => (existsSync(join(dir, "scenes", p)) ? p : existsSync(join(dir, "scenes", p.replace(/\.\w+$/, ".png"))) ? p.replace(/\.\w+$/, ".png") : p.replace(/\.\w+$/, ".jpg"));
  scenes = scenes.map((s) => {
    if (!NEED_IMG(s).every(have)) return { type: "aroll", s: s.s, e: s.e, in: "return" };
    const t = { ...s };
    for (const k of ["img", "left", "right"] as const) if (typeof t[k] === "string" && (t[k] as string).startsWith("assets/")) t[k] = fix(t[k] as string);
    if (t.objects) t.objects = t.objects.map((o) => (typeof o.img === "string" ? { ...o, img: fix(o.img) } : o));
    return t;
  });
  // dos caras seguidas = una sola toma
  const merged: SScene[] = [];
  for (const s of scenes) { const p = merged.at(-1); if (p && p.type === "aroll" && s.type === "aroll" && !s.punch && !p.punch && !s.namecard) p.e = s.e; else merged.push(s); }
  if (merged[0]) merged[0].in = "focus";
  const plan = { title: beats.title, duration, palette: 0, special_font: beats.special_font ?? "sans", people: beats.people ?? {}, scenes: merged, captions: beats.captions };
  writeFileSync(join(dir, "work/plan.json"), JSON.stringify(plan, null, 1));
  step(5);
  try { await pc(["plandoc", dir], log); } catch { /* opcional */ }
  // créditos de las imágenes (CC BY / BY-SA piden el crédito en la descripción)
  if (elegidos.length) writeFileSync(join(dir, "IMAGE_CREDITS.md"), `# Créditos de imágenes (Wikimedia Commons)\n\nPonlos en la descripción del post (CC BY / BY-SA lo piden).\n\n${elegidos.map((f) => creditos.get(f)!).map((c) => `- ${c.slot}: ${c.title} — ${c.license} — ${String(c.artist ?? "").replace(/<[^>]+>/g, "")} — ${c.page}`).join("\n")}\n`);
  step(6);
  await pc(["all", dir, project], log);
  return { scenes: merged.length, out: `out/${project}.mp4` };
}

/** Archivos del proyecto que la app puede mostrar. */
export function skyStatus(project: string) {
  const dir = skyDir(project);
  const files: string[] = [];
  for (const d of ["out", "work", "."]) {
    const full = join(dir, d);
    if (!existsSync(full)) continue;
    for (const f of readdirSync(full)) if (/\.(mp4|html|md|png)$/.test(f) && statSync(join(full, f)).isFile() && !/^(podcast|clip|aroll|scenes)\.mp4$/.test(f)) files.push(d === "." ? f : `${d}/${f}`);
  }
  return { name: project, files, approved: false };
}

/** Ruta segura dentro del proyecto Skylight (solo lo que la app enseña). */
export function skyPath(project: string, rel: string) {
  const base = skyDir(project);
  const full = resolve(base, normalize(rel));
  if (relative(base, full).startsWith("..") || !/\.(mp4|html|md|png|jpg)$/.test(full)) throw new Error("Ruta no permitida");
  return full;
}

/** B-roll de Santiago → scenes/assets/img/B01.ext (lo usa la escena "broll"). */
export function skyBroll(project: string, files: { path: string; desc: string }[]) {
  const dir = skyDir(project);
  mkdirSync(join(dir, "scenes/assets/img"), { recursive: true });
  return files.map((b, i) => {
    const rel = `assets/img/B${String(i + 1).padStart(2, "0")}${extname(b.path) || ".jpg"}`;
    copyFileSync(b.path, join(dir, "scenes", rel));
    return { path: rel, desc: b.desc };
  });
}
