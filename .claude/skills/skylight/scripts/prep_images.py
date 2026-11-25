"""Turn the picked downloads into scene assets: full-frame 9:16 B-roll, cut-outs and logos.

python -X utf8 -I prep_images.py <video dir> <name>=<source>:<how>[:<x>,<y>] ...

<source> is a download id (waymo_1, from work/dl/credits.json: the bigger original is fetched) or a file path.
For white / glass / logo / person, a 4-number last part crops first: name=guitar_1:white:0,0,0.34,1 (left, top, right, bottom, 0-1).
<how>:  cover   full-frame 1080x1920 B-roll, cropped around <x>,<y> (0-1, default 0.5,0.5)
        bw      the same in black and white
        white   an object on a plain light background -> transparent PNG (flood fill from the edges)
        glass   the same, and the white seen through glass inside it turns clear (hourglasses, bottles, jars)
        person  a person -> transparent PNG (npx hyperframes remove-background, local u2net, free)
        logo    keep the alpha, trim the edges
Writes scenes/assets/img/<name>.jpg|png. Run with -I: downloads are untrusted files, this only decodes them."""
import json, os, re, shutil, subprocess, sys, urllib.request
import numpy as np
from PIL import Image, ImageEnhance, ImageFilter, ImageOps
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import FFMPEG

UA = 'PremiumClips/1.0 (personal video editing; local script)'


def bigger(d, sid):
    """Fetch a larger version of a Commons download (the 1400 px thumbs are soft at 1080x1920)."""
    cred = os.path.join(d, 'work', 'dl', 'credits.json')
    rows = json.load(open(cred, encoding='utf-8')) if os.path.exists(cred) else []
    slot, k = sid.rsplit('_', 1)
    row = [r for r in rows if r['slot'] == slot and (r.get('file') or '').endswith(tuple(f'{slot}_{k}{e}' for e in ('.jpg', '.jpeg', '.png', '.JPG', '.webp', '.tif', '.gif')))]
    local = row[-1]['file'] if row else None
    if row and row[-1].get('thumb') and (row[-1].get('w') or 0) > 1920:
        url = re.sub(r'/(\d+)px-', '/1920px-', row[-1]['thumb'])
        out = os.path.join(d, 'work', 'dl', f'{sid}_big' + os.path.splitext(local)[1])
        if not os.path.exists(out):
            try:
                req = urllib.request.Request(url, headers={'User-Agent': UA})
                with urllib.request.urlopen(req, timeout=60) as r, open(out, 'wb') as f:
                    f.write(r.read())
            except Exception as e:
                print('  (bigger version failed, using the thumb:', e, ')')
                return local
        return out
    return local


def find(d, src):
    if os.path.exists(src):
        return src
    if os.path.exists(os.path.join(d, src)):
        return os.path.join(d, src)
    return bigger(d, src)


def cover(im, cx, cy, bw=False):
    im = ImageOps.fit(im.convert('RGB'), (1080, 1920), Image.LANCZOS, centering=(cx, cy))
    if bw:
        im = ImageEnhance.Contrast(im.convert('L')).enhance(1.12).convert('RGB')
    return im.filter(ImageFilter.UnsharpMask(radius=1.6, percent=40, threshold=2))


def white_cut(im, tol=26, glass=False):
    """Object on a plain light background: flood the background from the edges, feather it, trim."""
    import cv2
    a = np.asarray(im.convert('RGB'))
    h, w = a.shape[:2]
    mask = np.zeros((h + 2, w + 2), np.uint8)
    flood = a.copy()
    for (x, y) in [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1), (w // 2, 0), (w // 2, h - 1), (0, h // 2), (w - 1, h // 2)]:
        cv2.floodFill(flood, mask, (x, y), (255, 0, 255), (tol, tol, tol), (tol, tol, tol), cv2.FLOODFILL_FIXED_RANGE | 8)
    bg = mask[1:-1, 1:-1] > 0
    alpha = (~bg).astype(np.uint8) * 255
    alpha = cv2.morphologyEx(alpha, cv2.MORPH_OPEN, np.ones((5, 5), np.uint8))
    # keep only the biggest piece: floor shadows and specks go
    n, lab, stats, _ = cv2.connectedComponentsWithStats((alpha > 127).astype(np.uint8))
    if n > 2:
        keep = 1 + int(np.argmax(stats[1:, cv2.CC_STAT_AREA]))
        alpha = np.where(lab == keep, alpha, 0).astype(np.uint8)
    alpha = cv2.GaussianBlur(alpha, (5, 5), 0)
    if glass:
        # see-through glass: near-white boxed in by the object (the background seen through glass) goes almost clear,
        # so the scene shows through (the hourglass on the white paper, 2026-11-23)
        mx, mn = a.max(axis=2).astype(np.int16), a.min(axis=2).astype(np.int16)
        clear = (mn > 222) & ((mx - mn) < 22)
        soft = cv2.GaussianBlur(clear.astype(np.float32), (7, 7), 0)
        alpha = (alpha.astype(np.float32) * (1 - 0.88 * soft)).astype(np.uint8)
    out = Image.fromarray(np.dstack([a, alpha]))
    return out.crop(out.getbbox())


def main():
    d = os.path.abspath(sys.argv[1])
    od = os.path.join(d, 'scenes', 'assets', 'img')
    os.makedirs(od, exist_ok=True)
    for arg in sys.argv[2:]:
        name, spec = arg.split('=', 1)
        parts = spec.split(':')
        src, how = parts[0], parts[1] if len(parts) > 1 else 'cover'
        nums = [float(v) for v in parts[2].split(',')] if len(parts) > 2 else [0.5, 0.5]
        cx, cy = (nums[0], nums[1]) if len(nums) == 2 else (0.5, 0.5)
        box = nums if len(nums) == 4 else None            # white / glass / logo / person: crop l,t,r,b (0-1) first
        path = find(d, src)
        if not path:
            print(name, ': source not found', src)
            continue
        im = Image.open(path)
        im.seek(0)
        if box:
            W0, H0 = im.size
            im = im.crop((int(box[0] * W0), int(box[1] * H0), int(box[2] * W0), int(box[3] * H0)))
        if how in ('cover', 'bw'):
            cover(im, cx, cy, how == 'bw').save(os.path.join(od, name + '.jpg'), quality=92)
            out = name + '.jpg'
        elif how in ('white', 'glass'):
            white_cut(im, glass=how == 'glass').save(os.path.join(od, name + '.png'))
            out = name + '.png'
        elif how == 'logo':
            lo = im.convert('RGBA')
            lo.crop(lo.getbbox()).save(os.path.join(od, name + '.png'))
            out = name + '.png'
        elif how == 'person':
            tmp = os.path.join(d, 'work', name + '_src.png')
            im.convert('RGB').save(tmp)
            npx = shutil.which('npx') or shutil.which('npx.cmd') or 'npx'
            env = dict(os.environ, PATH=os.path.dirname(FFMPEG) + os.pathsep + os.environ.get('PATH', ''))   # it needs ffmpeg too
            r = subprocess.run([npx, '-y', 'hyperframes', 'remove-background', tmp, '-o', os.path.join(od, name + '.png'), '--quality', 'best'],
                               env=env)
            if r.returncode:
                print(name, ': remove-background failed')
                continue
            cut = np.asarray(Image.open(os.path.join(od, name + '.png')).convert('RGBA')).copy()
            a = cut[:, :, 3].astype(np.float32)
            cut[:, :, 3] = np.where(a < 40, 0, np.clip((a - 40) * 255 / 215, 0, 255)).astype(np.uint8)   # drop the faint haze
            out_im = Image.fromarray(cut)
            out_im.crop(out_im.getbbox()).save(os.path.join(od, name + '.png'))
            out = name + '.png'
        else:
            print(name, ': unknown how', how)
            continue
        print(f'{name}: {os.path.basename(path)} -> scenes/assets/img/{out}')


if __name__ == '__main__':
    main()
