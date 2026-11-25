"""The three textures and the two sky plates, made in code (no downloads, no licences).

python -X utf8 gen_assets.py <video dir>

Three consistent textures: a rough cloth (light, over B-roll), halftone dots (cut-out layouts) and light paper (behind the white
animations). The plates are the generated places the "world" scenes put cut-out objects into:
day sky, night (stars, moon), sunset, studio (dark / light sweep with a spotlight), space, plus two transparent cloud layers that
drift at different speeds over a plate (parallax).
Writes scenes/assets/tex/{cloth,halftone,paper}.png and scenes/assets/plates/{sky,night}.jpg (1080x1920)."""
import os, sys
import numpy as np
from PIL import Image, ImageFilter
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import W, H


def fbm(w, h, oct_=6, base=4, seed=1, persist=0.55):
    rng = np.random.default_rng(seed)
    out = np.zeros((h, w), np.float32)
    amp, tot = 1.0, 0.0
    for o in range(oct_):
        gw, gh = base * 2 ** o + 1, int((base * 2 ** o) * h / w) + 2
        g = rng.random((gh, gw)).astype(np.float32)
        im = Image.fromarray((g * 255).astype(np.uint8)).resize((w, h), Image.BICUBIC)
        out += amp * (np.asarray(im, np.float32) / 255.0)
        tot += amp
        amp *= persist
    return out / tot


def save_l(a, path):
    Image.fromarray(np.clip(a, 0, 255).astype(np.uint8)).convert('RGB').save(path)


def cloth(path):
    rng = np.random.default_rng(3)
    y, x = np.mgrid[0:H, 0:W].astype(np.float32)
    warp = np.sin(x * 0.9 + rng.random() * 6) * 0.5 + 0.5
    weft = np.sin(y * 0.9 + rng.random() * 6) * 0.5 + 0.5
    thread = 0.5 * warp + 0.5 * weft
    slub = fbm(W, H, 5, 24, seed=4)
    grain = rng.normal(0, 1, (H, W)).astype(np.float32)
    v = 232 + 14 * thread - 18 * (slub - 0.5) + 6 * grain
    save_l(v, path)


def halftone(path, cell=14):
    y, x = np.mgrid[0:H, 0:W].astype(np.float32)
    cx, cy = (x % cell) - cell / 2, (y % cell) - cell / 2
    r = np.hypot(cx, cy)
    tone = 0.25 + 0.55 * fbm(W, H, 3, 3, seed=9)                 # dot size wanders, like a print
    rad = tone * cell * 0.5
    dots = np.clip(rad - r + 0.7, 0, 1)
    save_l(255 - 150 * dots, path)


def paper(path):
    rng = np.random.default_rng(5)
    fib = fbm(W, H, 7, 40, seed=6, persist=0.62)
    streak = np.asarray(Image.fromarray((rng.random((H // 6, W // 2)) * 255).astype(np.uint8)).resize((W, H), Image.BICUBIC), np.float32) / 255
    grain = rng.normal(0, 1, (H, W)).astype(np.float32)
    v = 246 + 8 * (fib - 0.5) - 5 * (streak - 0.5) + 2.5 * grain
    save_l(v, path)


def sky(path):
    y = np.linspace(0, 1, H, dtype=np.float32)[:, None]
    top, bot = np.array([46, 112, 196], np.float32), np.array([170, 205, 238], np.float32)
    base = top + (bot - top) * (y ** 0.9)[..., None]
    base = np.repeat(base, W, axis=1)
    n = fbm(W, H, 7, 3, seed=11, persist=0.56)
    n2 = fbm(W, H, 5, 8, seed=12)
    dens = np.clip((n - 0.47) * 3.2 + (y - 0.35) * 0.55, 0, 1) ** 1.4     # more cloud low in the frame
    shade = 0.82 + 0.18 * np.clip((n2 - 0.3) * 1.6, 0, 1)
    cloud = np.stack([shade * 255, shade * 253, shade * 250], -1)
    img = base * (1 - dens[..., None]) + cloud * dens[..., None]
    Image.fromarray(np.clip(img, 0, 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.2)).save(path, quality=92)


def night(path):
    rng = np.random.default_rng(21)
    y = np.linspace(0, 1, H, dtype=np.float32)[:, None]
    top, bot = np.array([6, 12, 38], np.float32), np.array([28, 52, 112], np.float32)
    img = np.repeat((top + (bot - top) * y[..., None]), W, axis=1)
    for _ in range(1400):                                           # stars
        sx, sy = rng.integers(0, W), rng.integers(0, int(H * 0.8))
        b = rng.random() ** 3 * 230 + 25
        img[sy, sx] = np.minimum(255, img[sy, sx] + b)
    img = np.asarray(Image.fromarray(np.clip(img, 0, 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.6)), np.float32)
    n = fbm(W, H, 6, 4, seed=22)                                     # low clouds, lit by the moon
    dens = np.clip((n - 0.5) * 3 + (y - 0.72) * 2.4, 0, 1) ** 1.3
    img = img * (1 - dens[..., None]) + np.array([120, 140, 182], np.float32) * dens[..., None]
    mx, my, R = int(W * 0.72), int(H * 0.16), 120                    # the moon
    yy, xx = np.mgrid[0:H, 0:W]
    d = np.hypot(xx - mx, yy - my)
    glow = np.exp(-np.clip(d - R, 0, None) / 90.0) * (d > R)
    img += glow[..., None] * np.array([60, 70, 95], np.float32)
    crater = fbm(2 * R, 2 * R, 5, 5, seed=23)
    disk = d < R
    sub = (slice(my - R, my + R), slice(mx - R, mx + R))
    lum = 205 + 45 * (crater - 0.5) * 2
    shade = np.clip(1 - ((xx[sub] - mx + R * 0.3) ** 2 + (yy[sub] - my + R * 0.2) ** 2) / (2.2 * R * R), 0.55, 1)
    moon = np.stack([lum * shade, lum * shade * 0.99, lum * shade * 0.95], -1)
    img[sub][disk[sub]] = moon[disk[sub]]
    reg = img[sub]
    reg[disk[sub]] = moon[disk[sub]]
    img[sub] = reg
    Image.fromarray(np.clip(img, 0, 255).astype(np.uint8)).save(path, quality=92)


def smooth(a, lo, hi):
    x = np.clip((a - lo) / (hi - lo), 0, 1)
    return x * x * (3 - 2 * x)


def cloud_layer(path, seed=31, density=0.5, low=True):
    """Soft clouds on transparency, for parallax layers drifting over any plate."""
    n = fbm(W, H, 6, 3, seed=seed, persist=0.5)
    y = np.linspace(0, 1, H, dtype=np.float32)[:, None]
    bias = (y - 0.55) * 0.5 if low else 0
    a = smooth(n + bias, 0.62 - density * 0.12, 0.85 - density * 0.1)
    shade = 0.86 + 0.14 * smooth(fbm(W, H, 4, 6, seed=seed + 1), 0.3, 0.7)
    rgb = np.stack([shade * 255, shade * 252, shade * 248], -1)
    img = np.dstack([rgb, a * 235]).astype(np.uint8)
    Image.fromarray(img).filter(ImageFilter.GaussianBlur(2.5)).save(path)


def sunset(path):
    y = np.linspace(0, 1, H, dtype=np.float32)[:, None, None]
    stops = [(0.0, (34, 28, 74)), (0.35, (120, 64, 128)), (0.62, (236, 128, 92)), (0.78, (252, 196, 128)), (1.0, (255, 226, 170))]
    img = np.zeros((H, 1, 3), np.float32)
    for (a, ca), (b, cb) in zip(stops[:-1], stops[1:]):
        m = (y >= a) & (y <= b)
        t = np.clip((y - a) / (b - a), 0, 1)
        img = np.where(m, np.array(ca) + (np.array(cb) - np.array(ca)) * t, img)
    img = np.repeat(img, W, axis=1)
    yy, xx = np.mgrid[0:H, 0:W]
    d = np.hypot(xx - W * 0.5, yy - H * 0.74)
    img += (np.exp(-d / 260.0) * 120)[..., None] * np.array([1.0, 0.75, 0.45])
    img = np.where((d < 120)[..., None], np.array([255, 236, 196], np.float32), img)
    Image.fromarray(np.clip(img, 0, 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.0)).save(path, quality=92)


def studio(path, dark=True):
    """A seamless studio sweep with a soft spotlight and a floor: for objects shown like products."""
    y = np.linspace(0, 1, H, dtype=np.float32)[:, None]
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    spot = np.exp(-(((xx - W / 2) / 520) ** 2 + ((yy - H * 0.45) / 820) ** 2))
    base = (22 + 70 * spot) if dark else (205 + 45 * spot)
    floor = smooth(y, 0.62, 0.8)
    v = base * (1 - (0.25 if dark else 0.07) * floor) + np.random.default_rng(7).normal(0, 1.2, (H, W))
    tint = np.array([0.92, 0.97, 1.08]) if dark else np.array([0.99, 0.99, 1.0])
    Image.fromarray(np.clip(v[..., None] * tint, 0, 255).astype(np.uint8)).save(path, quality=92)


def space(path):
    rng = np.random.default_rng(41)
    img = np.zeros((H, W, 3), np.float32) + np.array([4, 6, 16], np.float32)
    neb = fbm(W, H, 7, 3, seed=42, persist=0.6)
    neb2 = fbm(W, H, 6, 4, seed=43)
    img += (smooth(neb, 0.5, 0.85) ** 1.5)[..., None] * np.array([70, 40, 140]) + (smooth(neb2, 0.55, 0.9) ** 2)[..., None] * np.array([20, 90, 160])
    for _ in range(2200):
        x, y = rng.integers(0, W), rng.integers(0, H)
        img[y, x] += rng.random() ** 3 * 255
    Image.fromarray(np.clip(img, 0, 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.7)).save(path, quality=92)


def main():
    d = os.path.abspath(sys.argv[1])
    t = os.path.join(d, 'scenes', 'assets', 'tex')
    p = os.path.join(d, 'scenes', 'assets', 'plates')
    os.makedirs(t, exist_ok=True)
    os.makedirs(p, exist_ok=True)
    cloth(os.path.join(t, 'cloth.png'))
    halftone(os.path.join(t, 'halftone.png'))
    paper(os.path.join(t, 'paper.png'))
    sky(os.path.join(p, 'sky.jpg'))
    night(os.path.join(p, 'night.jpg'))
    sunset(os.path.join(p, 'sunset.jpg'))
    studio(os.path.join(p, 'studio.jpg'), True)
    studio(os.path.join(p, 'studio_light.jpg'), False)
    space(os.path.join(p, 'space.jpg'))
    cloud_layer(os.path.join(p, 'clouds_back.png'), 31, 0.45)
    cloud_layer(os.path.join(p, 'clouds_front.png'), 57, 0.3)
    print('wrote scenes/assets/tex/{cloth,halftone,paper}.png and scenes/assets/plates/'
          '{sky,night,sunset,studio,studio_light,space}.jpg + clouds_back/front.png (parallax layers)')


if __name__ == '__main__':
    main()
