"""The look: pull the accent colour out of the A-roll and make the four tones Skylight uses in every scene.

python -X utf8 palette.py <video dir> [--src work/aroll.mp4]

The rule: look at the A-roll, pick the colour that really stands out, then make two vibrant versions (one bright, one dark)
and two dull ones (one white, one black), and use those in every single scene. Three options, the user picks one.
Writes work/palette.json (3 options, pick 0 by default) and work/palette.png (the swatches, to show the user).
The blue reference palette: bright #2a5cff, dark #3f6f99, pale #cfe0f5, white #eceef5, black #0d0d11."""
import argparse, colorsys, os, sys
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import probe, frames, wj


def srgb_to_lab(rgb):
    c = rgb / 255.0
    c = np.where(c > 0.04045, ((c + 0.055) / 1.055) ** 2.4, c / 12.92)
    M = np.array([[0.4124, 0.3576, 0.1805], [0.2126, 0.7152, 0.0722], [0.0193, 0.1192, 0.9505]])
    xyz = c @ M.T / np.array([0.95047, 1.0, 1.08883])
    f = np.where(xyz > 0.008856, np.cbrt(xyz), 7.787 * xyz + 16 / 116)
    return np.stack([116 * f[..., 1] - 16, 500 * (f[..., 0] - f[..., 1]), 200 * (f[..., 1] - f[..., 2])], -1)


def lch_to_hex(L, C, h):
    """LCh -> sRGB hex, lowering chroma until it fits the gamut."""
    with np.errstate(all='ignore'):
        return _lch_to_hex(L, C, h)


def _lch_to_hex(L, C, h):
    for c in np.linspace(C, 0, 40):
        a, b = c * np.cos(np.radians(h)), c * np.sin(np.radians(h))
        fy = (L + 16) / 116
        fx, fz = fy + a / 500, fy - b / 200
        xyz = np.array([fx ** 3 if fx ** 3 > 0.008856 else (fx - 16 / 116) / 7.787,
                        fy ** 3 if fy ** 3 > 0.008856 else (fy - 16 / 116) / 7.787,
                        fz ** 3 if fz ** 3 > 0.008856 else (fz - 16 / 116) / 7.787]) * np.array([0.95047, 1.0, 1.08883])
        Mi = np.array([[3.2406, -1.5372, -0.4986], [-0.9689, 1.8758, 0.0415], [0.0557, -0.2040, 1.0570]])
        lin = Mi @ xyz
        rgb = np.where(lin > 0.0031308, 1.055 * np.power(np.clip(lin, 0, None), 1 / 2.4) - 0.055, 12.92 * lin)
        if (rgb >= -0.002).all() and (rgb <= 1.002).all():
            r, g, b_ = (np.clip(rgb, 0, 1) * 255).round().astype(int)
            return f'#{r:02x}{g:02x}{b_:02x}'
    return '#808080'


def tones(h, name):
    # lightness / chroma of each tone, set from the blue reference palette: bright #2a5cff = L45 C92 h292, dark #3f6f99 = L44 C27 h262,
    # pale #cfe0f5 = L88 C12 h265. In the blue range the bright tone leans violet and the dark one toward steel.
    hb, hd = (292, 262) if 225 <= h <= 300 else (h, h)
    return {'name': name, 'hue': round(float(h), 1),
            'bright': lch_to_hex(46, 90, hb), 'dark': lch_to_hex(43, 28, hd), 'pale': lch_to_hex(88, 13, hd),
            'white': lch_to_hex(94.5, 2.6, h), 'black': lch_to_hex(4.5, 2.0, h), 'ring': lch_to_hex(90, 3.5, h)}


def hue_name(h):
    for lim, n in ((45, 'red'), (60, 'orange'), (75, 'gold'), (105, 'yellow'), (150, 'green'), (200, 'teal'), (240, 'cyan'),
                   (290, 'blue'), (330, 'violet'), (360, 'red')):
        if h < lim:
            return n
    return 'red'


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('dir')
    ap.add_argument('--src', default='work/aroll.mp4')
    a = ap.parse_args()
    d = os.path.abspath(a.dir)
    src = os.path.join(d, a.src)
    dur = probe(src)['dur']
    px = []
    for fr in frames(src, 96, 170, fps=max(0.2, 24 / max(1, dur))):
        px.append(fr[:, :, ::-1].reshape(-1, 3))
    px = np.concatenate(px).astype(np.float64)
    with np.errstate(all='ignore'):        # numpy + Accelerate on macOS raises spurious matmul warnings
        lab = srgb_to_lab(px)
    L, A, B = lab[:, 0], lab[:, 1], lab[:, 2]
    C = np.hypot(A, B)
    hdeg = (np.degrees(np.arctan2(B, A)) + 360) % 360
    # skin sits around h 30-75 with mid chroma: it never wins (the accent comes from the set, never from a face)
    skin = (hdeg > 25) & (hdeg < 80) & (C < 45) & (L > 25)
    use = (C > 6) & (L > 12) & (L < 92) & ~skin
    hist = np.zeros(36)
    for k in range(36):
        sel = use & (hdeg >= k * 10) & (hdeg < k * 10 + 10)
        hist[k] = (C[sel] ** 1.3).sum()        # area x vividness
    hist = np.convolve(np.r_[hist[-1], hist, hist[0]], [0.25, 0.5, 0.25], 'valid')
    order = np.argsort(-hist)
    picks = []
    for k in order:
        h = k * 10 + 5
        if all(min(abs(h - p), 360 - abs(h - p)) >= 45 for p in picks) and hist[k] > 0:
            picks.append(h)
        if len(picks) == 2:
            break
    opts = [tones(h, f'{hue_name(h)} (from the footage)') for h in picks]
    if not any(225 <= o['hue'] <= 290 for o in opts):
        opts.append(tones(265, 'accent blue (the default)'))
    while len(opts) < 3:
        opts.append(tones((opts[-1]['hue'] + 150) % 360, 'contrast'))
    wj(os.path.join(d, 'work', 'palette.json'), {'pick': 0, 'options': opts[:3]})

    from PIL import Image, ImageDraw
    im = Image.new('RGB', (1200, 3 * 170 + 20), '#121212')
    dr = ImageDraw.Draw(im)
    for i, o in enumerate(opts[:3]):
        y = 20 + i * 170
        dr.text((20, y), f'{i}: {o["name"]}', fill='#ffffff')
        for j, k in enumerate(('bright', 'dark', 'pale', 'white', 'black')):
            dr.rectangle([20 + j * 230, y + 24, 20 + j * 230 + 210, y + 150], fill=o[k], outline='#444444')
            dr.text((28 + j * 230, y + 130), f'{k} {o[k]}', fill='#000000' if k in ('pale', 'white') else '#ffffff')
    im.save(os.path.join(d, 'work', 'palette.png'))
    for i, o in enumerate(opts[:3]):
        print(f'{i}: {o["name"]:44s} bright {o["bright"]} dark {o["dark"]} pale {o["pale"]} white {o["white"]} black {o["black"]}')
    print('wrote work/palette.json (pick 0; set "palette" in plan.json to choose) and work/palette.png')


if __name__ == '__main__':
    main()
