#!/usr/bin/env python3
"""Render an HTML canvas graphic to video, frame by frame, with headless Chromium (Playwright) + FFmpeg. macOS and Windows.

The page must have ONE <canvas id="c"> and define:
  window.renderAt = (t) => { ...draw the frame for time t in seconds... }   (may return a Promise)
  window.TOTAL    = duration in seconds          (or pass --duration)
  window.ready    = a Promise that resolves once fonts/images are loaded   (optional)
Draw nothing behind the graphic (clearRect) if you want transparency.

Output:
  .mov -> ProRes 4444 with alpha (transparent; for compositing)
  .mp4 -> H.264, opaque (for a quick preview)

Usage:  python render_html.py graphic.html out.mov [--fps 30] [--duration 4.2] [--query "v=title&x=1"]
"""
import argparse
import base64
import pathlib
import subprocess
import sys


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("html")
    ap.add_argument("out")
    ap.add_argument("--fps", type=float, default=30)
    ap.add_argument("--duration", type=float, default=None)
    ap.add_argument("--query", default="")
    a = ap.parse_args()
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        sys.exit("Playwright is not installed. Run: pip install playwright  then  python -m playwright install chromium")

    url = pathlib.Path(a.html).resolve().as_uri() + (("?" + a.query) if a.query else "")
    out = pathlib.Path(a.out)
    alpha = out.suffix.lower() == ".mov"
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()
        page.goto(url)
        page.wait_for_function("typeof window.renderAt === 'function'")
        page.evaluate("() => Promise.resolve(window.ready)")
        total = a.duration or page.evaluate("() => window.TOTAL")
        if not total:
            sys.exit("No duration: set window.TOTAL in the page or pass --duration")
        w, h = page.evaluate("() => [document.getElementById('c').width, document.getElementById('c').height]")
        n = round(total * a.fps)
        venc = ["-c:v", "prores_ks", "-profile:v", "4444", "-pix_fmt", "yuva444p10le", "-vendor", "apl0"] if alpha else \
               ["-c:v", "libx264", "-crf", "16", "-preset", "medium", "-pix_fmt", "yuv420p", "-movflags", "+faststart"]
        ff = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "image2pipe", "-framerate", str(a.fps), "-c:v", "png", "-i", "-",
                               *venc, "-r", str(a.fps), str(out)], stdin=subprocess.PIPE)
        for i in range(n):
            data = page.evaluate("async (t) => { await window.renderAt(t); return document.getElementById('c').toDataURL('image/png').split(',')[1]; }", i / a.fps)
            ff.stdin.write(base64.b64decode(data))
            if i % 30 == 0:
                print(f"  frame {i}/{n}", end="\r")
        ff.stdin.close()
        ff.wait()
        browser.close()
    if ff.returncode != 0:
        sys.exit("FFmpeg failed while encoding")
    print(f"\n{n} frames ({w}x{h}, {a.fps:g} fps, {'transparent ProRes 4444' if alpha else 'H.264'}) -> {out}")


if __name__ == "__main__":
    main()
