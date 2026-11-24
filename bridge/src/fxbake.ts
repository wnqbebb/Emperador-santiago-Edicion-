// Horneador de efectos con Playwright: dibuja pixelfx / intro 3D cuadro a cuadro en Chromium sin ventana
// y los guarda como WebM con transparencia, listos para Remotion y HyperFrames.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { chromium, type Browser } from "@playwright/test";
import { DATA } from "./store.js";
import { fxDuration } from "../../shared/fxmeta.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
export const FX_DIR = join(DATA, "fx");
mkdirSync(FX_DIR, { recursive: true });
const FPS = 30;

let bundle: Promise<string> | null = null;
let browser: Promise<Browser> | null = null;

const fxFile = (kind: string, id: string, accent: string) => `${kind}-${id || "x"}-${accent.replace("#", "")}.webm`;

/** Hornea (o reutiliza) el efecto y devuelve el nombre del archivo dentro de data/fx. */
export async function bakeFx(kind: "pixelfx" | "intro3d", id: string, accent: string): Promise<string> {
  const name = fxFile(kind, id, accent);
  if (existsSync(join(FX_DIR, name))) return name;
  bundle ??= build({ entryPoints: [join(ROOT, "shared/fx-bake-entry.ts")], bundle: true, write: false, format: "iife", platform: "browser" }).then((r) => r.outputFiles[0].text);
  browser ??= chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
  const page = await (await browser).newPage();
  try {
    await page.setContent("<!doctype html><body style='margin:0;background:transparent'><canvas></canvas></body>");
    await page.addScriptTag({ content: await bundle });
    const frames = Math.ceil(fxDuration(kind, id) * FPS);
    const tmp = mkdtempSync(join(tmpdir(), "santi-fx-"));
    for (let f = 0; f < frames; f++) {
      const url: string = await page.evaluate(([k, i, t, a]) => (window as any).SantiFX.frame(k, i, t, a), [kind, id, f / FPS, accent] as const);
      writeFileSync(join(tmp, `${String(f).padStart(4, "0")}.png`), Buffer.from(url.split(",")[1], "base64"));
    }
    execFileSync("ffmpeg", ["-v", "error", "-y", "-framerate", String(FPS), "-i", join(tmp, "%04d.png"), "-c:v", "libvpx-vp9", "-pix_fmt", "yuva420p", "-auto-alt-ref", "0", "-b:v", "4M", join(FX_DIR, name)]);
    rmSync(tmp, { recursive: true, force: true });
    return name;
  } finally {
    await page.close();
  }
}

/** Hornea todos los efectos de un plan y devuelve un mapa "kind:id" → archivo. */
export async function bakePlanFx(motion: { kind: string; text: string }[], accent: string) {
  const out: Record<string, string> = {};
  for (const m of motion) {
    if (m.kind !== "pixelfx" && m.kind !== "intro3d") continue;
    const key = `${m.kind}:${m.kind === "intro3d" ? "" : m.text}`;
    out[key] ??= await bakeFx(m.kind, m.kind === "intro3d" ? "" : m.text, accent);
  }
  return out;
}
