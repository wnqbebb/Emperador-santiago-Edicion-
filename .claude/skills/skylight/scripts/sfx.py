"""The Skylight sound kit, made in code (numpy only). Off by default (mix.py --sfx soft|full turns it on).

python -X utf8 sfx.py            writes <skill>/sfx/*.wav (48 kHz mono) + SOURCES.md

One sound per role on the cue sheet, made to the role's length and brightness:
  click     "User Interface, Click, UI Buttons"        every caption page
  notify    "Games, Video, Menu UI, Notification"      the special word
  glitch    "Mechanics, Electronics, Micro"            a word glitching in letter by letter
  gear      "Tiny Gearwheel, Spin, Metallic"           a word glitching out
  pop       "User Interface, Click" bubbly pop         repeated words (+0 / +2 / +4 semitones), logos
  whoosh    "Generic Long Whooshes, Fast"              pan right into B-roll / full screens
  shutter   "Communications, Camera, Nikon"            on the pan-right cut
  airy      "Classic, Airy"                            back to the A-roll (soft whoosh, zoom-out)
  wind      "Organic, Wind, Soft"                      the softer pan
  pluck     "Select, Soft Round Pluck, Short"          name-card line draws out
  confirm   "Futuristic Technology, UI Confirm"        pills, labels
  gui       "Hitech GUI, Scifi, Interact, Digital"     selector box glitching in
  dull      "User Interface, Alert, Pops, Dull"        text writing out letter by letter
  + swipe, tick_up, tick_down, bloom, shimmer, scribble, draw, whoosh_v for the other animations."""
import os, sys
import numpy as np

SR = 48000
SK = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
rng = np.random.default_rng(1234)


def t_(d):
    return np.arange(int(SR * d)) / SR


def env(d, a, r, shape=4.0):
    t = t_(d)
    e = np.minimum(1, t / max(a, 1e-4)) * np.exp(-np.maximum(0, t - a) * shape / max(r, 1e-4))
    return e


def svf(x, fc, q=0.7, mode='bp'):
    """State-variable filter; fc may be an array (a sweep)."""
    fc = np.broadcast_to(np.asarray(fc, float), x.shape)
    y = np.zeros_like(x)
    lp = bp = 0.0
    k = 1.0 / q
    for i in range(len(x)):
        f = 2 * np.sin(np.pi * min(fc[i], SR / 6) / SR)
        hp = x[i] - lp - k * bp
        bp += f * hp
        lp += f * bp
        y[i] = bp if mode == 'bp' else lp if mode == 'lp' else hp
    return y


def norm(x, peak=0.9):
    m = np.max(np.abs(x)) or 1
    return x * (peak / m)


def sine(f, d, ph=0):
    return np.sin(2 * np.pi * np.cumsum(np.broadcast_to(f, t_(d).shape)) / SR + ph)


def click():
    d = 0.05
    n = svf(rng.normal(0, 1, int(SR * d)), 3200, 1.4) * env(d, 0.0005, 0.008, 5)
    tone = sine(2300, d) * env(d, 0.0008, 0.018, 5) * 0.5
    return norm(n + tone, 0.7)


def notify():
    d = 0.75
    out = np.zeros(int(SR * d))
    for k, (f, at) in enumerate(((1318.5, 0.0), (1975.5, 0.075))):
        s = int(at * SR)
        dd = d - at
        b = (sine(f, dd) + 0.35 * sine(f * 2.01, dd) + 0.12 * sine(f * 3.02, dd)) * env(dd, 0.003, 0.35, 4)
        out[s:s + len(b)] += b * (0.8 if k == 0 else 1.0)
    return norm(out, 0.8)


def glitch():
    d = 0.42
    out = np.zeros(int(SR * d))
    for k in range(11):
        s = int(rng.uniform(0, d - 0.02) * SR)
        L = int(SR * rng.uniform(0.002, 0.006))
        b = svf(rng.normal(0, 1, L), rng.uniform(2500, 7000), 3) * np.hanning(L)
        out[s:s + L] += b * rng.uniform(0.4, 1)
    ring = (sine(3150, d) + 0.6 * sine(4730, d)) * env(d, 0.001, 0.08, 5) * 0.15
    return norm(out + ring, 0.65)


def gear():
    d = 0.4
    out = np.zeros(int(SR * d))
    for k in range(9):
        s = int((0.02 + k * 0.038) * SR)
        L = int(SR * 0.012)
        b = (svf(rng.normal(0, 1, L), 5200, 6) + 0.6 * sine(6100 + 90 * k, L / SR)) * np.exp(-np.arange(L) / (SR * 0.0025))
        out[s:s + L] += b * (1 - k * 0.07)
    return norm(out, 0.55)


def pop(f0=880):
    d = 0.14
    f = f0 * (0.35 + 0.65 * np.exp(-t_(d) / 0.012))
    b = sine(f, d) * env(d, 0.001, 0.06, 4)
    b += svf(rng.normal(0, 1, len(b)), 1800, 1.2) * env(d, 0.0005, 0.006, 5) * 0.25
    return norm(b, 0.75)


def whoosh(d=0.62, lo=350, hi=2600, peak=0.42):
    t = t_(d)
    p = t / d
    fc = lo + (hi - lo) * np.sin(np.pi * np.clip(p / (peak * 2), 0, 1) * 0.5) ** 2 * np.where(p < peak, 1, np.exp(-(p - peak) * 3))
    n = svf(rng.normal(0, 1, len(t)), fc, 0.9)
    e = np.where(p < peak, (p / peak) ** 2.2, np.exp(-(p - peak) / 0.16))
    return norm(n * e, 0.75)


def whoosh_v():
    return norm(whoosh(0.8, 160, 1600, 0.5) + 0.4 * sine(55 + 60 * np.exp(-t_(0.8) * 4), 0.8) * env(0.8, 0.3, 0.4, 3), 0.8)


def airy():
    d = 0.55
    t = t_(d)
    p = t / d
    n = svf(rng.normal(0, 1, len(t)), 3800 + 2500 * p, 0.6, 'hp')
    e = np.sin(np.pi * np.clip(p, 0, 1)) ** 2
    return norm(n * e, 0.4)


def wind():
    d = 0.7
    t = t_(d)
    n = svf(rng.normal(0, 1, len(t)), 900 + 700 * np.sin(t * 9), 0.8, 'bp')
    return norm(n * np.sin(np.pi * t / d) ** 1.5, 0.5)


def shutter():
    d = 0.16
    out = np.zeros(int(SR * d))
    for at, g in ((0.0, 1.0), (0.055, 0.8)):
        s = int(at * SR)
        L = int(SR * 0.045)
        tr = rng.normal(0, 1, L) * np.exp(-np.arange(L) / (SR * 0.0012))
        body = (svf(rng.normal(0, 1, L), 1500, 4) + 0.7 * svf(rng.normal(0, 1, L), 4200, 5)) * np.exp(-np.arange(L) / (SR * 0.009))
        thump = sine(120, L / SR) * np.exp(-np.arange(L) / (SR * 0.01)) * 0.6
        out[s:s + L] += g * (tr * 0.6 + body + thump)
    return norm(out, 0.7)


def pluck():
    d = 0.35
    b = (sine(880, d) + 0.3 * sine(1760, d) + 0.08 * sine(2640, d)) * env(d, 0.002, 0.12, 5)
    return norm(b, 0.6)


def confirm():
    d = 0.42
    out = np.zeros(int(SR * d))
    for f, at in ((1046.5, 0.0), (1568, 0.07)):
        s = int(at * SR)
        dd = d - at
        b = (sine(f, dd) + 0.25 * sine(f * 2, dd)) * env(dd, 0.002, 0.16, 5)
        out[s:s + len(b)] += b
    out[:int(SR * 0.05)] += click()[:int(SR * 0.05)] * 0.3
    return norm(out, 0.65)


def gui():
    d = 0.32
    out = np.zeros(int(SR * d))
    for k, at in enumerate((0.0, 0.07, 0.13)):
        s = int(at * SR)
        L = int(SR * 0.06)
        f = 1200 + 2200 * (np.arange(L) / L) if k % 2 == 0 else 3400 - 1800 * (np.arange(L) / L)
        b = np.sign(sine(f, L / SR)) * 0.3 + sine(f, L / SR) * 0.7
        out[s:s + L] += b * np.hanning(L) * (1 - 0.2 * k)
    return norm(np.round(out * 12) / 12, 0.45)                 # a touch of bit crush: digital


def dull():
    return norm(pop(420) * 0.9, 0.5)


def swipe():
    return norm(whoosh(0.22, 900, 5200, 0.6), 0.45)


def tick(up=True):
    d = 0.16
    f = np.linspace(650, 1250, int(SR * d)) if up else np.linspace(1250, 620, int(SR * d))
    return norm(sine(f, d) * env(d, 0.002, 0.07, 5) + click()[:int(SR * d)] * 0.2 if len(click()) >= int(SR * d) else sine(f, d) * env(d, 0.002, 0.07, 5), 0.5)


def bloom():
    d = 1.1
    t = t_(d)
    n = svf(rng.normal(0, 1, len(t)), 1500 + 2500 * np.exp(-t * 3), 0.7) * env(d, 0.18, 0.6, 3) * 0.6
    pad = (sine(523, d) + sine(784, d) * 0.6 + sine(1046, d) * 0.4) * env(d, 0.12, 0.7, 3) * 0.5
    return norm(n + pad, 0.65)


def shimmer():
    d = 1.2
    out = np.zeros(int(SR * d))
    for f in (3520, 4186, 4699, 5274):
        out += sine(f * rng.uniform(0.995, 1.005), d) * env(d, 0.25, 0.8, 3) * rng.uniform(0.4, 1)
    return norm(out, 0.25)


def scribble():
    d = 0.4
    t = t_(d)
    n = svf(rng.normal(0, 1, len(t)), 4200, 0.8) * (0.55 + 0.45 * np.sin(2 * np.pi * 34 * t)) * np.sin(np.pi * t / d)
    return norm(n, 0.3)


def draw():
    d = 0.9
    t = t_(d)
    n = svf(rng.normal(0, 1, len(t)), 2000 + 1500 * t / d, 0.7) * np.sin(np.pi * t / d) ** 1.2
    return norm(n, 0.3)


KIT = {'click': click, 'notify': notify, 'glitch': glitch, 'gear': gear, 'pop': pop, 'whoosh': whoosh, 'whoosh_v': whoosh_v,
       'airy': airy, 'wind': wind, 'shutter': shutter, 'pluck': pluck, 'confirm': confirm, 'gui': gui, 'dull': dull,
       'swipe': swipe, 'tick_up': lambda: tick(True), 'tick_down': lambda: tick(False), 'bloom': bloom, 'shimmer': shimmer,
       'scribble': scribble, 'draw': draw}


def main():
    import soundfile as sf
    out = os.path.join(SK, 'sfx')
    os.makedirs(out, exist_ok=True)
    for name, fn in KIT.items():
        x = fn().astype(np.float32)
        x = np.concatenate([x, np.zeros(int(SR * 0.02), np.float32)])
        sf.write(os.path.join(out, name + '.wav'), x, SR, subtype='PCM_24')
    with open(os.path.join(out, 'SOURCES.md'), 'w', encoding='utf-8') as f:
        f.write('# Sound kit\n\nEvery sound here is made in code by `scripts/sfx.py` (numpy noise, sines and filters). Nothing is cut '
                'from a video or a sound library, so the kit is free to use anywhere. Regenerate with '
                '`python -X utf8 scripts/sfx.py`.\n\n' + '\n'.join(f'- `{n}.wav`' for n in KIT) + '\n')
    print('wrote', len(KIT), 'sounds to', out)


if __name__ == '__main__':
    main()
