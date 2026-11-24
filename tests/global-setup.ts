import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";

// Genera un clip de prueba (barras de color + tono) con ffmpeg.
export default function setup() {
  mkdirSync("tests/fixtures", { recursive: true });
  if (!existsSync("tests/fixtures/clip.mp4"))
    execFileSync("ffmpeg", ["-v", "error", "-y", "-f", "lavfi", "-i", "testsrc2=size=1280x720:rate=30:duration=12", "-f", "lavfi", "-i", "sine=frequency=330:duration=12", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", "tests/fixtures/clip.mp4"]);
}
