// LUTs / looks de color para la Unión de clips (presets/luts). Son .cube reales: también sirven en Premiere, CapCut o DaVinci.
// Santiago puede soltar sus propios .cube en presets/luts/ y aparecen solos en la lista.
import { execFile } from "node:child_process";
import { existsSync, readFileSync, readdirSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { join, dirname, basename } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "presets/luts");
export type Look = { id: string; nombre: string; desc: string; cube: string };

export function looks(): Look[] {
  const base = (JSON.parse(readFileSync(join(DIR, "looks.json"), "utf8")).looks as { id: string; nombre: string; desc: string }[])
    .map((l) => ({ ...l, cube: join(DIR, `${l.id}.cube`) }));
  const ids = new Set(base.map((l) => l.id));
  const propios = readdirSync(DIR).filter((f) => /\.cube$/i.test(f) && !ids.has(f.replace(/\.cube$/i, "")))
    .map((f) => ({ id: f.replace(/\.cube$/i, ""), nombre: f.replace(/\.cube$/i, "").replace(/[-_]/g, " "), desc: "Tu LUT", cube: join(DIR, f) }));
  return [...base, ...propios].filter((l) => existsSync(l.cube));
}

/** Filtro de FFmpeg para un look ("" si no hay o no existe). */
export function filtroLook(id?: string) {
  const l = id ? looks().find((x) => x.id === id) : undefined;
  return l ? `lut3d=file='${l.cube.replace(/\\/g, "/").replace(/'/g, "\\'").replace(/:/g, "\\:")}'` : "";
}

/** Vista previa: el mismo cuadro con cada look (todas en paralelo, ~0.3 s). imagen = JPEG en base64. */
export async function previewLooks(imagen: string) {
  const tmp = mkdtempSync(join(tmpdir(), "looks-"));
  const src = join(tmp, "src.jpg");
  writeFileSync(src, Buffer.from(imagen.replace(/^data:[^,]+,/, ""), "base64"));
  try {
    return await Promise.all(looks().map((l) => new Promise<Look & { img: string }>((ok) => {
      const out = join(tmp, `${basename(l.id)}.jpg`);
      execFile("ffmpeg", ["-v", "error", "-y", "-i", src, "-vf", `format=rgb24,${filtroLook(l.id)}`, "-q:v", "4", out], () =>
        ok({ ...l, cube: `/luts/${basename(l.cube)}`, img: existsSync(out) ? `data:image/jpeg;base64,${readFileSync(out).toString("base64")}` : "" }));
    })));
  } finally { rmSync(tmp, { recursive: true, force: true }); }
}

export const cubePath = (f: string) => { const p = join(DIR, basename(f)); return /\.cube$/i.test(p) && existsSync(p) ? p : null; };
