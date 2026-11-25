"""Evidencia para el estilo Kallaway: capturas reales de la web, listas para la mitad superior (1080×941) o pantalla completa.
  python3 pipeline/evidence.py shot <p> URL [--name E01] [--full] [--selector CSS] [--scroll PX] [--dark]
      → projects/<p>/media/evidence/E01.png (+ E01_tall.png si --tall, para mover con move:"scroll") y una línea en CREDITOS.md
  python3 pipeline/evidence.py list <p>          → qué hay capturado y de dónde
Reglas: solo páginas públicas; se guarda la URL y la fecha como crédito; no se capturan páginas con datos personales de terceros.
Buscar la noticia es trabajo del modelo (su buscador web): 2–3 fuentes por afirmación, y cada cifra del guion debe verse en una captura."""
import argparse, datetime, json, sys
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent
JS = "const {chromium}=require('playwright');(async()=>{const a=JSON.parse(process.argv[1]);const b=await chromium.launch();" \
     "const c=await b.newContext({viewport:{width:a.w,height:a.h},deviceScaleFactor:2,colorScheme:a.dark?'dark':'light',locale:'es-ES'});" \
     "const p=await c.newPage();await p.goto(a.url,{waitUntil:'domcontentloaded',timeout:45000});await p.waitForTimeout(2500);" \
     "for(const t of ['Aceptar','Accept all','Accept','Aceptar todo','I agree','Agree']){try{await p.getByRole('button',{name:t}).first().click({timeout:600})}catch(e){}}" \
     "if(a.scroll)await p.evaluate(y=>window.scrollTo(0,y),a.scroll);await p.waitForTimeout(400);" \
     "if(a.selector){await p.locator(a.selector).first().screenshot({path:a.out})}else{await p.screenshot({path:a.out})}" \
     "if(a.tall){await p.screenshot({path:a.tall,fullPage:true})}console.log(await p.title());await b.close()})().catch(e=>{console.error(String(e));process.exit(1)})"


def shot(a):
    import subprocess
    d = ROOT / "projects" / a.name / "media" / "evidence"; d.mkdir(parents=True, exist_ok=True)
    n = a.id or f"E{len(list(d.glob('E*.png'))) + 1:02d}"
    cfg = {"url": a.url, "w": 540, "h": 960 if a.full else 470, "out": str(d / f"{n}.png"), "selector": a.selector, "scroll": a.scroll, "dark": a.dark,
           "tall": str(d / f"{n}_tall.png") if a.tall else None}
    r = subprocess.run(["node", "-e", JS, json.dumps(cfg)], capture_output=True, text=True, cwd=ROOT / "render")
    if r.returncode:
        sys.exit(f"[evidence] no se pudo capturar {a.url}: {r.stderr.strip()[-300:]}")
    with open(d / "CREDITOS.md", "a") as f:
        f.write(f"- `{n}.png` — {r.stdout.strip()} — {a.url} — capturado {datetime.date.today()}\n")
    print(f"[evidence] ✓ media/evidence/{n}.png  ({r.stdout.strip()})")


def lst(a):
    f = ROOT / "projects" / a.name / "media" / "evidence" / "CREDITOS.md"
    print(f.read_text() if f.exists() else "sin capturas")


if __name__ == "__main__":
    ap = argparse.ArgumentParser(); sp = ap.add_subparsers(dest="cmd", required=True)
    s = sp.add_parser("shot"); s.add_argument("name"); s.add_argument("url"); s.add_argument("--id"); s.add_argument("--full", action="store_true")
    s.add_argument("--selector"); s.add_argument("--scroll", type=int, default=0); s.add_argument("--dark", action="store_true"); s.add_argument("--tall", action="store_true"); s.set_defaults(f=shot)
    s = sp.add_parser("list"); s.add_argument("name"); s.set_defaults(f=lst)
    a = ap.parse_args(); a.f(a)
