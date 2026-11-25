"""Clipper step 1: the word-by-word transcript and the frame-by-frame breakdown of a whole podcast.

python -X utf8 breakdown.py <video dir> [--src raw/podcast.mp4] [--model small.en]

Writes work/podcast_words.json (every word with times), work/shots.json (every shot: camera angle, faces, size),
work/angles.png (one picture per camera angle) and work/breakdown.md, the document Claude reads to choose the clip:
every line with its time, the camera on screen and a Q mark on questions."""
import argparse, os, sys
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import ff, probe, wj, wt, rj, transcribe, face_detector, faces, frames, tc

PW, PH, PFPS = 640, 360, 6        # analysis proxy: small and fast, faces still found in wide shots


def shots_and_faces(src, dur):
    import cv2
    det = face_detector(PW, PH)
    rows, prev_h, prev_t = [], None, None
    for i, fr in enumerate(frames(src, PW, PH, fps=PFPS)):
        t = i / PFPS
        hsv = cv2.cvtColor(fr, cv2.COLOR_BGR2HSV)
        hist = cv2.calcHist([hsv], [0, 1, 2], None, [8, 6, 6], [0, 180, 0, 256, 0, 256]).flatten()
        hist /= max(1.0, hist.sum())
        thumb = cv2.resize(cv2.cvtColor(fr, cv2.COLOR_BGR2GRAY), (32, 18), interpolation=cv2.INTER_AREA).astype(np.float32)
        d_h = 0.0 if prev_h is None else float(0.5 * np.abs(hist - prev_h).sum())
        d_t = 0.0 if prev_t is None else float(np.abs(thumb - prev_t).mean())
        fs = faces(det, fr)
        rows.append({'t': t, 'dh': d_h, 'dt': d_t, 'faces': [[round(f[0] / PW, 4), round(f[1] / PH, 4), round(f[2] / PW, 4),
                                                              round(f[3] / PH, 4), round(f[4], 3)] for f in fs],
                     'thumb': thumb, 'small': cv2.resize(fr, (160, 90), interpolation=cv2.INTER_AREA)})
        prev_h, prev_t = hist, thumb
        if i % (PFPS * 60) == 0:
            print(f'  breakdown {tc(t)} / {tc(dur)}', flush=True)
    # cuts: a big histogram jump or a big picture change, at least 0.5 s apart
    cuts = [0]
    for i, r in enumerate(rows):
        if i and (r['dh'] > 0.32 or r['dt'] > 22) and i - cuts[-1] >= PFPS // 2:
            cuts.append(i)
    cuts.append(len(rows))
    shots = []
    for a, b in zip(cuts[:-1], cuts[1:]):
        seg = rows[a:b]
        thumb = np.median(np.stack([r['thumb'] for r in seg]), axis=0)
        fl = [r['faces'] for r in seg]
        n = int(np.median([len(f) for f in fl]))
        big = [max((f[3] for f in ff_), default=0) for ff_ in fl]
        xs = [sorted(f[0] + f[2] / 2 for f in ff_) for ff_ in fl if ff_]
        shots.append({'s': round(seg[0]['t'], 3), 'e': round(seg[-1]['t'] + 1 / PFPS, 3), 'faces': n,
                      'face_h': round(float(np.median(big)), 3),
                      'face_x': [round(float(np.median([x[k] for x in xs if len(x) > k])), 3) for k in range(n)] if xs else [],
                      'thumb': thumb, 'small': seg[len(seg) // 2]['small']})
    # camera angles: shots that look alike are the same camera
    angles = []
    for s in shots:
        v = (s['thumb'] - s['thumb'].mean()) / (s['thumb'].std() + 1e-6)
        best, bd = None, 9e9
        for k, a in enumerate(angles):
            d = float(np.abs(v - a['v']).mean())
            if d < bd:
                best, bd = k, d
        if best is not None and bd < 0.42 and abs(angles[best]['faces'] - s['faces']) <= 1:
            s['angle'] = best
            angles[best]['n'] += 1
            angles[best]['secs'] += s['e'] - s['s']
        else:
            s['angle'] = len(angles)
            angles.append({'v': v, 'faces': s['faces'], 'face_h': s['face_h'], 'face_x': s['face_x'], 'n': 1,
                           'secs': s['e'] - s['s'], 'small': s['small']})
    for a in angles:
        if a['faces'] >= 2:
            a['name'] = 'wide two-shot'
        elif a['faces'] == 1:
            side = 'left' if (a['face_x'] or [0.5])[0] < 0.45 else 'right' if (a['face_x'] or [0.5])[0] > 0.55 else 'centre'
            a['name'] = ('close' if a['face_h'] > 0.28 else 'medium' if a['face_h'] > 0.15 else 'wide') + ' ' + side
        else:
            a['name'] = 'no face (B-roll, graphic)'
    return shots, angles


def angle_sheet(angles, path):
    import cv2
    keep = [k for k, a in enumerate(angles) if a['secs'] >= 2.0] or list(range(len(angles)))
    keep = keep[:24]
    cols = 4
    rows_ = (len(keep) + cols - 1) // cols
    sheet = np.zeros((rows_ * 120, cols * 160, 3), np.uint8)
    for i, k in enumerate(keep):
        a = angles[k]
        y, x = (i // cols) * 120, (i % cols) * 160
        sheet[y:y + 90, x:x + 160] = a['small']
        cv2.putText(sheet, f'A{k} {a["name"][:16]}', (x + 3, y + 104), cv2.FONT_HERSHEY_SIMPLEX, 0.36, (255, 255, 255), 1)
        cv2.putText(sheet, f'{a["n"]} shots {a["secs"]:.0f}s', (x + 3, y + 116), cv2.FONT_HERSHEY_SIMPLEX, 0.33, (180, 180, 180), 1)
    cv2.imwrite(path, sheet)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('dir')
    ap.add_argument('--src', default='raw/podcast.mp4')
    ap.add_argument('--model', default=None)
    a = ap.parse_args()
    d = os.path.abspath(a.dir)
    src = os.path.join(d, a.src)
    work = os.path.join(d, 'work')
    os.makedirs(work, exist_ok=True)
    info = probe(src)
    print(f'{src}: {info["w"]}x{info["h"]} {info["fps"]:.2f} fps {tc(info["dur"])}')

    words_p = os.path.join(work, 'podcast_words.json')
    if os.path.exists(words_p):
        words, segs = rj(words_p)['words'], rj(words_p)['segments']
        print('transcript: reusing', words_p)
    else:
        wav = os.path.join(work, 'podcast16k.wav')
        ff(['-i', src, '-ac', '1', '-ar', '16000', wav])
        print('transcribing (a 1 hour podcast takes ~15 min on a laptop CPU)...', flush=True)
        words, segs = transcribe(wav, a.model)
        wj(words_p, {'words': words, 'segments': segs})

    print('shots, faces and camera angles...', flush=True)
    shots, angles = shots_and_faces(src, info['dur'])
    angle_sheet(angles, os.path.join(work, 'angles.png'))
    wj(os.path.join(work, 'shots.json'), {
        'angles': [{'id': k, 'name': x['name'], 'faces': x['faces'], 'face_h': x['face_h'], 'face_x': x['face_x'], 'shots': x['n'],
                    'secs': round(x['secs'], 1)} for k, x in enumerate(angles)],
        'shots': [{k: v for k, v in s.items() if k not in ('thumb', 'small')} for s in shots]})

    def angle_at(t):
        for s in shots:
            if s['s'] <= t < s['e']:
                return s['angle']
        return shots[-1]['angle']

    lines = ['# Breakdown: ' + os.path.basename(src), '',
             f'{tc(info["dur"])} long, {len(shots)} shots, {len(angles)} camera angles. Angles (pictures in work/angles.png):', '']
    for k, x in enumerate(angles):
        if x['secs'] >= 2:
            lines.append(f'- A{k}: {x["name"]}, {x["n"]} shots, {x["secs"]:.0f} s on screen')
    lines += ['', 'Every line: `[start-end] A<angle on screen at the start> (+ angle changes inside) text`. **Q** = a question.',
              'Pick the clip with the rules in SKILL.md (start on a question, one point or story, end on a conclusion, 40-60 s,',
              'a new camera angle every few lines), then write work/clip.json.', '']
    for s in segs:
        a0 = angle_at(s['s'] + 0.05)
        inside = []
        for sh in shots:
            if s['s'] + 0.05 < sh['s'] < s['e'] and sh['angle'] != (inside[-1] if inside else a0):
                inside.append(sh['angle'])
        q = ' **Q**' if s['text'].rstrip().endswith('?') else ''
        ch = (' -> ' + ' -> '.join(f'A{x}' for x in inside)) if inside else ''
        lines.append(f'- [{s["s"]:.2f}-{s["e"]:.2f}] A{a0}{ch}{q} {s["text"]}')
    wt(os.path.join(work, 'breakdown.md'), '\n'.join(lines) + '\n')
    print('wrote', os.path.join(work, 'breakdown.md'), '+ shots.json, angles.png')


if __name__ == '__main__':
    main()
