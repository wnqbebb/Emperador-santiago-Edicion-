"""AutoEdit: sube un clip y sale editado, sin pausas (estilo Submagic / Captions).

  python3 pipeline/auto.py run CLIP.mp4 [--style auto-bold] [--name p] [--lang es] [--broll CARPETA] [--draft]
      → transcribe, corta silencios, subtítulos animados, zooms, b-roll (carpeta propia o Pixabay), cifras, sonido y música.
  python3 pipeline/auto.py brief <p>             → JSON con guion por frases + escenas disponibles (para que un modelo planifique)
  python3 pipeline/auto.py apply <p> PLAN.json [--draft]   → aplica el plan del modelo y renderiza
  python3 pipeline/auto.py styles                → estilos disponibles

Planificador sin modelo (heurístico): zoom por frase, cifra gigante cuando se dice un número, b-roll cada N segundos sobre
la frase con más sustantivos. Con modelo (vía MCP): el modelo lee `brief` y devuelve `scenes`."""
import argparse, json, os, re, shutil, subprocess, sys, time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
VES = [sys.executable, str(ROOT / "pipeline" / "ves.py")]
STOP = set("a al algo ante antes como con contra cual cuando de del desde donde durante e el ella ellas ellos en entre era es esa ese eso esta este esto fue ha hay la las le les lo los más mas me mi mis muy ni no nos o para pero por porque que qué se si sí sin sobre su sus te tu tus un una uno unos y ya yo the an and or but of to in on at for is are it this that you your we they with as by from so just then there what which who will can do not if have has".split())


def sh(cmd, **kw):
    r = subprocess.run([str(c) for c in cmd], cwd=ROOT, capture_output=True, text=True, **kw)
    if r.returncode:
        sys.exit(f"[auto] falló: {' '.join(str(c) for c in cmd)}\n{(r.stdout + r.stderr)[-1500:]}")
    return r.stdout


def J(p):
    return json.loads(Path(p).read_text())


def status(p, stage, **kw):
    (p / "auto_status.json").write_text(json.dumps({"stage": stage, "t": time.time(), **kw}, ensure_ascii=False))
    print(f"[auto] {stage}", flush=True)


def sentences(words):
    out, cur = [], []
    for w in words:
        cur.append(w)
        if re.search(r"[.!?]$", w["w"]):
            out.append(cur); cur = []
    if cur:
        out.append(cur)
    return [{"i": i, "start": s[0]["start"], "end": s[-1]["end"], "text": " ".join(w["w"] for w in s), "words": s} for i, s in enumerate(out)]


def keywords(sent, n=2):
    ws = [re.sub(r"[^\w]", "", w["w"].lower()) for w in sent["words"]]
    ws = [w for w in ws if w and w not in STOP and not w.isdigit() and len(w) > 3]
    return sorted(set(ws), key=lambda w: -len(w))[:n]


def autoplan(p, style, broll_dir=None):
    """plan heurístico: cifras, b-roll y cortes con zoom. Devuelve dict de plan."""
    words = J(p / "transcript_cut.json")["words"]
    sents = sentences(words)
    cfg = style.get("auto", {})
    scenes, cuts = [], []
    # 1) cifras: número dicho → cifra gigante sobre el A-roll
    if cfg.get("numbers", True):
        last = -9
        for i, w in enumerate(words):
            m = re.search(r"\d+[.,]?\d*\s*%?", w["w"])
            if m and w["start"] - last > 5 and w["start"] > 1.5:
                label = " ".join(x["w"] for x in words[i + 1:i + 3]).strip(".,;:!?")
                scenes.append({"id": f"n{len(scenes)}", "type": "arthur_number", "start": w["start"], "end": min(w["start"] + 1.6, words[-1]["end"]),
                               "props": {"value": m.group().strip(), "label": label}})
                last = w["start"]
    # 2) b-roll: carpeta propia o stock; una toma cada N s, sobre la frase con palabras más concretas
    media = []
    if broll_dir and Path(broll_dir).exists():
        dst = p / "media" / "broll"; dst.mkdir(parents=True, exist_ok=True)
        for f in sorted(Path(broll_dir).iterdir()):
            if f.suffix.lower() in (".mp4", ".mov", ".jpg", ".jpeg", ".png", ".webp"):
                shutil.copy2(f, dst / f.name); media.append(f"media/broll/{f.name}")
    every, blen = cfg.get("broll_every_s", 9), cfg.get("broll_len_s", 2.6)
    slots, t_next = [], 4.0
    for s in sents:
        if s["start"] >= t_next and s["end"] - s["start"] >= 1.2 and keywords(s) and not any(abs(n["start"] - s["start"]) < 2 for n in scenes):
            slots.append(s); t_next = s["start"] + every
    use_stock = not media and (os.environ.get("PIXABAY_API_KEY") or os.environ.get("PEXELS_API_KEY"))
    for k, s in enumerate(slots):
        m = None
        if media:
            m = media[k % len(media)] if k < len(media) * 2 else None
        elif use_stock:
            q = " ".join(keywords(s))
            subprocess.run([sys.executable, str(ROOT / "pipeline/stock_api.py"), p.name, "videos", q, "1"], cwd=ROOT, capture_output=True)
            hit = sorted((p / "media/stock").glob(f"*{'-'.join(q.lower().split())[:40]}*.mp4"))
            m = f"media/stock/{hit[0].name}" if hit else None
        if m:
            scenes.append({"id": f"b{k}", "type": "j_broll", "start": s["start"], "end": min(s["end"], s["start"] + blen),
                           "props": {"media": [m], "big": "", "captions_on": True}, "in": "zoom_blur"})
    # 3) cortes con zoom al empezar frases (el render deja solo los permitidos y separados)
    for s in sents[1:]:
        cuts.append({"t": s["start"], "type": "zoom_blur"})
    plan = {"style": style["id"], "scenes": sorted(scenes, key=lambda x: x["start"]), "cuts": cuts, "captions": {"enabled": True}, "assets": []}
    lib = ROOT / "assets/music_lib"
    for fo in style.get("music", {}).get("folders", []):
        tr = sorted((lib / fo).glob("*.mp3")) if (lib / fo).exists() else []
        if tr:
            plan["music"] = {"file": str(tr[hash(p.name) % len(tr)]), "volume": 0.14}; break
    return plan


def finish(p, draft):
    status(p, "renderizando")
    sh(VES + ["render", p.name, "--force"] + (["--draft"] if draft else []))
    status(p, "sonido")
    sh(VES + ["sound", p.name] + (["--draft"] if draft else []))
    out = p / "out" / ("BORRADOR_web.mp4" if draft else "master_web.mp4")
    status(p, "listo", output=str(out))
    print(f"[auto] ✓ {out}")
    return out


def prepare(a):
    name = a.name or re.sub(r"[^a-z0-9]+", "-", Path(a.video).stem.lower()).strip("-")[:30] or "clip"
    p = ROOT / "projects" / name
    if p.exists():
        shutil.rmtree(p)
    sh(VES + ["new", name, "--video", a.video, "--style", a.style])
    status(p, "transcribiendo")
    sh(VES + ["transcribe", name] + (["--lang", a.lang] if a.lang else []))
    status(p, "cortando silencios")
    sh(VES + ["rawcut", name])
    sh(VES + ["palette", name])
    sh(VES + ["captions", name])
    return p


def run(a):
    p = prepare(a)
    style = J(ROOT / "styles" / a.style / "style.json")
    status(p, "planificando")
    plan = autoplan(p, style, a.broll)
    (p / "edit_plan.json").write_text(json.dumps(plan, ensure_ascii=False, indent=1))
    print(f"[auto] plan: {len(plan['scenes'])} escenas ({[s['type'] for s in plan['scenes']]}), música: {'sí' if plan.get('music') else 'no'}")
    return finish(p, a.draft)


def brief(a):
    p = ROOT / "projects" / a.name
    meta = J(p / "project.json"); style = J(ROOT / "styles" / meta["style"] / "style.json")
    sch = J(ROOT / "schemas/scenes.json")
    sents = sentences(J(p / "transcript_cut.json")["words"])
    media = [str(f.relative_to(p)) for d in ("media/broll", "media/stock", "media/assets") if (p / d).exists() for f in sorted((p / d).iterdir())]
    out = {"project": a.name, "style": meta["style"], "duration": sents[-1]["end"] if sents else 0,
           "sentences": [{k: s[k] for k in ("i", "start", "end", "text")} | {"words": [[w["w"], w["start"]] for w in s["words"]]} for s in sents],
           "scene_types": {k: {"use_when": sch[k].get("use_when"), "props": sch[k].get("props")} for k in style["scenes_allowed"] if k in sch},
           "transitions_allowed": style.get("transitions", {}).get("allowed", []), "media_available": media,
           "rules": "Devuelve {\"scenes\":[{id,type,start,end,props,in?,out?}]}. Tiempos = segundos de palabras reales. Anuncia → cara (sin escena); "
                    "describe → b-roll/gráfico. Máx. 1 escena cada 4–6 s. No inventes rutas de media: usa solo media_available. Los subtítulos y zooms son automáticos."}
    print(json.dumps(out, ensure_ascii=False))


def apply(a):
    p = ROOT / "projects" / a.name
    meta = J(p / "project.json"); style = J(ROOT / "styles" / meta["style"] / "style.json")
    new = J(a.plan)
    plan = J(p / "edit_plan.json") if (p / "edit_plan.json").exists() else autoplan(p, style)
    ok = [s for s in new.get("scenes", []) if s.get("type") in style["scenes_allowed"] and "start" in s and "end" in s]
    plan["scenes"] = sorted(ok, key=lambda s: s["start"])
    (p / "edit_plan.json").write_text(json.dumps(plan, ensure_ascii=False, indent=1))
    print(f"[auto] plan del modelo: {len(ok)}/{len(new.get('scenes', []))} escenas válidas")
    return finish(p, a.draft)


def styles(a):
    for d in sorted((ROOT / "styles").iterdir()):
        f = d / "style.json"
        if f.exists():
            s = J(f); print(f"{d.name:28} {s.get('description', '')[:90]}")


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sp = ap.add_subparsers(dest="cmd", required=True)
    for n in ("run", "prepare"):
        r = sp.add_parser(n); r.add_argument("video"); r.add_argument("--style", default="auto-bold"); r.add_argument("--name"); r.add_argument("--lang", default="es")
        r.add_argument("--broll"); r.add_argument("--draft", action="store_true"); r.set_defaults(f=run if n == "run" else prepare)
    r = sp.add_parser("brief"); r.add_argument("name"); r.set_defaults(f=brief)
    r = sp.add_parser("apply"); r.add_argument("name"); r.add_argument("plan"); r.add_argument("--draft", action="store_true"); r.set_defaults(f=apply)
    r = sp.add_parser("styles"); r.set_defaults(f=styles)
    a = ap.parse_args(); a.f(a)
