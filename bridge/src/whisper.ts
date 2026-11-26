// Whisper siempre cargado en memoria (tools/palabras_srv.py): se abre al arrancar y cada análisis empieza al instante.
// Si no está disponible, se usa el modo de siempre (tools/palabras.py, que carga el modelo en cada llamada).
import { spawn, execFile, type ChildProcessWithoutNullStreams } from "node:child_process";
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createInterface } from "node:readline";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const PY = join(ROOT, "tools/.venv/bin/python");
export type Palabra = { w: string; t0: number; t1: number; p?: number };

let proc: ChildProcessWithoutNullStreams | null = null;
let listo: Promise<void> | null = null;
const espera: ((l: string) => void)[] = [];
let cadena: Promise<unknown> = Promise.resolve();   // un trabajo a la vez

export function precargar() {
  if (listo || !existsSync(PY) || process.env.SANTI_SIN_WHISPER) return listo;
  proc = spawn(PY, [join(ROOT, "tools/palabras_srv.py"), "small"], { stdio: ["pipe", "pipe", "pipe"] });
  proc.stderr.on("data", () => { /* avisos de descarga del modelo */ });
  const rl = createInterface({ input: proc.stdout });
  listo = new Promise((ok, ko) => {
    rl.on("line", (l) => { if (l.includes('"listo"')) return ok(); espera.shift()?.(l); });
    proc!.on("exit", () => { proc = null; listo = null; ko(new Error("Whisper se cerró")); espera.splice(0).forEach((f) => f('{"error":"Whisper se cerró"}')); });
  });
  listo.catch(() => null);
  return listo;
}

function directo(wavs: string[], modelo: string, idioma: string) {
  return new Promise<Palabra[][]>((ok, ko) => execFile(PY, [join(ROOT, "tools/palabras.py"), ...wavs, "--modelo", modelo, "--idioma", idioma], { maxBuffer: 1 << 28 },
    (e: Error | null, so: string) => (e ? ko(e) : ok(JSON.parse(so)))));
}

/** Palabras con tiempos de varios audios (wav mono 16 kHz). */
export function transcribir(wavs: string[], idioma = "es", modelo = "small"): Promise<Palabra[][]> {
  const t = cadena.then(async () => {
    try {
      await precargar();
      if (!proc) throw new Error("sin servidor");
      const linea = await new Promise<string>((ok) => { espera.push(ok); proc!.stdin.write(JSON.stringify({ wavs, modelo, idioma }) + "\n"); });
      const r = JSON.parse(linea);
      if (!Array.isArray(r)) throw new Error(r.error);
      return r as Palabra[][];
    } catch { return directo(wavs, modelo, idioma); }
  });
  cadena = t.catch(() => null);
  return t;
}
