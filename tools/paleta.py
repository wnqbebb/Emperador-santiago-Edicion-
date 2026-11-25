#!/usr/bin/env python3
"""Paleta sacada del PROPIO video (regla 19 del método): colores que ya están en el material (cabello, ropa, fondo),
medidos para que los subtítulos y los gráficos RESALTEN.
Uso: python paleta.py video.mp4 salida_dir  → salida_dir/paleta.json + salida_dir/cuadro.jpg
"""
import colorsys, json, subprocess, sys, tempfile
from pathlib import Path
import numpy as np
from PIL import Image

video, out = sys.argv[1], Path(sys.argv[2])
out.mkdir(parents=True, exist_ok=True)
dur = float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", video], capture_output=True, text=True).stdout or 10)

frames = []
with tempfile.TemporaryDirectory() as tmp:
    n = 10
    for i in range(n):
        t = dur * (i + 0.5) / n
        f = Path(tmp) / f"{i}.png"
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", f"{t:.2f}", "-i", video, "-frames:v", "1", "-vf", "scale=180:-2", str(f)], check=True)
        frames.append(np.asarray(Image.open(f).convert("RGB"), dtype=np.float32) / 255.0)
    # cuadro grande del centro del video para la vista previa en la app
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", f"{dur * 0.35:.2f}", "-i", video, "-frames:v", "1", "-vf", "scale=540:-2", "-q:v", "3", str(out / "cuadro.jpg")], check=True)

H, W, _ = frames[0].shape
ys = np.repeat(np.linspace(0, 1, H)[:, None], W, axis=1)
xs = np.repeat(np.linspace(0, 1, W)[None, :], H, axis=0)
px = np.concatenate([f.reshape(-1, 3) for f in frames])
py = np.tile(ys.reshape(-1), len(frames)); pxx = np.tile(xs.reshape(-1), len(frames))

def lum(c):
    c = np.where(c <= 0.03928, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)
    return 0.2126 * c[..., 0] + 0.7152 * c[..., 1] + 0.0722 * c[..., 2]
def contrast(a, b):
    la, lb = lum(np.array(a)), lum(np.array(b))
    return float((max(la, lb) + 0.05) / (min(la, lb) + 0.05))
def hexc(rgb): return "#" + "".join(f"{int(round(max(0, min(1, v)) * 255)):02X}" for v in rgb)
def hls(h, l, s): return colorsys.hls_to_rgb(h % 1, max(0, min(1, l)), max(0, min(1, s)))

# k-means simple (k=10) sobre el color
rng = np.random.default_rng(7)
sample = rng.choice(len(px), min(40000, len(px)), replace=False)
X, Y, XX = px[sample], py[sample], pxx[sample]
C = X[rng.choice(len(X), 14, replace=False)]
for _ in range(15):
    lab = np.argmin(((X[:, None, :] - C[None]) ** 2).sum(-1), 1)
    C = np.array([X[lab == k].mean(0) if (lab == k).any() else C[k] for k in range(len(C))])
share = np.bincount(lab, minlength=len(C)) / len(X)
if "--debug" in sys.argv:
    for k, c in enumerate(C): print(hexc(c) if False else "#%02X%02X%02X" % tuple(int(v*255) for v in c), round(float(share[k]),3), [round(v,2) for v in colorsys.rgb_to_hls(*c)], file=sys.stderr)

# zona de subtítulos (centro, 55–75 % del alto): el color clave tiene que despegarse de lo que hay ahí
zone = px[(py > 0.55) & (py < 0.75) & (pxx > 0.2) & (pxx < 0.8)]
zone_med = np.median(zone, 0)

HUES = [(0.03, "rojo"), (0.07, "cobre"), (0.1, "naranja"), (0.13, "ámbar"), (0.17, "dorado"), (0.25, "lima"), (0.38, "verde"),
        (0.5, "turquesa"), (0.58, "celeste"), (0.66, "azul"), (0.75, "violeta"), (0.85, "magenta"), (0.93, "rosa"), (1.01, "rojo")]
def name(h, l, s):
    n = next(nm for lim, nm in HUES if h < lim)
    if s < 0.3 and l > 0.6: n = {"cobre": "beige", "naranja": "beige", "ámbar": "arena", "dorado": "crema"}.get(n, n + " suave")
    elif l < 0.32: n = n + " profundo"
    return n
def where(k):
    m = lab == k
    yy, xx = Y[m].mean(), XX[m].mean()
    edge = ((XX[m] < 0.15) | (XX[m] > 0.85)).mean()
    if edge > 0.45: return "el fondo"
    if yy < 0.3: return "la parte de arriba (cabello / cabeza)"
    if yy < 0.6: return "el centro (cara / ropa)"
    return "la parte de abajo (ropa)"

# tono principal del material = el grupo con color más presente (pondera cantidad × saturación)
colored = [(k, *colorsys.rgb_to_hls(*c)) for k, c in enumerate(C)]
colored = [(k, h, l, s_) for k, h, l, s_ in colored if s_ >= 0.12 and 0.12 < l < 0.9 and share[k] > 0.004]
dom = C[np.argmax(share)]
dh, dl, ds = colorsys.rgb_to_hls(*dom)
if colored:
    k0, h0, l0, s0 = max(colored, key=lambda t: share[t[0]] * t[3])
    src0, orig0 = where(k0), hexc(C[k0])
    vivid = max(colored, key=lambda t: t[3])          # el más saturado (cabello, una prenda…)
    deep = min(colored, key=lambda t: t[2])           # el más oscuro con color (sombra de la ropa, leopardo…)
else:
    h0, s0, src0, orig0 = dh, 0.5, "el material", hexc(dom); vivid = deep = (0, dh, dl, 0.5)
cands = [
    {"h": vivid[1], "L": 0.5, "sat": max(0.7, vivid[3] * 1.7), "share": 1, "src": f"el color más vivo del video ({where(vivid[0]) if colored else 'material'})", "orig": hexc(C[vivid[0]]) if colored else orig0, "kind": "vivo"},
    {"h": deep[1], "L": 0.3, "sat": max(0.55, deep[3] * 1.4), "share": 1, "src": f"el tono profundo del video ({where(deep[0]) if colored else 'material'})", "orig": hexc(C[deep[0]]) if colored else orig0, "kind": "profundo"},
    {"h": h0, "L": 0.6, "sat": 0.6, "share": 1, "src": f"el tono que más se repite ({src0})", "orig": orig0, "kind": "suave"},
    {"h": (h0 + 0.07) % 1, "L": 0.5, "sat": 0.85, "share": 0.5, "src": "análogo: vecino cálido/frío del tono del video", "orig": orig0, "kind": "analogo"},
    {"h": (h0 + 0.5) % 1, "L": 0.48, "sat": 0.85, "share": 0, "src": "complementario del tono del video (contraste máximo)", "orig": orig0, "kind": "complementario"},
    {"h": (h0 + 0.42) % 1, "L": 0.32, "sat": 0.6, "share": 0, "src": "complementario profundo (elegante)", "orig": orig0, "kind": "complementario profundo"},
]

opts = []
for c in cands:
    sat = max(0.5, min(0.95, c["sat"]))
    acc = hls(c["h"], c["L"], sat)
    # aclarar/oscurecer lo justo para que se lea sobre el papel claro (≥ 3:1)
    paper = hls(dh if ds > 0.08 else c["h"], 0.955, 0.18)
    L = c["L"]
    while contrast(acc, paper) < 3.2 and L > 0.25:
        L -= 0.03; acc = hls(c["h"], L, sat)
    dark = hls(c["h"], max(0.16, L * 0.5), sat * 0.9)
    black = hls(c["h"], 0.06, 0.12)
    # resaltado (el "amarillo" de Arthur): mismo tono, más luminoso, para palabras clave y destellos
    highlight = hls(c["h"] + 0.03, 0.62, min(1, sat * 1.05))
    # subtítulos sobre el A-roll: diferencia de color y de luz con lo que hay en la zona del texto
    de = float(np.linalg.norm(np.array(acc) - zone_med))
    zc = contrast(acc, zone_med)
    caption = hexc(acc)
    if zc < 2.2:   # se pierde sobre el video → la versión del mismo tono que más se despega (más clara u oscura)
        best = max((hls(c["h"], LL, sat) for LL in (0.18, 0.25, 0.32, 0.62, 0.7, 0.78)), key=lambda v: contrast(v, zone_med))
        caption = hexc(best); zc = contrast(best, zone_med)
    score = 0.4 * min(1, de / 0.6) + 0.3 * min(1, zc / 4.5) + 0.15 * sat + 0.15 * c["share"]  # preferimos colores del propio video
    opts.append({
        "name": f'{name(c["h"], 0.5, sat).capitalize()} {c["kind"]}', "from": c["src"], "original": c["orig"],
        "colors": {"vibrant_bright": hexc(acc), "vibrant_dark": hexc(dark), "dull_white": hexc(paper), "dull_black": hexc(black), "highlight": hexc(highlight)},
        "caption": caption, "score": round(float(score), 3),
        "contrast_paper": round(contrast(acc, paper), 2), "contrast_video": round(zc, 2),
    })
# quitar casi-duplicados y ordenar por cuánto resalta
rgb = lambda hx: np.array([int(hx[i:i+2], 16) / 255 for i in (1, 3, 5)])
opts.sort(key=lambda o: -o["score"])
uniq = []
for o in opts:
    if all(np.linalg.norm(rgb(o["colors"]["vibrant_bright"]) - rgb(u["colors"]["vibrant_bright"])) > 0.12 for u in uniq):
        uniq.append(o)
uniq = uniq[:6]
if uniq: uniq[0]["recommended"] = True
(out / "paleta.json").write_text(json.dumps({"options": uniq, "zone": hexc(zone_med), "dominant": hexc(dom)}, ensure_ascii=False, indent=1))
print(json.dumps([(o["name"], o["colors"]["vibrant_bright"], o["caption"], o["from"], o["score"]) for o in uniq], ensure_ascii=False))
