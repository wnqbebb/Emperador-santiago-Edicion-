"""Raw cut step 3: turn the 16:9 clip into a 9:16 A-roll that tracks whoever is speaking.

python -X utf8 track.py <video dir> [--nose 0.36] [--face 0.34]

Every speaker is tracked while they talk: the face stays in the upper half with the nose on the centre line, the tracking is
smooth (never fast or jerky) and the crop never goes out of bounds. Face height about a third of the frame.

How: YuNet faces on every other frame; in a shot with several faces the speaker is the one whose mouth moves most; inside a shot
the crop follows the face slowly (a heavy smoothing, a dead zone, a speed limit) and never leaves the frame; a speaker change
inside a shot becomes a cut, never a pan. Shots without a face (the podcast's own B-roll) are framed on their centre.
Writes work/aroll.mp4 (1080x1920, 30 fps, the footage's own colour) and work/track.json (per shot: who, crop, face size)."""
import argparse, os, sys
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import FFMPEG, W, H, FPS, probe, rj, wj, face_detector, faces, frames
import subprocess

AW, AH = 960, 540          # analysis size (half of 1080p)


def cuts_in(path, n):
    """Hard cuts in the clip itself (camera changes and the joins)."""
    import cv2
    prev, cuts = None, [0]
    for i, fr in enumerate(frames(path, 160, 90)):
        hsv = cv2.cvtColor(fr, cv2.COLOR_BGR2HSV)
        h = cv2.calcHist([hsv], [0, 1, 2], None, [8, 6, 6], [0, 180, 0, 256, 0, 256]).flatten()
        h /= max(1.0, h.sum())
        if prev is not None and 0.5 * np.abs(h - prev).sum() > 0.3 and i - cuts[-1] > 6:
            cuts.append(i)
        prev = h
    cuts.append(n)
    return cuts


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('dir')
    ap.add_argument('--src', default='work/clip.mp4')
    ap.add_argument('--nose', type=float, default=0.36, help='nose height in the 9:16 frame (0 top, 1 bottom)')
    ap.add_argument('--face', type=float, default=0.34, help='face height as a share of the frame (the style: about a third)')
    ap.add_argument('--minh', type=float, default=780, help='smallest crop height in source px (bigger = sharper, wider)')
    a = ap.parse_args()
    d = os.path.abspath(a.dir)
    src = os.path.join(d, a.src)
    info = probe(src)
    SW, SH = info['w'], info['h']
    global AW, AH
    if SH > SW:   # Emperador: clip vertical (hablando a cámara) → se analiza en vertical, sin deformar
        AW, AH = 540, 960
    sx = SW / AW
    det = face_detector(AW, AH)

    import cv2
    # 1. faces + mouth motion on every other frame
    obs = []
    prev_gray = None
    for i, fr in enumerate(frames(src, AW, AH)):
        if i % 2:
            obs.append(None)
            continue
        g = cv2.cvtColor(fr, cv2.COLOR_BGR2GRAY)
        fs = []
        for f in faces(det, fr):
            x, y, w, h, sc, nx, ny, mlx, mly, mrx, mry = f
            mx0, mx1 = int(min(mlx, mrx) - w * 0.12), int(max(mlx, mrx) + w * 0.12)
            my0, my1 = int((mly + mry) / 2 - h * 0.12), int((mly + mry) / 2 + h * 0.16)
            act = 0.0
            ey0, ey1 = int(y + h * 0.22), int(y + h * 0.45)
            ok = prev_gray is not None and mx1 > mx0 + 2 and my1 > my0 + 2 and mx0 >= 0 and my0 >= 0 and mx1 < AW and my1 < AH
            if ok and ey0 >= 0 and ey1 > ey0 + 2 and int(x) >= 0 and int(x + w) < AW:
                dm = np.abs(g[my0:my1, mx0:mx1].astype(np.int16) - prev_gray[my0:my1, mx0:mx1].astype(np.int16)).mean()
                de = np.abs(g[ey0:ey1, int(x):int(x + w)].astype(np.int16) - prev_gray[ey0:ey1, int(x):int(x + w)].astype(np.int16)).mean()
                act = float(max(0.0, dm - 0.8 * de)) * float(sc)   # lips move, the rest of the face doesn't; low score = hand in front
            fs.append({'x': x * sx, 'y': y * sx, 'w': w * sx, 'h': h * sx, 'nx': nx * sx, 'ny': ny * sx, 'act': act})
        obs.append(fs)
        prev_gray = g
    n = len(obs)
    cuts = cuts_in(src, n)
    hints_p = os.path.join(d, 'work', 'speakers.json')
    hints = rj(hints_p) if os.path.exists(hints_p) else []

    # 2. per shot: who speaks, where the crop goes
    tx = np.full(n, SW / 2.0)
    ty = np.full(n, SH * 0.36)
    th = np.full(n, float(SH))
    shots = []
    for a0, b0 in zip(cuts[:-1], cuts[1:]):
        idx = [i for i in range(a0, b0) if obs[i] is not None]
        seen = [obs[i] for i in idx if obs[i]]
        if not seen:
            shots.append({'s': a0 / FPS, 'e': b0 / FPS, 'faces': 0, 'who_x': None, 'crop_h': SH, 'face_share': 0})
            continue
        # cluster faces in the shot by x
        tracks = []
        for i in idx:
            for f in obs[i] or []:
                best = None
                for tr in tracks:
                    if abs(tr['x'] - f['nx']) < SW * 0.12:
                        best = tr
                        break
                if best is None:
                    best = {'x': f['nx'], 'pts': {}, 'act': [], 'h': []}
                    tracks.append(best)
                best['pts'][i] = f
                best['act'].append(f['act'])
                best['h'].append(f['h'])
                best['x'] = 0.8 * best['x'] + 0.2 * f['nx']
        tracks = [t for t in tracks if len(t['pts']) >= max(2, len(idx) * 0.25)] or tracks
        # the speaker: mouth moving most, weighted a little toward the bigger face
        for t in tracks:
            t['score'] = float(np.mean(t['act'])) * (np.median(t['h']) / SH) ** 0.3
        sp = max(tracks, key=lambda t: t['score'])
        mid = (a0 + b0) / 2 / FPS
        for hnt in hints:                  # Claude or the user said who speaks here
            if hnt['s'] <= mid <= hnt['e']:
                sp = min(tracks, key=lambda t: abs(t['x'] / SW - hnt['x']))
        fh = float(np.median(sp['h']))
        ch = float(np.clip(fh / a.face, a.minh, SH))
        xs, ys = [], []
        for i in range(a0, b0):
            f = sp['pts'].get(i) or sp['pts'].get(i - 1)
            xs.append(f['nx'] if f else np.nan)
            ys.append(f['ny'] if f else np.nan)
        xs, ys = np.array(xs, float), np.array(ys, float)
        for arr in (xs, ys):
            ok = ~np.isnan(arr)
            arr[~ok] = np.interp(np.flatnonzero(~ok), np.flatnonzero(ok), arr[ok]) if ok.any() else SW / 2
        # smooth: gaussian ~0.7 s, then a dead zone and a speed limit (never fast, never jerky)
        k = max(3, int(FPS * 0.7))
        ker = np.exp(-0.5 * (np.arange(-2 * k, 2 * k + 1) / k) ** 2)
        ker /= ker.sum()
        def sm(v):
            pad = np.pad(v, (2 * k, 2 * k), mode='edge')
            return np.convolve(pad, ker, mode='valid')
        xs, ys = sm(xs), sm(ys)
        cw = ch * 9 / 16
        out_x, out_y = [xs[0]], [ys[0]]
        vmax = SH * 0.08 / FPS          # at most 8% of the frame height a second
        for i in range(1, len(xs)):
            for src_v, out in ((xs, out_x), (ys, out_y)):
                dv = src_v[i] - out[-1]
                dead = cw * 0.03
                step = 0.0 if abs(dv) < dead else np.clip(dv - np.sign(dv) * dead, -vmax, vmax)
                out.append(out[-1] + step)
        tx[a0:b0] = out_x
        ty[a0:b0] = out_y
        th[a0:b0] = ch
        shots.append({'s': round(a0 / FPS, 3), 'e': round(b0 / FPS, 3), 'faces': len(tracks), 'who_x': round(float(np.median(xs)) / SW, 3),
                      'crop_h': round(ch), 'face_share': round(fh / ch, 3)})

    # 3. render: crop each frame (never out of bounds) and scale to 1080x1920
    outp = os.path.join(d, 'work', 'aroll.mp4')
    enc = subprocess.Popen([FFMPEG, '-hide_banner', '-loglevel', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'bgr24', '-s', f'{W}x{H}',
                            '-r', str(FPS), '-i', '-', '-vf', 'unsharp=5:5:0.45:5:5:0', '-c:v', 'libx264', '-crf', '14', '-preset', 'medium',
                            '-g', '30', '-pix_fmt', 'yuv420p', outp], stdin=subprocess.PIPE)
    for i, fr in enumerate(frames(src, SW, SH)):
        if i >= n:
            break
        ch = th[i]
        cw = ch * 9 / 16
        cx = float(np.clip(tx[i], cw / 2, SW - cw / 2))
        top = float(np.clip(ty[i] - a.nose * ch, 0, SH - ch))
        s = H / ch
        M = np.array([[s, 0, -(cx - cw / 2) * s], [0, s, -top * s]], np.float32)
        out = cv2.warpAffine(fr, M, (W, H), flags=cv2.INTER_LANCZOS4, borderMode=cv2.BORDER_REPLICATE)
        enc.stdin.write(out.tobytes())
    enc.stdin.close()
    enc.wait()
    wj(os.path.join(d, 'work', 'track.json'), {'shots': shots, 'source': [SW, SH]})
    from common import ff
    ff(['-i', outp, '-vf', 'fps=1,scale=216:384,tile=12x4', '-frames:v', '1', os.path.join(d, 'work', 'aroll_sheet.png')])
    print('look at work/aroll_sheet.png (1 frame a second): the speaker framed, face top half, nothing cut off.',
          'Wrong person in a shot? Add {"s","e","x": share of the source width} to work/speakers.json and run again.')
    for s in shots:
        print(f"  {s['s']:6.2f}-{s['e']:6.2f}  faces {s['faces']}  speaker x {s['who_x']}  crop h {s['crop_h']}  face {s['face_share']}")
    print('wrote', outp)


if __name__ == '__main__':
    main()
