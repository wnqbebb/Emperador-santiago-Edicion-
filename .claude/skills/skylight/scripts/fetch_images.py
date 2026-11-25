"""Pictures for B-roll, cut-outs and logos from Wikimedia Commons: free licences only, credits kept.

python -X utf8 -I fetch_images.py <video dir> <slot>="<search words>" [<slot>="<search words>" ...] [--n 4] [--svg]

They come from Wikimedia Commons (public domain, CC0,
CC BY, CC BY-SA), 4 candidates per slot, into work/dl/<slot>_<k>.<ext>, with work/dl/credits.json and a contact sheet
work/dl/sheet_<slot>.png to pick from. One request at a time: Commons answers 429 to parallel requests.
CC BY / BY-SA pictures need the credit in the post's description: write IMAGE_CREDITS.md from credits.json."""
import json, os, sys, time, urllib.error, urllib.parse, urllib.request

UA = 'Skylight/1.0 (personal video editing; local script)'
OK = ('public domain', 'cc0', 'cc by', 'cc-by', 'pd', 'no restrictions')


def get(url, tries=6):
    for k in range(tries):
        try:
            req = urllib.request.Request(url, headers={'User-Agent': UA})
            with urllib.request.urlopen(req, timeout=40) as r:
                data = r.read()
                time.sleep(0.8)
                return data
        except urllib.error.HTTPError as e:
            if e.code == 429 and k < tries - 1:
                time.sleep(8 * (k + 1))
                continue
            raise


def search(out, slot, q, n, svg):
    ft = 'filetype:drawing' if svg else 'filetype:bitmap'
    u = ('https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=search&gsrnamespace=6&gsrlimit=20'
         f'&gsrsearch={urllib.parse.quote(q + " " + ft)}&prop=imageinfo&iiprop=url|extmetadata|size|mime&iiurlwidth=1280')
    j = json.loads(get(u))
    rows = []
    pages = sorted(j.get('query', {}).get('pages', {}).values(), key=lambda p: p.get('index', 99))
    for p in pages:
        ii = p['imageinfo'][0]
        m = ii.get('extmetadata', {})
        lic = (m.get('LicenseShortName', {}).get('value') or '').strip()
        if not any(k in lic.lower() for k in OK):
            continue
        if not svg and ii.get('width', 0) < 700:
            continue
        rows.append(dict(slot=slot, query=q, title=p['title'], license=lic, page=ii.get('descriptionurl'),
                         artist=urllib.parse.unquote(m.get('Artist', {}).get('value', ''))[:200], thumb=ii.get('thumburl'),
                         w=ii.get('width'), h=ii.get('height')))
        if len(rows) >= n:
            break
    for k, r in enumerate(rows):
        ext = os.path.splitext(r['thumb'].split('?')[0])[1].lower() or '.jpg'
        fn = os.path.join(out, f'{slot}_{k}{ext}')
        try:
            with open(fn, 'wb') as f:
                f.write(get(r['thumb']))
            r['file'] = fn
        except Exception as e:
            r['file'] = None
            r['err'] = str(e)
    return rows


def sheet(out, slot, rows):
    try:
        from PIL import Image, ImageDraw
    except ImportError:
        return
    ims = []
    for r in rows:
        if r.get('file'):
            try:
                im = Image.open(r['file'])
                im.seek(0)
                ims.append(im.convert('RGBA'))
            except Exception:
                pass
    if not ims:
        return
    S = Image.new('RGB', (300 * len(ims), 330), '#202020')
    d = ImageDraw.Draw(S)
    for i, im in enumerate(ims):
        im.thumbnail((290, 290))
        bg = Image.new('RGB', im.size, '#808080')
        bg.paste(im, mask=im.split()[3])
        S.paste(bg, (i * 300 + 5, 5))
        d.text((i * 300 + 8, 305), f'{slot}_{i}', fill='#ffffff')
    S.save(os.path.join(out, f'sheet_{slot}.png'))


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    n = 4
    for a in sys.argv[1:]:
        if a.startswith('--n='):
            n = int(a[4:])
    svg = '--svg' in sys.argv
    d = os.path.abspath(args[0])
    out = os.path.join(d, 'work', 'dl')
    os.makedirs(out, exist_ok=True)
    allrows = []
    for a in args[1:]:
        slot, q = a.split('=', 1)
        rows = search(out, slot, q, n, svg)
        sheet(out, slot, rows)
        allrows += rows
        for r in rows:
            print(slot, '|', r['license'], '|', r['title'][:70], '|', 'ok' if r.get('file') else r.get('err'))
        if not rows:
            print(slot, '| nothing free found for', repr(q), '- try other words')
    cred = os.path.join(out, 'credits.json')
    old = json.load(open(cred, encoding='utf-8')) if os.path.exists(cred) else []
    with open(cred, 'w', encoding='utf-8') as f:
        json.dump(old + allrows, f, indent=1, ensure_ascii=False)
    print('contact sheets: work/dl/sheet_<slot>.png')


if __name__ == '__main__':
    main()
