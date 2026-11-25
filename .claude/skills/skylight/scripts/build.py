"""Skylight builder: plan.json -> scenes/index.html (HyperFrames, 1080x1920) + work/cues.json (the sound cue sheet).

python -X utf8 build.py <video dir>

Reads work/plan.json (written by Claude from the planning doc), work/words.json (word times of the clip),
work/palette.json (the four tones) and work/track.json (who is on screen when). The numbers come from
reference/style.md. The plan format is in SKILL.md ("plan.json")."""
import html, json, math, os, re, shutil, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import SK, W, H, FPS, rj, wj, wt

PAN_T, WHIP_T = 0.0, 0.6               # pan right = a hard cut + a slide inside the new shot; vertical whip ~0.6 s (study: Transitions)
PAN_LEAD, WHIP_LEAD = 0.0, 0.3           # transitions start this much before the planned time, so they land on the word
HOLD = 0.6                               # a page stays this long after its last word, then clears (pauses read empty)
DRIFT = [0.035, 0, 0]                    # full screens and B-roll grow ~3.5% over the shot: nothing is a held frame
THIN, BOLD, TAIL = 62, 135, 44           # px at 1920 tall: lead-in 3.4-3.7%, keyword 6.5-9%, third tier (study: Type)
THIN_W, BOLD_W = 58, 122                 # the same tiers on white scenes, a touch smaller
POS = {                                  # caption anchors (study: Type; A-roll centred ~65% from the top)
    'aroll': dict(left=76, top=0.612, align='left', maxw=930),
    'tl': dict(left=70, top=0.085, align='left', maxw=760),
    'tr': dict(right=70, top=0.085, align='right', maxw=760),
    'bl': dict(left=70, top=0.74, align='left', maxw=860),
    'br': dict(right=70, top=0.74, align='right', maxw=860),
    'low': dict(left=76, top=0.66, align='left', maxw=930),
    'top': dict(center=True, top=0.115, align='center', maxw=960),
    'mid': dict(center=True, top=0.40, align='center', maxw=960),
    'bottom': dict(center=True, top=0.70, align='center', maxw=960),
}


def esc(s):
    return html.escape(str(s), quote=True)


def norm(w):
    return re.sub(r"[^a-z0-9']", '', w.lower().replace('’', "'"))


class Words:
    """Aligns caption text to the spoken words (work/words.json) so every word comes on with the voice."""
    def __init__(self, words):
        self.w = words
        self.i = 0

    def seek(self, t):
        while self.i < len(self.w) and self.w[self.i]['e'] < t - 0.05:
            self.i += 1

    def take(self, token, fallback):
        n = norm(token)
        for k in range(self.i, min(self.i + 8, len(self.w))):
            if norm(self.w[k]['w']) == n or (n and norm(self.w[k]['w']).startswith(n[:4]) and len(n) > 3):
                self.i = k + 1
                return self.w[k]['s'], self.w[k]['e']
        return fallback, fallback + 0.25


class Build:
    def __init__(self, d):
        self.d = d
        self.plan = rj(os.path.join(d, 'work', 'plan.json'))
        pal = rj(os.path.join(d, 'work', 'palette.json'))
        self.pal = pal['options'][self.plan.get('palette', pal.get('pick', 0))]
        self.words = Words(rj(os.path.join(d, 'work', 'words.json'))['words'])
        self.dur = float(self.plan['duration'])
        self.els, self.caps, self.cues, self.spans = [], [], [], []
        self.n = 0
        self.z = 10

    def cue(self, t, kind, gain=1.0, **kw):
        self.cues.append(dict(t=round(t, 3), kind=kind, gain=gain, **kw))

    def nid(self, p='e'):
        self.n += 1
        return f'{p}{self.n}'

    # ------------------------------------------------------------------ scenes
    def scenes(self):
        sc = self.plan['scenes']
        # a pan or whip starts a little before the planned time so the new picture lands on the word (76% of cuts land on a word)
        lead = {'pan': PAN_LEAD, 'whipup': WHIP_LEAD}
        starts = [float(s['s']) - (lead.get(s.get('in'), 0) if k else 0) for k, s in enumerate(sc)]
        for k, s in enumerate(sc):
            nxt = sc[k + 1] if k + 1 < len(sc) else None
            prev = sc[k - 1] if k else None
            tin = s.get('in', 'focus')
            tout = 'whipup' if nxt and nxt.get('in') == 'whipup' else 'cut'
            on = starts[k]
            outat = starts[k + 1] if nxt else float(s['e'])
            off = outat + (PAN_T if tout == 'pan' else WHIP_T if tout == 'whipup' else 0)
            off = min(off, self.dur)
            self.z += 1
            inner = getattr(self, 'sc_' + s['type'])(s, on, off)
            drift = s.get('drift') or (DRIFT if s['type'] not in ('aroll',) else None)   # nothing sits still (held frames)
            dr = f' data-drift="{",".join(str(x) for x in drift)}"' if drift else ''
            self.spans.append((on, outat, s['type']))
            self.els.append(f'<div class="scene" data-on="{on:.3f}" data-off="{off:.3f}" data-outat="{outat:.3f}" data-fx="scene" '
                            f'data-tin="{tin}" data-tout="{tout}"{dr} style="z-index:{self.z}">{inner}</div>')
            # the cue sheet: pan right = long whoosh + camera shutter; a new camera on the talk = soft wind + shutter;
            # back to the A-roll = soft airy whoosh; the open = a whoosh tail only, barely audible
            land = on + (PAN_T if tin == 'pan' else WHIP_T if tin == 'whipup' else 0)
            if tin == 'pan':
                self.cue(on - 0.12, 'whoosh' if s['type'] != 'aroll' else 'wind', 0.9)
                self.cue(on + 0.07, 'shutter', 0.75)
            elif tin == 'whipup':
                self.cue(on - 0.05, 'whoosh_v', 0.9)
            elif tin == 'return':
                self.cue(on - 0.03, 'airy', 0.8)
            elif tin == 'rise':
                self.cue(on, 'airy', 0.6)
            elif k == 0:
                self.cue(0.0, 'airy', 0.35)
            elif prev and prev['type'] == 'aroll' and s['type'] == 'aroll':
                if s.get('punch'):
                    self.cue(on, 'click', 0.5)
                else:
                    self.cue(on - 0.1, 'wind', 0.6)
                    self.cue(on + 0.07, 'shutter', 0.5)

    def video(self, src, on, off, mstart, extra=''):
        # the runtime owns a timed clip's own styles: any transform goes on an untimed wrapper (hyperframes media rules)
        v = (f'<video id="{self.nid("v")}" class="clip fill" src="{esc(src)}" data-start="{on:.3f}" data-duration="{off - on:.3f}" '
             f'data-media-start="{mstart:.3f}" data-track-index="{self.z}" muted playsinline></video>')
        return f'<div class="fill" style="{extra}">{v}</div>' if extra else v

    def sc_aroll(self, s, on, off):
        # "punch": a static punch-in (a hard cut to a tighter frame, never a slow push): scales 1.3-1.4 on a close-up, up to ~2.5 on a wide
        pk = s.get('punch')
        v = self.video('assets/aroll.mp4', on, off, on, f'transform:scale({pk});transform-origin:50% 33%' if pk else '')
        nc = s.get('namecard')
        if nc:
            self.namecard(nc, on)
        return v + '<div class="lowgrad"></div>'

    def media(self, src, on, off, extra=''):
        if src.lower().endswith(('.mp4', '.mov', '.webm')):
            return self.video(src, on, off, 0.0, extra)
        return f'<img class="fill" src="{esc(src)}" style="{extra}">'

    def sc_broll(self, s, on, off):
        out = self.media(s['img'], on, off, s.get('style', ''))
        tex = s.get('texture', 'cloth')
        if tex:
            out += f'<img class="fill tex" src="assets/tex/{tex}.png" style="opacity:{s.get("tex_op", 0.10)}">'   # kept light
        if s.get('grad', True):
            out += '<div class="lowgrad soft"></div>'
        if s.get('box'):
            x, y, w, h, t = s['box']
            out += (f'<div class="sel" data-on="{t:.3f}" data-off="{off:.3f}" data-fx="sel" style="left:{x}px;top:{y}px;width:{w}px;height:{h}px">'
                    '<i class="c tl"></i><i class="c tr"></i><i class="c bl"></i><i class="c br"></i></div>')
            self.cue(t, 'gui', 0.8)
        for a in s.get('arrows', [s['arrow']] if s.get('arrow') else []):
            out += self.arrow(a, off)
        return out

    def arrow(self, a, off):
        (x0, y0), (x1, y1), t = a['from'], a['to'], a['t']
        bend = a.get('bend', 0.35)
        mx, my = (x0 + x1) / 2, (y0 + y1) / 2
        nx, ny = -(y1 - y0), (x1 - x0)
        cx, cy = mx + nx * bend, my + ny * bend
        L = int(math.hypot(x1 - x0, y1 - y0) * 1.3 + 40)
        ang = math.atan2(y1 - cy, x1 - cx)
        hx = [x1 - 34 * math.cos(ang - 0.5), y1 - 34 * math.sin(ang - 0.5)]
        hy = [x1 - 34 * math.cos(ang + 0.5), y1 - 34 * math.sin(ang + 0.5)]
        col = a.get('color', '#ffffff')
        self.cue(t, 'scribble', 0.5)
        return (f'<svg class="svgo" data-on="{t:.3f}" data-off="{off:.3f}" data-fx="draw" data-dur="0.4" viewBox="0 0 {W} {H}">'
                f'<path class="st" data-len="{L}" d="M{x0},{y0} Q{cx:.0f},{cy:.0f} {x1},{y1}" fill="none" stroke="{col}" stroke-width="5" stroke-linecap="round"/>'
                f'<path class="head" d="M{hx[0]:.0f},{hx[1]:.0f} L{x1},{y1} L{hy[0]:.0f},{hy[1]:.0f}" fill="none" stroke="{col}" stroke-width="5" '
                f'stroke-linecap="round" stroke-linejoin="round"/></svg>')

    def paper(self):
        p = self.pal
        return (f'<div class="fill" style="background:{p["white"]}"></div><img class="fill tex" src="assets/tex/paper.png" style="opacity:0.55">'
                f'<div class="ring" style="left:-260px;top:-180px;border-color:{p["ring"]}"></div>'
                f'<div class="ring" style="right:-300px;bottom:260px;border-color:{p["ring"]}"></div>')

    def sc_bars(self, s, on, off):
        p = self.pal
        out = self.paper()
        bars = s['bars']
        n = len(bars)
        bw, gap = s.get('bw', 230), s.get('gap', 70)
        x0 = (W - (n * bw + (n - 1) * gap)) / 2
        top, hgt = s.get('top', 820), s.get('h', 1100)
        for k, b in enumerate(bars):
            x = x0 + k * (bw + gap)
            keys = b['keys']
            side = 'l' if k == 0 else 'r'
            out += (f'<div class="track" style="left:{x:.0f}px;top:{top}px;width:{bw}px;height:{hgt}px">'
                    f'<div class="bar" data-on="{on:.3f}" data-off="{off:.3f}" data-fx="bar" data-h="{hgt}" data-keys=\'{json.dumps(keys)}\' '
                    f'style="background:linear-gradient(180deg,{p["dark"]} 0%,{p["dark"]}cc 45%,{p["dark"]}00 100%)"></div>'
                    f'<div class="blab {side}" style="background:{p["dark"]}">{esc(b["label"])}<i></i></div></div>')
            for kk in keys[1:]:
                self.cue(kk[0], 'tick_up' if kk[1] >= keys[0][1] else 'tick_down', 0.7)
        return out + f'<div class="fill fadebot" style="background:linear-gradient(180deg,transparent 70%,{p["white"]} 100%)"></div>'

    def sc_line(self, s, on, off):
        p = self.pal
        out = self.paper()
        x0, y0, w, h = s.get('box', [110, 760, 860, 760])
        pts = [(x0 + u * w, y0 + (1 - v) * h) for u, v in s['pts']]
        d = 'M' + ' '.join(f'{x:.0f},{y:.0f}' for x, y in pts[:1])
        for (xa, ya), (xb, yb) in zip(pts[:-1], pts[1:]):
            mx = (xa + xb) / 2
            d += f' C{mx:.0f},{ya:.0f} {mx:.0f},{yb:.0f} {xb:.0f},{yb:.0f}'
        L = int(sum(math.hypot(xb - xa, yb - ya) for (xa, ya), (xb, yb) in zip(pts[:-1], pts[1:])) * 1.25)
        t = s.get('t', on + 0.3)
        grid = ''.join(f'<line x1="{x0}" x2="{x0 + w}" y1="{y0 + k * h / 4:.0f}" y2="{y0 + k * h / 4:.0f}" stroke="#d9dce4" stroke-width="2"/>' for k in range(5))
        lab = ''.join(f'<text x="{x0 + u * w:.0f}" y="{y0 + h + 60}" class="axl" text-anchor="middle">{esc(l)}</text>' for u, l in s.get('xlabels', []))
        self.cue(t, 'draw', 0.6)
        thr = ''
        if s.get('threshold'):
            v, label, tp = s['threshold']
            ty = y0 + (1 - v) * h
            thr = (f'<line x1="{x0 - 20}" x2="{x0 + w + 20}" y1="{ty:.0f}" y2="{ty:.0f}" stroke="{p["dark"]}" stroke-width="4" stroke-dasharray="16 14"/>')
            out += (f'<div class="tlab" data-on="{tp:.3f}" data-off="{off:.3f}" data-fx="pop" data-base="translateY(-50%)" '
                    f'style="left:{x0:.0f}px;top:{ty - 46:.0f}px;background:{p["dark"]}">{esc(label)}</div>')
            self.cue(tp, 'confirm', 0.8)
        out += ''
        return out + (f'<svg class="svgo" data-on="{on:.3f}" data-off="{off:.3f}" data-fx="line" data-t="{t:.3f}" data-dur="{s.get("dur", 1.4)}" '
                      f'viewBox="0 0 {W} {H}">{grid}{lab}{thr}<path class="st" data-len="{L}" d="{d}" fill="none" stroke="{p["bright"]}" stroke-width="9" '
                      f'stroke-linecap="round"/><circle class="ldot" r="17" fill="{p["bright"]}" stroke="#fff" stroke-width="6"/></svg>')

    def sc_days(self, s, on, off):
        """A calendar: day cells light up one by one on the spoken words (a month), then go back to a few (a week)."""
        p = self.pal
        labels = s.get('labels')              # tiles with words instead of day numbers (the jobs inside a business)
        n = len(labels) if labels else int(s.get('n', 30))
        cols = s.get('cols', 3 if labels else 7)
        cw = s.get('cell', 290 if labels else 112)
        ch = s.get('cellh', 170 if labels else cw)
        gap = s.get('gap', 22 if labels else 20)
        gw = cols * cw + (cols - 1) * gap
        x0, y0 = (W - gw) / 2, s.get('top', 760)
        cells = ''.join(f'<div class="day{" lab" if labels else ""}" style="left:{x0 + (i % cols) * (cw + gap):.0f}px;top:{y0 + (i // cols) * (ch + gap):.0f}px;'
                        f'width:{cw}px;height:{ch}px"><div class="df" style="background:{p["bright"]}"></div>'
                        f'<span>{esc(labels[i]) if labels else i + 1}</span></div>' for i in range(n))
        keys = s['keys']                       # [[t, how many lit, seconds to get there], ...]
        for k, (t, cnt, du) in enumerate(keys):
            self.cue(t, 'ticks', 0.55, n=int(abs(cnt - (keys[k - 1][1] if k else 0))), dur=du)
        return self.paper() + (f'<div class="fill" data-on="{on:.3f}" data-off="{off:.3f}" data-fx="days" data-keys=\'{json.dumps(keys)}\'>{cells}</div>')

    def sc_orbs(self, s, on, off):
        p = self.pal
        cx, cy = s.get('c', [W / 2, 860])
        pos = s.get('pos', [[cx - 170, cy + 70], [cx + 150, cy - 70]])
        labels = s.get('labels', [])
        orbs = ''.join(f'<div class="orb" style="background:radial-gradient(circle at 50% 50%,#ffffff 0 7%,{p["bright"]} 16%,{p["bright"]} 46%,'
                       f'{p["bright"]}66 60%,{p["bright"]}00 72%)">'
                       + (f'<span class="olab" style="background:{p["dark"]}">{esc(labels[i])}</span>' if i < len(labels) else '') + '</div>'
                       for i in range(len(pos)))
        merge = s.get('merge')
        if merge:
            self.cue(merge - 0.05, 'bloom', 0.9)
        self.cue(on + 0.15, 'shimmer', 0.4)
        return self.paper() + (f'<div class="fill" data-on="{on:.3f}" data-off="{off:.3f}" data-fx="orbs" data-cx="{cx}" data-cy="{cy}" '
                               f'data-pos=\'{json.dumps(pos)}\' data-merge="{merge or 1e9}">{orbs}'
                               f'<div class="bloom" style="background:radial-gradient(circle,#ffffffee 0,{p["pale"]}aa 30%,{p["bright"]}00 70%)"></div></div>')

    def sc_duo(self, s, on, off):
        """Two-object layout: cut-out person rising in the lower two-thirds, logos / objects either side, a swoosh behind."""
        p = self.pal
        out = self.paper() + '<img class="fill tex" src="assets/tex/halftone.png" style="opacity:0.10">'
        if s.get('swoosh', True):
            out += (f'<svg class="svgo" data-on="{on:.3f}" data-off="{off:.3f}" data-fx="draw" data-dur="0.35" viewBox="0 0 {W} {H}">'
                    f'<path class="st" data-len="1500" d="M-40,880 C220,700 420,980 640,840 S960,640 1120,720" fill="none" stroke="{p["pale"]}" '
                    f'stroke-width="18" stroke-linecap="round" opacity="0.9"/></svg>')
        if s.get('shape'):      # a soft shape behind the cut-out
            out += f'<div class="blob" style="background:radial-gradient(circle,{p["pale"]} 0,{p["pale"]}00 68%)"></div>'
        cut = s['img']
        cw = s.get('w', 900)
        out += (f'<img class="cut" src="{esc(cut)}" data-on="{on:.3f}" data-off="{off:.3f}" data-fx="rise" data-dy="260" data-dur="0.55" '
                f'data-base="translateX(-50%)" style="left:50%;bottom:0;width:{cw}px">'
                f'<div class="fill" style="background:linear-gradient(180deg,transparent 78%,{p["white"]} 97%)"></div>')
        for side, key in (('left', 'left'), ('right', 'right')):
            if s.get(key):
                t = on + (0.25 if side == 'left' else 0.4)
                x = 70 if side == 'left' else W - 70 - s.get('lw', 250)
                out += (f'<img class="logo" src="{esc(s[key])}" data-on="{t:.3f}" data-off="{off:.3f}" data-fx="pop" '
                        f'style="left:{x}px;top:{s.get("ly", 860)}px;width:{s.get("lw", 250)}px">')
                self.cue(t, 'pop', 0.55)
        return out

    def sc_world(self, s, on, off):
        """A generated place with cut-out objects in it (the hourglass in the clouds, made general).
        Use 2-4 per clip. plate: sky | sunset | night | studio | studio_light | space | paper | a picture path.
        objects: [{img, x, y (centre, px), w, r (deg), spin (deg/s), bob (px), enter: rise|drop|pop|fade|none, t, glow}]
        clouds: true/false (two drifting layers, behind and in front), sparkle: n (glowing specks drifting up)."""
        p = self.pal
        plate = s.get('plate', 'sky')
        src = plate if '/' in plate else (f'assets/img/{plate}.jpg' if plate == 'sky' and os.path.exists(os.path.join(self.d, 'scenes', 'assets', 'img', 'sky.jpg'))
                                          else f'assets/plates/{plate}.jpg')
        out = self.paper() if plate == 'paper' else f'<img class="fill" src="{esc(src)}">'
        clouds = s.get('clouds', plate in ('sky', 'sunset'))
        if clouds:
            out += (f'<img class="cloudl" src="assets/plates/clouds_back.png" data-on="{on:.3f}" data-off="{off:.3f}" data-fx="slide" '
                    f'data-vx="-22" style="opacity:0.75">')
        for k, o in enumerate(s.get('objects', [])):
            t = float(o.get('t', on + 0.05 + 0.18 * k))
            w = o.get('w', 600)
            glow = (f'<div class="oglow" style="background:radial-gradient(circle,{o["glow"] if o.get("glow") not in (True, None) else p["pale"]}cc 0,'
                    f'{p["pale"]}00 65%)"></div>') if o.get('glow') else ''
            out += (f'<div class="objw" style="left:{o.get("x", W / 2) - w / 2:.0f}px;top:{o.get("y", H * 0.55):.0f}px;width:{w}px">{glow}'
                    f'<img class="obj" src="{esc(o["img"])}" data-on="{t:.3f}" data-off="{off:.3f}" data-fx="obj" data-enter="{o.get("enter", "rise")}" '
                    f'data-r="{o.get("r", 0)}" data-spin="{o.get("spin", 1.2)}" data-bob="{o.get("bob", 10)}" data-ph="{k * 1.7:.1f}" '
                    f'style="filter:drop-shadow(0 30px 40px rgba(0,0,0,{0.35 if plate in ("studio", "night", "space") else 0.22}))"></div>')
            self.cue(t, 'pop' if o.get('enter') == 'pop' else 'airy', 0.5)
        n = int(s.get('sparkle', 0))
        if n:
            out += (f'<div class="fill" data-on="{on:.3f}" data-off="{off:.3f}" data-fx="sparkle" data-seed="{int(on * 100) % 997 + 3}">'
                    + '<i class="spk"></i>' * n + '</div>')
        if clouds:
            out += (f'<img class="cloudl" src="assets/plates/clouds_front.png" data-on="{on:.3f}" data-off="{off:.3f}" data-fx="slide" '
                    f'data-vx="-55" style="opacity:0.9;top:{s.get("front_y", 380)}px">')
        return out

    def sc_sky(self, s, on, off):
        out = f'<img class="fill" src="{esc(s.get("plate", "assets/plates/sky.jpg"))}">'
        if s.get('img'):
            out += (f'<div class="tiltw" style="right:{s.get("right", -120)}px;bottom:{s.get("bottom", -80)}px;width:{s.get("w", 860)}px">'
                    f'<img class="tilt" src="{esc(s["img"])}" data-on="{on:.3f}" data-off="{off:.3f}" data-fx="tilt" data-r="{s.get("r", -32)}" '
                    f'style="width:100%"></div>')
        return out

    def sc_night(self, s, on, off):
        return f'<img class="fill" src="{esc(s.get("plate", "assets/plates/night.jpg"))}">'

    def sc_still(self, s, on, off):
        return self.media(s['img'], on, off, s.get('style', ''))

    # ------------------------------------------------------------------ name cards
    def namecard(self, nc, scene_on):
        who = self.plan['people'][nc['who']]
        t = float(nc.get('t', scene_on + 0.27))
        e = float(nc.get('e', t + 2.9))
        side = nc.get('side', 'left')
        st = 'left:48px;text-align:left' if side == 'left' else 'right:48px;text-align:right'
        cls = 'nc' if side == 'left' else 'nc r'
        org = 'left' if side == 'left' else 'right'
        self.caps.append(f'<div class="{cls}" data-on="{t:.3f}" data-off="{e:.3f}" data-fx="namecard" style="{st};top:{int(H * 0.855)}px">'
                         f'<div class="nm">{esc(who["name"])}</div><div class="ru" style="transform-origin:{org} center"></div>'
                         f'<div class="ti">{esc(who["title"])}</div></div>')
        self.cue(t + 0.1, 'pluck', 0.7)

    # ------------------------------------------------------------------ captions
    def captions(self):
        pages = self.plan['captions']
        bubbles = 0
        for k, pg in enumerate(pages):
            spec = POS[pg.get('pos', 'aroll')]
            dark = pg.get('ink') == 'dark'
            tiers = [x.strip() for x in pg['at'].split(' / ')]
            approx = float(pg.get('s', 0))
            self.words.seek(approx)
            html_t, first_t, specials = [], None, []
            for ti, tier in enumerate(tiers):
                bold = tier.startswith('!')
                special = tier.startswith('!!')
                fxm = re.match(r'^!{1,2}(g|w|p)?\s+', tier)
                fx = {'g': 'glitch', 'w': 'write', 'p': 'pop'}.get(fxm.group(1)) if fxm and fxm.group(1) else ('bigblur' if bold else 'blur')
                body = tier[fxm.end():] if fxm else tier.lstrip('!').strip()
                tail = (not bold) and ti >= 2
                size = (BOLD_W if dark else BOLD) if bold else TAIL if tail else (THIN_W if dark else THIN)
                size = int(size * float(pg.get('scale', 1.0)))
                spans = []
                for tok in re.findall(r'\[[^\]]+\]|\{[^}]+\}|\S+', body):
                    if tok.startswith('['):           # highlight box: "[close to zero,]"
                        inner = tok[1:-1]
                        ts = [self.words.take(w, approx)[0] for w in inner.split()]
                        t0 = ts[0]
                        first_t = t0 if first_t is None else first_t
                        spans.append(f'<span class="hl" data-on="0" data-off="{self.dur:.3f}" data-t="{t0:.3f}" data-fx="wipe" '
                                     f'style="background:{self.pal["bright"]}">{esc(inner)}</span>')
                        self.cue(t0, 'swipe', 0.7)
                        continue
                    if tok.startswith('{'):           # pill: "{more efficient}"
                        inner = tok[1:-1]
                        ts = [self.words.take(w, approx)[0] for w in inner.split()]
                        spans.append(('PILL', inner, ts[0]))
                        self.cue(ts[0], 'confirm', 0.8)
                        continue
                    t0, t1 = self.words.take(tok, approx)
                    approx = t1
                    first_t = t0 if first_t is None else first_t
                    seed = abs(hash(tok + str(k))) % 99991 + 3
                    if fx in ('glitch', 'write'):
                        letters = ''.join(f'<i>{esc(c)}</i>' for c in tok)
                        spans.append(f'<span class="w lt" data-on="0" data-off="{self.dur:.3f}" data-fx="word" data-t="{t0:.3f}" data-wfx="{fx}" data-seed="{seed}">{letters}</span>')
                    else:
                        spans.append(f'<span class="w" data-on="0" data-off="{self.dur:.3f}" data-fx="word" data-t="{t0:.3f}" data-wfx="{fx}">{esc(tok)}</span>')
                    if bold and not any(x[3] == ti for x in specials):     # one sound per bold line, on its first word
                        specials.append((t0, special, fx, ti))
                    if fx == 'pop':
                        self.cue(t0, 'bubble', 0.75, st=2 * bubbles)
                        bubbles += 1
                pills = [x for x in spans if isinstance(x, tuple)]
                spans = [x for x in spans if not isinstance(x, tuple)]
                cls = ('tb' + ('' if dark else ' grad')) if bold else 'tt'
                ink = ('#16181e' if bold else '#3a3d46') if dark else '#ffffff'
                grad = ''
                fitw = f' data-fit="{spec["maxw"]}"' if bold else ''
                html_t.append(f'<div class="{cls}"{fitw} style="font-size:{size}px;color:{ink};{grad}">{" ".join(spans)}</div>')
                for _, inner, tp in pills:
                    html_t.append(f'<div class="pillw"><span class="pill" data-on="0" data-off="{self.dur:.3f}" data-t="{tp:.3f}" data-fx="pop" '
                                  f'style="background:{self.pal["dark"]};border-color:{self.pal["pale"]}">{esc(inner)}</span></div>')
            on = float(pg.get('on', (first_t if first_t is not None else approx) - 0.04))
            nxt = pages[k + 1] if k + 1 < len(pages) else None
            off = float(pg.get('e', 0)) or None
            if off is None:
                off = self.dur
                if nxt is not None:
                    off = None          # filled when the next page's start is known
            self.caps.append(dict(on=on, off=off, spec=spec, dark=dark, html=''.join(html_t), last=approx))
            # sounds: every page a soft UI click; specials a notification; glitch a micro mechanical tick
            sp = [x for x in specials if x[1]]
            if not (specials and abs(specials[0][0] - on) < 0.12 and specials[0][1]):
                self.cue(on + 0.02, 'click', 0.55)
            for t0, special, fx, _ in specials:
                if fx == 'glitch':
                    self.cue(t0, 'glitch', 0.75)
                elif fx == 'write':
                    self.cue(t0, 'write', 0.6)
                elif special:
                    self.cue(t0, 'notify', 0.8)
                elif fx != 'pop':
                    self.cue(t0, 'click', 0.45)
        # close each page where the next begins
        rows = [c for c in self.caps if isinstance(c, dict)]
        for a, b in zip(rows[:-1], rows[1:]):
            if a['off'] is None:
                a['off'] = min(b['on'], a['last'] + HOLD)
        # a page made for a white scene, a world or a B-roll leaves with its scene (dark ink must never sit on the talk);
        # only talk-to-talk camera changes carry a caption across the cut, as in the style
        for a in rows:
            sc = next((x for x in self.spans if x[0] - 0.08 <= a['on'] < x[1]), None)
            if sc and (sc[2] != 'aroll' or a['dark']) and a['off'] is not None:
                a['off'] = min(a['off'], sc[1])
        out = []
        for c in self.caps:
            if not isinstance(c, dict):
                out.append(c)
                continue
            if c['off'] is None:
                c['off'] = self.dur
            sp = c['spec']
            if sp.get('center'):
                pos = f'left:0;right:0;top:{int(H * sp["top"])}px;text-align:center'
            elif 'right' in sp:
                pos = f'right:{sp["right"]}px;top:{int(H * sp["top"])}px;text-align:right'
            else:
                pos = f'left:{sp["left"]}px;top:{int(H * sp["top"])}px;text-align:left'
            body = c['html']
            shadow = ('' if c['dark'] else ' lit') + (' ctr' if sp.get('center') else ' rgt' if 'right' in sp else '')
            out.append(f'<div class="cap{shadow}" data-on="{c["on"]:.3f}" data-off="{c["off"]:.3f}" data-fx="fade" data-dur="0.01" style="{pos}">{body}</div>')
        self.caps = out

    # ------------------------------------------------------------------ page
    def write(self):
        self.scenes()
        self.captions()
        p = self.pal
        sd = os.path.join(self.d, 'scenes')
        os.makedirs(os.path.join(sd, 'assets', 'fonts'), exist_ok=True)
        for f in ('DMSans-Variable.woff2', 'InstrumentSerif-Regular.woff2', 'InstrumentSerif-Italic.woff2'):
            shutil.copy(os.path.join(SK, 'assets', 'fonts', f), os.path.join(sd, 'assets', 'fonts', f))
        shutil.copy(os.path.join(SK, 'scripts', 'premium.js'), os.path.join(sd, 'assets', 'premium.js'))
        serif = self.plan.get('special_font') == 'serif'
        bold_family = "'PCSerif'" if serif else "'PCSans'"
        bold_weight = 400 if serif else 700
        body = '\n'.join(self.els + self.caps)
        page = f'''<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width={W}, height={H}" />
<title>Skylight</title>
<script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
<style>
@font-face {{ font-family: 'PCSans'; src: url('assets/fonts/DMSans-Variable.woff2') format('woff2'); font-weight: 100 1000; font-display: block; }}
@font-face {{ font-family: 'PCSerif'; src: url('assets/fonts/InstrumentSerif-Regular.woff2') format('woff2'); font-weight: 400; font-display: block; }}
* {{ margin: 0; padding: 0; box-sizing: border-box; }}
html, body {{ width: {W}px; height: {H}px; overflow: hidden; background: #000; }}
#root {{ position: relative; width: {W}px; height: {H}px; overflow: hidden; background: {p["black"]}; font-family: 'PCSans', sans-serif; }}
.scene {{ position: absolute; inset: 0; overflow: hidden; transform-origin: 50% 40%; }}
.fill {{ position: absolute; left: 0; top: 0; width: {W}px; height: {H}px; object-fit: cover; }}
.tex {{ mix-blend-mode: multiply; pointer-events: none; }}
.lowgrad {{ position: absolute; left: 0; right: 0; bottom: 0; height: 56%;
  background: linear-gradient(180deg, {p["black"]}00 0%, {p["black"]}a6 42%, {p["black"]}f0 100%); }}
.lowgrad.soft {{ height: 46%; background: linear-gradient(180deg, {p["black"]}00 0%, {p["black"]}66 55%, {p["black"]}cc 100%); }}
.cap {{ position: absolute; z-index: 200; line-height: 1.02; }}
.cap .tt {{ font-weight: 340; letter-spacing: -0.025em; white-space: nowrap; }}
.cap .tb {{ font-family: {bold_family}; font-weight: {bold_weight}; letter-spacing: -0.035em; white-space: nowrap; line-height: 1.0;
  padding: 0.02em 0.04em 0.12em; margin: -0.02em -0.04em -0.12em; }}
.cap.lit .tt {{ text-shadow: 0 2px 14px rgba(0,0,0,0.55); }}
.cap.lit .tb {{ filter: drop-shadow(0 0 22px {p["pale"]}55) drop-shadow(0 3px 10px rgba(0,0,0,0.45)); }}
.cap .w {{ display: inline-block; }}
.cap .tb.grad .w:not(.lt), .cap .tb.grad .w.lt i {{ background-image: linear-gradient(180deg, #ffffff 32%, {p["pale"]} 100%);
  -webkit-background-clip: text; background-clip: text; color: transparent; }}
.cap > div {{ width: max-content; }}
.cap.ctr > div {{ margin-left: auto; margin-right: auto; }}
.cap.rgt > div {{ margin-left: auto; }}
.cap .w i {{ font-style: normal; display: inline-block; }}
.hl {{ display: inline-block; color: #fff; font-weight: 700; padding: 0.02em 0.16em 0.08em; border-radius: 6px; margin-left: 0.1em; }}
.pillw {{ margin-top: 22px; }}
.pill {{ display: inline-block; color: #fff; font-weight: 500; font-size: 44px; letter-spacing: -0.02em; padding: 10px 30px 14px;
  border-radius: 999px; border: 3px solid; }}
.nc {{ position: absolute; z-index: 210; color: #fff; }}
.nc .nm {{ font-weight: 700; font-size: 46px; letter-spacing: -0.02em; }}
.nc .ru {{ height: 2px; width: 400px; background: #fff; margin: 10px 0 12px; opacity: 0.85; }}
.nc.r .ru {{ margin-left: auto; }}
.nc .ti {{ font-weight: 400; font-size: 30px; opacity: 0.82; letter-spacing: -0.01em; }}
.svgo {{ position: absolute; left: 0; top: 0; width: {W}px; height: {H}px; pointer-events: none; }}
.axl {{ font: 500 30px 'PCSans'; fill: #8a8e99; }}
.sel {{ position: absolute; transform-origin: 50% 50%; }}
.sel .c {{ position: absolute; width: 46px; height: 46px; border: 0 solid #fff; }}
.sel .tl {{ left: 0; top: 0; border-left-width: 5px; border-top-width: 5px; }}
.sel .tr {{ right: 0; top: 0; border-right-width: 5px; border-top-width: 5px; }}
.sel .bl {{ left: 0; bottom: 0; border-left-width: 5px; border-bottom-width: 5px; }}
.sel .br {{ right: 0; bottom: 0; border-right-width: 5px; border-bottom-width: 5px; }}
.ring {{ position: absolute; width: 760px; height: 760px; border-radius: 50%; border: 70px solid; opacity: 0.55; }}
.track {{ position: absolute; border-radius: 26px; background: #e3e5eb; }}
.bar {{ position: absolute; left: 0; right: 0; bottom: 0; border-radius: 26px 26px 0 0; }}
.blab {{ position: absolute; color: #fff; font: 500 30px 'PCSans'; padding: 6px 16px 9px; border-radius: 10px; white-space: nowrap; }}
.blab.l {{ right: calc(100% + 18px); }} .blab.r {{ left: calc(100% + 18px); }}
.blab i {{ position: absolute; top: 50%; width: 18px; height: 18px; margin-top: -9px; border-radius: 50%; background: #fff; border: 4px solid; border-color: inherit; }}
.blab.l i {{ right: -27px; }} .blab.r i {{ left: -27px; }}
.orb {{ position: absolute; left: 0; top: 0; width: 240px; height: 240px; border-radius: 50%; filter: blur(1.5px); }}
.bloom {{ position: absolute; left: 0; top: 0; width: 600px; height: 600px; border-radius: 50%; }}
.cut {{ position: absolute; }}
.day {{ position: absolute; border-radius: 18px; background: #e2e4ea; overflow: hidden; }}
.day .df {{ position: absolute; inset: 0; border-radius: 18px; opacity: 0; }}
.day span {{ position: absolute; left: 14px; top: 10px; font: 500 26px 'PCSans'; color: #9a9ea8; }}
.day.lab span {{ left: 0; right: 0; top: 50%; transform: translateY(-50%); text-align: center; font: 600 36px 'PCSans'; letter-spacing: -0.02em; }}
.olab {{ position: absolute; left: 50%; top: 250px; transform: translateX(-50%); color: #fff; font: 500 34px 'PCSans'; padding: 6px 20px 10px;
  border-radius: 999px; white-space: nowrap; }}
.tlab {{ position: absolute; color: #fff; font: 500 32px 'PCSans'; padding: 8px 20px 12px; border-radius: 12px; white-space: nowrap; }}
.logo {{ position: absolute; object-fit: contain; }}
.blob {{ position: absolute; left: 90px; top: 760px; width: 900px; height: 900px; border-radius: 50%; }}
.tiltw {{ position: absolute; }}
.cloudl {{ position: absolute; left: -200px; top: 0; width: 1480px; height: {H}px; object-fit: cover; pointer-events: none; }}
.objw {{ position: absolute; }}
.obj {{ display: block; width: 100%; transform-origin: 50% 50%; }}
.oglow {{ position: absolute; left: -30%; top: -30%; width: 160%; height: 160%; border-radius: 50%; filter: blur(10px); }}
.spk {{ position: absolute; width: 10px; height: 10px; border-radius: 50%; background: #fff; box-shadow: 0 0 14px 4px rgba(255,255,255,0.7); }}
.tilt {{ display: block; transform-origin: 50% 50%; filter: drop-shadow(0 30px 40px rgba(0,0,0,0.25)); }}
</style>
</head>
<body>
<svg width="0" height="0" style="position:absolute">
<filter id="hbf" x="-20%" y="0" width="140%" height="100%"><feGaussianBlur stdDeviation="0 0"/></filter>
<filter id="vbf" x="0" y="-20%" width="100%" height="140%"><feGaussianBlur stdDeviation="0 0"/></filter>
</svg>
<div id="root" data-composition-id="main" data-start="0" data-duration="{self.dur:.3f}" data-width="{W}" data-height="{H}">
{body}
</div>
<script src="assets/premium.js"></script>
</body>
</html>
'''
        wt(os.path.join(sd, 'index.html'), page)
        self.cues.sort(key=lambda c: c['t'])
        wj(os.path.join(self.d, 'work', 'cues.json'), self.cues)
        print(f'wrote scenes/index.html ({len(self.els)} scenes, {len(self.caps)} caption pieces) and work/cues.json ({len(self.cues)} cues, '
              f'{len(self.cues) / max(1, self.dur):.2f} a second; the reference has ~1.4)')


if __name__ == '__main__':
    Build(os.path.abspath(sys.argv[1])).write()
