"""Ayudas del estilo Kallaway.
  python3 pipeline/kal.py face <p>      → mide la cara (facetrack.json) y la escribe en cada k_split / k_pip del plan
  python3 pipeline/kal.py check <p>     → revisa el plan contra las reglas medidas (cambio arriba ≤2.5 s, k_word cada 12–31 s, franja 2.2–4.1 s)
"""
import json, statistics, sys
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent


def face(p):
    tr = json.loads((p / "facetrack.json").read_text()) if (p / "facetrack.json").exists() else []
    if not tr:
        return {"x": 0.5, "y": 0.36}
    return {"x": round(statistics.median((t["x"] + t["w"] / 2) / 1080 for t in tr), 3), "y": round(statistics.median((t["y"] + t["h"] / 2) / 1920 for t in tr), 3),
            "w": round(statistics.median(t["w"] / 1080 for t in tr), 3)}


def main():
    cmd, name = sys.argv[1], sys.argv[2]
    p = ROOT / "projects" / name
    plan = json.loads((p / "edit_plan.json").read_text())
    sc = sorted(plan["scenes"], key=lambda s: s["start"])
    if cmd == "face":
        f = face(p)
        for s in sc:
            if s["type"] in ("k_split", "k_pip", "n_frame", "l_movie"):   # Emperador: también Nick y Lobo
                s.setdefault("props", {})["face"] = f
        (p / "edit_plan.json").write_text(json.dumps(plan, ensure_ascii=False, indent=1))
        print("cara:", f)
    else:
        bad = []
        words = [s for s in sc if s["type"] == "k_word"]
        for a, b in zip(words, words[1:]):
            if not 10 <= b["start"] - a["start"] <= 33:
                bad.append(f"k_word a {a['start']:.1f} y {b['start']:.1f}: separación fuera de 12–31 s")
        for s in sc:
            d = s["end"] - s["start"]
            if s["type"] == "k_hook" and not 2.0 <= d <= 4.3:
                bad.append(f"{s['id']}: franja de {d:.1f} s (2.2–4.1)")
            if s["type"] in ("k_split", "k_pip"):
                top = s["props"].get("top", {})
                ev = [top.get(k) for k in ("cuts",)] and (top.get("cuts", []) + [x.get("t") for k in ("labels", "messages", "items", "slots") for x in top.get(k, []) if x.get("t") is not None])
                pts = sorted([s["start"]] + [e for e in ev if e] + [s["end"]])
                if max(b - a for a, b in zip(pts, pts[1:])) > 2.6:
                    bad.append(f"{s['id']}: la mitad superior pasa más de 2.5 s sin cambiar")
                if top.get("kind", "media") == "media" and not top.get("media"):
                    bad.append(f"{s['id']}: falta el material ({top.get('placeholder', '?')})")
        cover = sum(s["end"] - s["start"] for s in sc if s["type"] in ("k_split", "k_pip", "k_word"))
        print(f"{len(sc)} escenas · {cover:.1f} s cubiertos")
        print("\n".join("⚠ " + b for b in bad) or "✓ plan dentro de las reglas medidas")


if __name__ == "__main__":
    main()
