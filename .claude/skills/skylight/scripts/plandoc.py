"""The planning document: every line of the script on the right, a note box on the left, paste-in reference images.

python -X utf8 plandoc.py <video dir>

The script on the right, the notes on the left, paste-in images, autosave and "Copy my plan" at the top.
Claude pre-fills each box from work/plan.json when it exists,
so the user can just read it, change any line, and send it back. Writes work/plan.html (open it in a browser).
"Copy my plan" puts the text on the clipboard; "Download" saves plan_notes.json (with the pasted images) to drop in work/."""
import base64, html, io, json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import rj, wt, frames


def lines_from(words):
    out, cur = [], []
    for i, w in enumerate(words):
        cur.append(w)
        gap = words[i + 1]['s'] - w['e'] if i + 1 < len(words) else 9
        if w['w'].rstrip().endswith(('.', '?', '!')) or gap > 0.6 or len(cur) >= 14:
            out.append(cur)
            cur = []
    if cur:
        out.append(cur)
    return [{'s': l[0]['s'], 'e': l[-1]['e'], 'text': ' '.join(x['w'] for x in l)} for l in out]


def describe(sc):
    t = sc['type']
    if t == 'aroll':
        s = 'A-roll subtitle scene: the speaker in the upper half, the two-tier caption in the lower half'
        if sc.get('namecard'):
            s += f", name card ({sc['namecard']['who']}, {sc['namecard'].get('side', 'left')})"
        if sc.get('punch'):
            s += f", punch-in x{sc['punch']}"
        return s
    if t == 'broll':
        s = f"B-roll: {os.path.basename(sc['img'])}"
        if sc.get('box'):
            s += ', selector box'
        if sc.get('arrow') or sc.get('arrows'):
            s += ', hand-drawn arrow'
        return s
    return {'bars': 'Full-screen bar graph on light paper', 'line': 'Full-screen line graph on light paper',
            'orbs': 'Full-screen orbs on light paper' + (' (they merge)' if sc.get('merge') else ''),
            'days': 'Full-screen calendar on light paper (days light up)',
            'duo': 'Two-object scene: cut-out person rising, logo, swoosh, text on top',
            'sky': 'Sky scene with an object turning in the clouds', 'night': 'Night sky (vertical whip from the sky)',
            'still': 'Full-frame still'}.get(t, t)


def main():
    d = os.path.abspath(sys.argv[1])
    words = rj(os.path.join(d, 'work', 'words.json'))['words']
    plan = rj(os.path.join(d, 'work', 'plan.json')) if os.path.exists(os.path.join(d, 'work', 'plan.json')) else {}
    pal = rj(os.path.join(d, 'work', 'palette.json')) if os.path.exists(os.path.join(d, 'work', 'palette.json')) else {'options': []}
    lines = lines_from(words)
    # a thumbnail of the A-roll in the middle of each line
    from PIL import Image
    thumbs = {}
    aroll = os.path.join(d, 'work', 'aroll.mp4')
    if os.path.exists(aroll):
        for i, fr in enumerate(frames(aroll, 108, 192, fps=4)):
            thumbs[i / 4] = fr
    def thumb(t):
        if not thumbs:
            return ''
        k = min(thumbs, key=lambda x: abs(x - t))
        im = Image.fromarray(thumbs[k][:, :, ::-1])
        b = io.BytesIO()
        im.save(b, 'JPEG', quality=70)
        return 'data:image/jpeg;base64,' + base64.b64encode(b.getvalue()).decode()
    rows = []
    for i, l in enumerate(lines):
        notes = []
        for sc in plan.get('scenes', []):
            if sc['s'] < l['e'] and sc['e'] > l['s']:
                notes.append(f"{sc['s']:.2f}-{sc['e']:.2f}: {describe(sc)}")
        for pg in plan.get('captions', []):
            if l['s'] - 0.05 <= pg['s'] < l['e']:
                notes.append(f'caption: "{pg["at"]}"' + (f' ({pg.get("pos")}, {pg.get("ink", "light")})' if pg.get('pos') else ''))
        rows.append(dict(n=f'L{i + 1:02d}', s=l['s'], e=l['e'], text=l['text'], note='\n'.join(notes), img=thumb((l['s'] + l['e']) / 2)))
    sw = ''.join(f'<div class="opt"><b>{i}</b> {html.escape(o["name"])}<span>' +
                 ''.join(f'<i style="background:{o[k]}" title="{k} {o[k]}"></i>' for k in ('bright', 'dark', 'pale', 'white', 'black')) +
                 '</span></div>' for i, o in enumerate(pal['options']))
    title = html.escape(plan.get('title', os.path.basename(d)))
    data = json.dumps(rows, ensure_ascii=False)
    page = f'''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Plan: {title}</title>
<style>
:root{{--bg:#111214;--card:#1b1c20;--line:#2a2c31;--ink:#e9eaee;--mute:#8b8f98;--acc:#4f8cff}}
*{{box-sizing:border-box}} body{{margin:0;background:var(--bg);color:var(--ink);font:15px/1.45 -apple-system,Segoe UI,Roboto,sans-serif}}
header{{position:sticky;top:0;z-index:5;background:#111214ee;backdrop-filter:blur(8px);border-bottom:1px solid var(--line);padding:14px 24px;display:flex;gap:16px;align-items:center;flex-wrap:wrap}}
h1{{font-size:18px;margin:0;flex:1 1 300px}} button{{background:var(--acc);color:#fff;border:0;border-radius:10px;padding:9px 16px;font-weight:600;cursor:pointer}}
button.ghost{{background:transparent;border:1px solid var(--line);color:var(--ink)}}
.pal{{padding:12px 24px;display:flex;gap:18px;flex-wrap:wrap;border-bottom:1px solid var(--line)}} .opt{{color:var(--mute);font-size:13px}}
.opt span{{display:flex;gap:4px;margin-top:4px}} .opt i{{width:28px;height:28px;border-radius:6px;display:block;border:1px solid #333}}
main{{max-width:1180px;margin:0 auto;padding:18px 24px 80px}} textarea.gen{{width:100%;min-height:64px;margin:10px 0 18px;background:var(--card);color:var(--ink);border:1px solid var(--line);border-radius:12px;padding:12px;font:inherit}}
.row{{display:grid;grid-template-columns:minmax(0,1.1fr) minmax(0,1fr);gap:22px;padding:18px 0;border-bottom:1px solid var(--line)}}
@media (max-width:760px){{.row{{grid-template-columns:1fr}}}}
.lab{{font-weight:700;font-size:13px;margin-bottom:6px}} .lab span{{color:var(--acc)}}
.row textarea{{width:100%;min-height:110px;background:var(--card);color:var(--ink);border:1px solid var(--line);border-radius:12px;padding:12px;font:inherit;resize:vertical}}
.row textarea:focus{{outline:2px solid var(--acc);border-color:transparent}}
.drop{{margin-top:8px;border:1px dashed var(--line);border-radius:10px;padding:8px 10px;color:var(--mute);font-size:13px;cursor:pointer;min-height:38px;display:flex;gap:8px;flex-wrap:wrap;align-items:center}}
.drop img{{height:72px;border-radius:6px}} .drop .x{{cursor:pointer;color:#f66;margin-left:-6px}}
.script{{display:flex;gap:14px}} .script img{{width:96px;height:171px;object-fit:cover;border-radius:10px;border:1px solid var(--line);flex:none}}
.t{{color:var(--mute);font-size:12px;margin-bottom:6px}} .q{{font-size:17px}}
.toast{{position:fixed;bottom:22px;left:50%;transform:translateX(-50%);background:#222;border:1px solid var(--line);padding:10px 16px;border-radius:10px;opacity:0;transition:.2s}}
</style></head><body>
<header><h1>PLAN &middot; {title}</h1><button id="copy">Copy my plan</button><button class="ghost" id="dl">Download</button><button class="ghost" id="reset">Reset to Claude's plan</button></header>
<div class="pal">{sw}</div>
<main><div class="lab">GENERAL (fonts, colours, anything for the whole video)</div><textarea class="gen" id="general" placeholder="e.g. DM Sans for the main font, a bolder variant for the special words. Blue palette."></textarea><div id="rows"></div></main>
<div class="toast" id="toast"></div>
<script>
const ROWS = {data};
const KEY = 'pc-plan-' + {json.dumps(title)};
let saved = {{}}; try {{ saved = JSON.parse(localStorage.getItem(KEY) || '{{}}'); }} catch (e) {{}}
const state = {{general: saved.general || '', notes: saved.notes || {{}}, imgs: saved.imgs || {{}}}};
function save() {{ try {{ localStorage.setItem(KEY, JSON.stringify(state)); }} catch (e) {{ toast('Could not autosave (storage full?)'); }} }}
function toast(m) {{ const t = document.getElementById('toast'); t.textContent = m; t.style.opacity = 1; setTimeout(() => t.style.opacity = 0, 1600); }}
const box = document.getElementById('rows'); const gen = document.getElementById('general');
gen.value = state.general; gen.oninput = () => {{ state.general = gen.value; save(); }};
function fmt(t) {{ const m = Math.floor(t / 60), s = (t % 60).toFixed(1).padStart(4, '0'); return m + ':' + s; }}
function render() {{
  box.innerHTML = '';
  ROWS.forEach(r => {{
    const el = document.createElement('div'); el.className = 'row';
    const note = state.notes[r.n] !== undefined ? state.notes[r.n] : r.note;
    el.innerHTML = `<div><div class="lab"><span>${{r.n}}</span> &middot; what goes on screen?</div><textarea placeholder="Your plan for this line"></textarea>
      <div class="drop" tabindex="0">+ Reference image (click here, or click the box and paste / drop)</div></div>
      <div class="script">${{r.img ? `<img src="${{r.img}}">` : ''}}<div><div class="t">&#9654; ${{fmt(r.s)}} - ${{fmt(r.e)}}</div><div class="q">&ldquo;${{r.text}}&rdquo;</div></div></div>`;
    const ta = el.querySelector('textarea'); ta.value = note;
    ta.oninput = () => {{ state.notes[r.n] = ta.value; save(); }};
    const dr = el.querySelector('.drop');
    const show = () => {{ dr.querySelectorAll('img,.x').forEach(x => x.remove()); (state.imgs[r.n] || []).forEach((src, i) => {{
      const im = document.createElement('img'); im.src = src; dr.appendChild(im); const x = document.createElement('span'); x.className = 'x'; x.textContent = '×';
      x.onclick = e => {{ e.stopPropagation(); state.imgs[r.n].splice(i, 1); save(); show(); }}; dr.appendChild(x); }}); }};
    const add = f => {{ if (!f || !f.type.startsWith('image/')) return; const rd = new FileReader(); rd.onload = () => {{ (state.imgs[r.n] = state.imgs[r.n] || []).push(rd.result); save(); show(); }}; rd.readAsDataURL(f); }};
    dr.onclick = () => {{ const i = document.createElement('input'); i.type = 'file'; i.accept = 'image/*'; i.multiple = true; i.onchange = () => [...i.files].forEach(add); i.click(); }};
    const paste = e => {{ [...(e.clipboardData || {{}}).items || []].forEach(it => {{ if (it.type.startsWith('image/')) add(it.getAsFile()); }}); }};
    dr.addEventListener('paste', paste); ta.addEventListener('paste', paste);
    dr.ondragover = e => e.preventDefault(); dr.ondrop = e => {{ e.preventDefault(); [...e.dataTransfer.files].forEach(add); }};
    show(); box.appendChild(el);
  }});
}}
render();
function planText() {{
  let s = 'PLAN - ' + {json.dumps(title)} + '\\n';
  if (state.general.trim()) s += 'GENERAL: ' + state.general.trim() + '\\n';
  ROWS.forEach(r => {{ const n = state.notes[r.n] !== undefined ? state.notes[r.n] : r.note; const k = (state.imgs[r.n] || []).length;
    s += r.n + ' "' + r.text + '": ' + (n.trim() || '(no change)') + (k ? ` [${{k}} reference image(s) in plan_notes.json]` : '') + '\\n'; }});
  return s;
}}
document.getElementById('copy').onclick = async () => {{ try {{ await navigator.clipboard.writeText(planText()); toast('Plan copied: paste it to Claude'); }} catch (e) {{ toast('Copy blocked: use Download'); }} }};
document.getElementById('dl').onclick = () => {{ const b = new Blob([JSON.stringify({{text: planText(), notes: state.notes, general: state.general, images: state.imgs}}, null, 1)], {{type: 'application/json'}});
  const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = 'plan_notes.json'; a.click(); }};
document.getElementById('reset').onclick = () => {{ state.notes = {{}}; save(); render(); toast("Back to Claude's plan"); }};
</script></body></html>'''
    wt(os.path.join(d, 'work', 'plan.html'), page)
    print(f'wrote work/plan.html ({len(rows)} lines). Open it, change any line, then "Copy my plan" (or Download -> work/plan_notes.json).')


if __name__ == '__main__':
    main()
