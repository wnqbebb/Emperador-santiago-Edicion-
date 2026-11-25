#!/usr/bin/env python3
"""Convierte el tablero de inspiración de un estilo en un PDF claro y organizado.
  python3 reverse/board_pdf.py [salida.pdf]        (estilo con VES_STYLE, por defecto arthur-brooks)
Misma selección que el tablero (board_webp/blobs.json): portada + cómo leerlo, índice de principios, una sección por
principio (qué es, ejemplo destacado con sus 4 porqués, todas sus escenas) y el tablero completo por video."""
import html, json, os, subprocess, sys, tempfile
from pathlib import Path
from build_library import CAT_NAMES

ROOT = Path(__file__).resolve().parent.parent
STYLE = os.environ.get("VES_STYLE", "arthur-brooks")
REFS = ROOT / "refs" / os.environ.get("VES_REFS", "arthur")
OUT = Path(sys.argv[1] if len(sys.argv) > 1 else ROOT / "entregas" / "Tablero_inspiracion_Arthur_Brooks.pdf")
WORK = Path(tempfile.mkdtemp(prefix="boardpdf_"))

QUE_ES = {
    "captions_text": "Texto sobre la cara del speaker. La palabra clave va grande (sans negrita o serif itálica) y el resto pequeño arriba y abajo, al 75 % de su ancho.",
    "broll_text": "B-roll que muestra literalmente lo que se dice, con papel claro, bordes oscuros y desenfocados, y un texto fijo encima que describe la escena.",
    "imagery_characters": "Pinturas, fotos y personajes con texto alrededor del sujeto; se revelan con un slide de cámara y textura de pintura y papel.",
    "line_text": "Una línea de color de acento que el texto interrumpe y que continúa hacia el siguiente texto; la cámara sigue la punta de la línea.",
    "line_illustration": "La línea lleva a ilustraciones u objetos: punto blanco que marca el objeto, zigzag con paneo que revela fases, o la línea que llega al sujeto.",
    "text_centric": "Escenas de solo texto: fondo blanco o azul con papel muy rugoso, comillas alrededor y el texto cinematográfico en el centro.",
    "center_illustration": "Una ilustración en el centro (figura pintada y rugosa, cerebro, patrón de líneas) que sangra desde abajo, con el texto alrededor.",
    "side_illustration": "Personaje o media luna con textura de tela a un lado y el texto al otro: muestra dos elementos a la vez.",
    "object_element": "Un solo objeto de la historia (libro, foto, cerebro) con el texto alrededor y un revelado rugoso.",
    "graph_stats": "Cifras y gráficos: fondo oscuro con cuadrícula fina que brilla y bola azul que la cámara sigue, o una cifra gigante sobre el plano.",
    "ui_screen": "Pantallas reales (perfil, mensajes, web) en perspectiva con un movimiento de cámara lento.",
    "timeline": "Línea de tiempo por edades o hitos, sobre papel o sobre el A-roll, con fotos que caen en cada hito.",
    "split_layout": "Pantalla dividida (franjas o dos planos) para enumerar o mostrar dos cosas a la vez.",
    "title_cta": "Títulos de inicio, presentación del protagonista, cierre y llamado a la acción.",
}
KAL_NAMES = {"hook_banner": "01 Gancho con franja o título", "split_headline": "02 Pantalla dividida · titular o artículo", "split_social": "03 Pantalla dividida · redes sociales",
             "split_screenrec": "04 Pantalla dividida · grabación de pantalla", "split_broll": "05 Pantalla dividida · video o foto real",
             "split_graphic": "06 Pantalla dividida · gráfico animado", "face_full_word": "07 Cara completa con palabra grande",
             "pip_broll": "08 B-roll completo con cara en círculo", "full_graphic": "09 Gráfico o tarjeta a pantalla completa", "title_cta": "10 Cierre y llamado a la acción"}
KAL_QUE = {
    "hook_banner": "Los primeros segundos: una franja (roja, negra o sin caja) con el titular en mayúsculas sobre la línea divisoria, mientras arriba se apilan varias pruebas rápidas.",
    "split_headline": "Arriba, la captura del titular, artículo o documento que prueba lo que dice; a veces con zoom a la frase y un resaltado amarillo que la barre. Abajo, él.",
    "split_social": "Arriba, un tuit, perfil, canal o comentarios como prueba social. Abajo, él.",
    "split_screenrec": "Arriba, el producto en uso: el prompt que se teclea al ritmo de la voz, el clic ampliado, el resultado. Abajo, él.",
    "split_broll": "Arriba, video o foto real de lo que nombra (personas, robots, productos), un plano por idea, a veces con flechas o rótulos. Abajo, él.",
    "split_graphic": "Arriba, un gráfico diseñado: panel de datos, diagrama, logo, cifra animada o render 3D. Abajo, él.",
    "face_full_word": "Corte a su cara a pantalla completa con UNA palabra grande: marca un giro, un remate o el inicio de un capítulo.",
    "pip_broll": "El material ocupa toda la pantalla y su cara queda en un círculo pequeño arriba: para demostraciones y explicaciones largas.",
    "full_graphic": "Gráfico, tarjeta redondeada o b-roll a pantalla completa sin él: listas a un plano por elemento, repasos y citas.",
    "title_cta": "El cierre: la tesis final, el repaso de lo visto o el pedido de comentar una palabra.",
}
if STYLE != "arthur-brooks":
    CAT_NAMES.update(KAL_NAMES); QUE_ES.update(KAL_QUE)
CREADOR = os.environ.get("VES_CREADOR", "Arthur Brooks")
NOTES = [("design", "¿Por qué este diseño?"), ("effects", "¿Por qué estos efectos?"), ("animation", "¿Por qué esta animación?"), ("why", "¿Por qué aquí?")]
esc = lambda s: html.escape(str(s or ""))


def frame(vid, t, out):
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", f"{max(0, t):.2f}", "-i", str(REFS / f"{vid}.mp4"), "-frames:v", "1", "-q:v", "3", str(out)], check=True)
    return out


def main():
    sc = json.loads((ROOT / "styles" / STYLE / "references/ALL_SCENES.json").read_text())
    if STYLE == "arthur-brooks":
        blobs = json.loads((ROOT / "board_webp/blobs.json").read_text())
        picked = [s for s in sc if s["id"] in blobs and s.get("category") != "aroll_plain"]
    else:
        picked = [s for s in sc if (s.get("quality") or 0) >= 4 and s.get("category") != "aroll_plain" and (ROOT / "board_assets" / STYLE / f"{s['id']}.jpg").exists()]
    for s in picked:
        s["video"] = s.get("video") or s["id"][:3]
    cats = sorted({s['category'] for s in picked if s['category'] in CAT_NAMES}, key=lambda c: CAT_NAMES[c])
    thumb = lambda s: (ROOT / "board_assets" / STYLE / f"{s['id']}.jpg").as_uri()
    fonts = ROOT / "render/public/fonts"
    ff = lambda fam, f, st="normal": f"@font-face{{font-family:'{fam}';src:url('{(fonts / f).as_uri()}');font-style:{st};font-weight:100 900}}"
    css = "\n".join([ff("Inter", "Inter.woff2"), ff("Playfair", "Playfair-Italic.woff2", "italic")]) + """
@page{size:A4;margin:14mm 13mm 16mm}
*{box-sizing:border-box}body{margin:0;font-family:Inter,system-ui,sans-serif;color:#141418;font-size:9.5pt;line-height:1.45}
h1,h2,h3{margin:0}.pb{break-before:page}.blue{color:#1B54F8}em{font-family:Playfair,Georgia,serif;font-style:italic;font-weight:700}
.cover{height:265mm;display:flex;flex-direction:column;justify-content:space-between;background:#1B54F8;color:#fff;margin:-14mm -13mm 0;padding:26mm 20mm}
.cover h1{font-size:40pt;line-height:1.02;font-weight:800;letter-spacing:-.02em}.cover h1 em{font-weight:700}
.cover p{font-size:12pt;max-width:140mm;opacity:.95}.cover .stats{display:flex;gap:14mm}.cover .stats b{display:block;font-size:26pt;font-weight:800}
.guide{display:grid;grid-template-columns:1fr 1fr;gap:6mm;margin-top:6mm}.box{border:1px solid #dfe3ec;border-radius:3mm;padding:4mm}
.box h3{font-size:10.5pt;margin-bottom:1.5mm}.k{font-weight:700;color:#1B54F8}
.anat{display:flex;gap:5mm;align-items:flex-start}.anat img{width:26mm;border-radius:2mm}
table.idx{width:100%;border-collapse:collapse;margin-top:4mm}table.idx td{padding:2.2mm 2mm;border-bottom:1px solid #e6e8ee;vertical-align:top}
table.idx td.n{font-weight:800;color:#1B54F8;width:10mm;font-size:12pt}table.idx td.c{width:16mm;text-align:right;font-variant-numeric:tabular-nums;color:#555}
.sec h2{font-size:20pt;font-weight:800;letter-spacing:-.01em}.sec .num{font-size:11pt;font-weight:700;color:#1B54F8;letter-spacing:.08em}
.what{background:#F1F4FE;border-left:3px solid #1B54F8;padding:3mm 4mm;margin:3mm 0 4mm;font-size:10pt}
.feat{display:grid;grid-template-columns:62mm 1fr;gap:5mm;break-inside:avoid;margin-bottom:5mm}
.feat img{width:62mm;border-radius:2.5mm;display:block}.feat .cap{font-size:8.5pt;color:#1B54F8;margin-top:1.5mm;font-weight:600}
.note{margin-bottom:2.6mm}.note b{display:block;font-size:9pt;color:#1B54F8;margin-bottom:.6mm}.note div{font-size:8.8pt}
.lbl{font-size:8pt;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#6b7080;margin:2mm 0 2.5mm}
.grid{display:grid;grid-template-columns:repeat(6,1fr);gap:3mm}.card{break-inside:avoid}
.card img{width:100%;border-radius:1.5mm;display:block;aspect-ratio:9/16;object-fit:cover;background:#000}
.card .id{font-size:7pt;font-weight:700;margin-top:1mm}.card .q{font-size:6.8pt;color:#444;line-height:1.3;max-height:2.7em;overflow:hidden}
.st{color:#1B54F8;font-size:7pt}
.vid{break-inside:avoid;margin-bottom:4mm}.vid h3{font-size:10pt;margin-bottom:1.5mm}.vgrid{display:grid;grid-template-columns:repeat(10,1fr);gap:2mm}
.vgrid img{width:100%;border-radius:1mm;display:block}.vgrid .id{font-size:5.8pt;color:#555;text-align:center}
.foot{font-size:8pt;color:#777;margin-top:4mm}
"""
    H = [f"<!doctype html><html lang=es><meta charset=utf-8><title>Tablero de inspiración {CREADOR}</title><style>{css}</style><body>"]
    # portada
    n_vid = len({s["video"] for s in picked})
    H.append(f"""<section class=cover><div><div style="font-weight:700;letter-spacing:.12em;font-size:10pt">TABLERO DE INSPIRACIÓN</div>
<h1 style="margin-top:8mm">{CREADOR},<br><em>escena por escena</em></h1>
<p style="margin-top:8mm">Las {len(picked)} mejores escenas de {n_vid} videos de {CREADOR}, ordenadas en los {len(cats)} principios de su estilo de edición.
Cada principio explica qué es, muestra un ejemplo destacado con el porqué de su diseño, efectos, animación y momento, y reúne todas sus escenas.</p></div>
<div class=stats><div><b>{len(picked)}</b>escenas</div><div><b>{len(cats)}</b>principios</div><div><b>{n_vid}</b>videos</div></div></section>""")
    # cómo leerlo
    ex = max(picked, key=lambda s: s.get("quality") or 0)
    H.append(f"""<section class=pb><h2 style="font-size:20pt;font-weight:800">Cómo leer este tablero</h2>
<div class=guide>
<div class=box><h3>1 · Principios</h3>Las escenas están agrupadas en {len(cats)} <span class=k>principios</span>: los tipos de escena que {CREADOR} repite. Cada principio tiene su sección.</div>
<div class=box><h3>2 · Qué es</h3>Al inicio de cada sección, un recuadro azul explica <span class=k>qué es</span> ese principio y cómo se reconoce.</div>
<div class=box><h3>3 · Ejemplo destacado</h3>La mejor escena del principio en grande, con 4 respuestas: <span class=k>¿por qué este diseño?</span>, <span class=k>¿por qué estos efectos?</span>, <span class=k>¿por qué esta animación?</span> y <span class=k>¿por qué aquí?</span> (qué está diciendo en ese momento).</div>
<div class=box><h3>4 · Todas las escenas</h3>Debajo, todas las escenas del principio ordenadas de mejor a peor.</div>
</div>
<div class="box" style="margin-top:6mm"><h3>Cómo se lee cada tarjeta</h3><div class=anat><img src="{thumb(ex)}">
<div><span class=k>{esc(ex['id'])}</span> = video {esc(ex['id'][1:3])}, escena {esc(ex['id'][5:])}.<br>
<span class=k>{ex['start']:.1f} s</span> = segundo del video donde empieza.<br>
<span class=k>“frase”</span> = lo que dice en ese momento.<br>
<span class=st>★★★★★</span> = calidad de la escena como inspiración (5 = la que copiarías).<br>
La sección final, <span class=k>Tablero completo</span>, muestra las {len(picked)} escenas en el orden de cada video.</div></div></div>
<h2 style="font-size:16pt;font-weight:800;margin-top:8mm">Índice de principios</h2>
<table class=idx>""" + "".join(
        f"<tr><td class=n>{CAT_NAMES[c][:2]}</td><td><b>{esc(CAT_NAMES[c][3:])}</b><br><span style='color:#555'>{esc(QUE_ES.get(c, ''))}</span></td><td class=c>{sum(1 for s in picked if s['category'] == c)} esc.</td></tr>"
        for c in cats) + "</table></section>")
    # secciones
    for c in cats:
        items = sorted([s for s in picked if s["category"] == c], key=lambda s: (-(s.get("quality") or 0), s["video"], s["start"]))
        top = items[0]
        big = frame(top["video"], float(top.get("best_t") or (top["start"] + top["end"]) / 2), WORK / f"{top['id']}_big.jpg")
        notes = "".join(f"<div class=note><b>{t}</b><div>{esc(top.get(k))}</div></div>" for k, t in NOTES if top.get(k))
        cards = "".join(f"<div class=card><img src='{thumb(s)}'><div class=id>{esc(s['id'])} · {s['start']:.1f} s <span class=st>{'★' * int(s.get('quality') or 0)}</span></div>"
                        f"<div class=q>“{esc((s.get('script') or '')[:80])}”</div></div>" for s in items)
        H.append(f"""<section class="pb sec"><div class=num>PRINCIPIO {CAT_NAMES[c][:2]}</div><h2>{esc(CAT_NAMES[c][3:])}</h2>
<div class=what><b>Qué es:</b> {esc(QUE_ES.get(c, ''))} <span style="color:#555">· {len(items)} escenas en el tablero</span></div>
<div class=lbl>Ejemplo destacado</div>
<div class=feat><div><img src="{big.as_uri()}"><div class=cap>{esc(top['id'])} · {top['start']:.1f} s<br>“{esc((top.get('script') or '')[:110])}”</div></div><div>{notes}</div></div>
<div class=lbl>Todas las escenas de este principio ({len(items)})</div><div class=grid>{cards}</div></section>""")
    # tablero completo por video
    H.append("<section class=pb><h2 style='font-size:20pt;font-weight:800;margin-bottom:2mm'>Tablero completo</h2><p style='margin:0 0 4mm;color:#555'>Las escenas en el orden en que aparecen en cada video.</p>")
    for v in sorted({s["video"] for s in picked}):
        vs = sorted([s for s in picked if s["video"] == v], key=lambda s: s["start"])
        H.append(f"<div class=vid><h3>Video {v[1:]} · {len(vs)} escenas</h3><div class=vgrid>" + "".join(
            f"<div><img src='{thumb(s)}'><div class=id>{s['start']:.0f}s · {CAT_NAMES[s['category']][:2]}</div></div>" for s in vs) + "</div></div>")
    H.append("<p class=foot>Bajo cada miniatura: segundo del video · número del principio al que pertenece.</p></section></body></html>")
    page = WORK / "tablero.html"
    page.write_text("\n".join(H))
    js = WORK / "pdf.cjs"
    js.write_text(f"""const {{chromium}}=require('playwright');(async()=>{{const b=await chromium.launch();const p=await b.newPage();
await p.goto('{page.as_uri()}',{{waitUntil:'networkidle'}});await p.pdf({{path:{json.dumps(str(OUT))},format:'A4',printBackground:true,
displayHeaderFooter:true,headerTemplate:'<span></span>',footerTemplate:'<div style="font-size:7px;color:#888;width:100%;text-align:center;font-family:sans-serif">Tablero de inspiración · {CREADOR} · <span class=pageNumber></span>/<span class=totalPages></span></div>',
margin:{{top:'14mm',bottom:'16mm',left:'13mm',right:'13mm'}}}});await b.close();}})();""")
    OUT.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(["node", str(js)], check=True, cwd=ROOT / "render")
    print("✓", OUT)


if __name__ == "__main__":
    main()
