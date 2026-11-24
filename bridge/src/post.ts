// Post-proceso con FFmpeg: volumen estándar de redes (-14 LUFS, pico -1 dB) para que todo suene parejo.
import { execFileSync } from "node:child_process";
import { renameSync } from "node:fs";

export function loudnorm(file: string) {
  const tmp = file.replace(/\.mp4$/, ".norm.mp4");
  try {
    execFileSync("ffmpeg", ["-v", "error", "-y", "-i", file, "-c:v", "copy", "-af", "loudnorm=I=-14:TP=-1:LRA=11", "-c:a", "aac", "-b:a", "192k", tmp]);
    renameSync(tmp, file);
  } catch { /* sin audio: se deja como está */ }
}
