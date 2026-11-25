"""Sound design and the master: the cue sheet (work/cues.json, written by build.py) -> work/mix.wav.

python -X utf8 mix.py <video dir> [--music <file>] [--music-db -13] [--sfx-db -9] [--lufs -15.5]

The style: the user's own music bed 13.2 dB under the voice, no sound effects (the code-made kit is there with --sfx soft|full),
-15.5 LUFS. The music is always the user's own track (or SKYLIGHT_MUSIC), never one picked for them; without one, voice only.
Also writes work/cue_sheet.md (time, what happens, sound)."""
import argparse, json, os, subprocess, sys
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import SK, FFMPEG, rj, wt

SR = 48000
ALIAS = {'write': 'dull', 'ticks': 'pop', 'bubble': 'pop'}
WHAT = {'click': 'caption page (soft UI click)', 'notify': 'special word (menu notification)', 'glitch': 'word glitches in (micro mechanical)',
        'whoosh': 'pan right (long whoosh)', 'shutter': 'camera shutter on the pan-right cut', 'whoosh_v': 'vertical whip (deep whoosh)',
        'airy': 'back to the A-roll (soft airy whoosh)', 'pluck': 'name card line draws out (soft round pluck)', 'confirm': 'pill / label pops (UI confirm)',
        'gui': 'selector box glitches in (hi-tech GUI)', 'scribble': 'arrow draws on', 'tick_up': 'bar rises', 'tick_down': 'bar drops',
        'bloom': 'orbs merge (bloom)', 'shimmer': 'orbs appear (shimmer)', 'swipe': 'highlight box wipes in', 'pop': 'logo / object pops in',
        'bubble': 'repeated word (bubbly pop, pitched up)', 'ticks': 'cells light one by one', 'write': 'text writes out (dull pops)',
        'draw': 'line draws', 'gear': 'word glitches out (gearwheel)', 'wind': 'soft pan (wind)', 'dull': 'dull pop'}


def load(path):
    import soundfile as sf
    x, sr = sf.read(path, dtype='float32', always_2d=True)
    x = x.mean(axis=1)
    if sr != SR:
        x = np.interp(np.arange(int(len(x) * SR / sr)) * sr / SR, np.arange(len(x)), x).astype(np.float32)
    return x


def pitch(x, st):
    r = 2 ** (st / 12)
    return np.interp(np.arange(0, len(x), r), np.arange(len(x)), x).astype(np.float32)


def rms_db(x):
    return 20 * np.log10(np.sqrt(np.mean(x ** 2)) + 1e-9)


def active(x, thr_db=-45, win=0.05):
    n = int(SR * win)
    fr = x[:len(x) // n * n].reshape(-1, n)
    r = 20 * np.log10(np.sqrt((fr ** 2).mean(1)) + 1e-9)
    return fr[r > thr_db].ravel() if (r > thr_db).any() else x


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('dir')
    ap.add_argument('--music', default=os.environ.get('SKYLIGHT_MUSIC', 'none'),
                    help="the user's own track (default: $SKYLIGHT_MUSIC, else none). 'none' for no music")
    ap.add_argument('--sfx', default='off', choices=['off', 'soft', 'full'],
                    help="off (default: the style has no sound effects), soft = only transitions, full = the whole cue sheet")
    ap.add_argument('--music-db', type=float, default=-13.2)
    ap.add_argument('--sfx-db', type=float, default=-6.5, help='effects bus (its active level) against the voice')
    ap.add_argument('--lufs', type=float, default=-15.5)
    a = ap.parse_args()
    d = os.path.abspath(a.dir)
    voice = load(os.path.join(d, 'work', 'voice.wav'))
    cues = rj(os.path.join(d, 'work', 'cues.json'))
    kit = {}
    bus = np.zeros(len(voice) + SR * 2, np.float32)

    def get(k):
        if k not in kit:
            kit[k] = load(os.path.join(SK, 'sfx', ALIAS.get(k, k) + '.wav'))
        return kit[k]

    def put(x, t, g):
        s = max(0, int(t * SR))
        e = min(len(bus), s + len(x))
        if e > s:
            bus[s:e] += x[:e - s] * g

    rows = []
    SOFT = {'whoosh', 'whoosh_v', 'airy', 'wind', 'shutter'}
    cues = [] if a.sfx == 'off' else [c for c in cues if a.sfx == 'full' or c['kind'] in SOFT]
    for c in cues:
        k, t, g = c['kind'], c['t'], c.get('gain', 1.0)
        if k == 'bubble':
            put(pitch(get('pop'), c.get('st', 0)), t, g)
        elif k == 'ticks':
            n, du = max(1, min(int(c.get('n', 6)), 30)), c.get('dur', 1.0)
            for i in range(n):
                put(pitch(get('pop'), (i % 5) * 0.7), t + du * i / n, g * 0.45 * (1 - 0.4 * i / n))
        elif k == 'write':
            for i in range(5):
                put(get('dull'), t + 0.045 * i, g * 0.6)
        else:
            put(get(k), t, g)
        rows.append(f'| {t:6.2f} s | {WHAT.get(k, k)} | `{ALIAS.get(k, k)}.wav`{" +%d st" % c["st"] if c.get("st") else ""} |')
    bus = bus[:len(voice)]
    v_db = rms_db(active(voice))
    if cues:
        s_db = rms_db(active(bus, -50))
        bus *= 10 ** ((v_db + a.sfx_db - s_db) / 20)
    mix = voice + bus
    if a.music and a.music != 'none' and os.path.exists(a.music):
        m = load(a.music)
        m = np.resize(m, len(voice)) if len(m) < len(voice) else m[:len(voice)]
        fade = np.minimum(1, np.minimum(np.arange(len(m)) / (SR * 0.3), (len(m) - np.arange(len(m))) / (SR * 1.2)))
        m = m * fade
        m *= 10 ** ((v_db + a.music_db - rms_db(m)) / 20)
        mix = mix + m
    pre = os.path.join(d, 'work', 'mix_pre.wav')
    import soundfile as sf
    sf.write(pre, np.stack([mix, mix], 1), SR, subtype='FLOAT')
    out = os.path.join(d, 'work', 'mix.wav')
    # two-pass loudnorm: measure, then hit the target with a true-peak ceiling
    r = subprocess.run([FFMPEG, '-hide_banner', '-i', pre, '-af', f'loudnorm=I={a.lufs}:TP=-1.5:LRA=9:print_format=json', '-f', 'null', '-'],
                       capture_output=True, text=True, encoding='utf-8')
    j = json.loads(r.stderr[r.stderr.rfind('{'):r.stderr.rfind('}') + 1])
    af = (f'loudnorm=I={a.lufs}:TP=-1.5:LRA=9:measured_I={j["input_i"]}:measured_TP={j["input_tp"]}:measured_LRA={j["input_lra"]}:'
          f'measured_thresh={j["input_thresh"]}:offset={j["target_offset"]}:linear=true')
    subprocess.run([FFMPEG, '-hide_banner', '-loglevel', 'error', '-y', '-i', pre, '-af', af, '-ar', str(SR), '-c:a', 'pcm_s24le', out], check=True)
    os.remove(pre)
    wt(os.path.join(d, 'work', 'cue_sheet.md'), f'# Sound cue sheet: {len(cues)} cues, {len(cues) / (len(voice) / SR):.2f} a second\n\n'
       '| Time | What happens | Sound effect |\n|---|---|---|\n' + '\n'.join(rows) + '\n')
    has_m = a.music and a.music != 'none' and os.path.exists(a.music)
    print(f'wrote work/mix.wav ({a.lufs} LUFS, TP -1.5 dB; effects {a.sfx} {a.sfx_db if cues else ""}, music {os.path.basename(a.music) + " " + str(a.music_db) + " dB" if has_m else "none"}) '
          f'and work/cue_sheet.md ({len(cues)} cues)')


if __name__ == '__main__':
    main()
