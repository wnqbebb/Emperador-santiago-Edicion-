"""Recorte de la persona en video para poner texto DETRÁS de la cabeza (estilo Pedro Buerbaum, escena p_word).
  python3 pipeline/matte.py <p>     → por cada p_word del plan: media/matte/<id>.webm (con transparencia) y props.matte / matte_t0
Local y gratis (rembg). Cubre 0.5 s antes y después de la escena porque el render ajusta los tiempos a la palabra."""
import io, json, subprocess, sys
from pathlib import Path
from PIL import Image
ROOT = Path(__file__).resolve().parent.parent
W, H, FPS, PAD = 540, 960, 30, 0.5


def main(name):
    from rembg import remove, new_session
    p = ROOT / "projects" / name
    meta = json.loads((p / "project.json").read_text()); plan = json.loads((p / "edit_plan.json").read_text())
    video = p / meta.get("cut", meta["raw"])
    ses = new_session("u2net_human_seg")
    out = p / "media" / "matte"; out.mkdir(parents=True, exist_ok=True)
    tr = json.loads((p / "facetrack.json").read_text()) if (p / "facetrack.json").exists() else []
    for s in plan["scenes"]:
        if s["type"] != "p_word":
            continue
        fs = [f for f in tr if s["start"] - 0.3 <= f["t"] <= s["end"] + 0.3]
        if fs and min(f["y"] - f["h"] * 0.25 for f in fs) / 1920 < 0.2:
            # sin aire sobre la cabeza: detrás quedaría tapada → va DELANTE, bajo el mentón, y sustituye al subtítulo
            s["props"]["front"] = True
            s["props"]["y"] = round(min(0.72, max(f["y"] + f["h"] * 1.18 for f in fs) / 1920 + 0.085), 3)
            s["props"].pop("matte", None); s["props"].pop("matte_t0", None)
            print(f"[matte] {s['id']}: primer plano cerrado → palabra delante (y={s['props']['y']})", flush=True)
            continue
        t0 = max(0, s["start"] - PAD); d = s["end"] + PAD - t0
        raw = subprocess.run(["ffmpeg", "-v", "error", "-ss", f"{t0}", "-t", f"{d}", "-i", str(video), "-vf", f"fps={FPS},scale={W}:{H}", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], capture_output=True, check=True).stdout
        n = len(raw) // (W * H * 3)
        enc = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgba", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-", "-c:v", "libvpx-vp9", "-pix_fmt", "yuva420p", "-b:v", "0", "-crf", "30",
                                "-auto-alt-ref", "0", str(out / f"{s['id']}.webm")], stdin=subprocess.PIPE)
        for i in range(n):
            im = Image.frombytes("RGB", (W, H), raw[i * W * H * 3:(i + 1) * W * H * 3])
            enc.stdin.write(remove(im, session=ses, post_process_mask=True).convert("RGBA").tobytes())
        enc.stdin.close(); enc.wait()
        s["props"]["matte"] = f"media/matte/{s['id']}.webm"; s["props"]["matte_t0"] = round(t0, 3)
        print(f"[matte] ✓ {s['id']} ({n} fotogramas)", flush=True)
    (p / "edit_plan.json").write_text(json.dumps(plan, ensure_ascii=False, indent=1))


if __name__ == "__main__":
    main(sys.argv[1])
