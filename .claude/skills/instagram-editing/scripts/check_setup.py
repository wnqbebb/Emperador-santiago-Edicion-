#!/usr/bin/env python3
"""Check that everything the instagram-editing skill needs is installed, on macOS or Windows.

Prints one line per tool (OK / MISSING / OPTIONAL) and, for anything missing, the install
command for this operating system. Changes nothing on the computer.

Usage:  python check_setup.py
"""
import importlib.util
import platform
import shutil
import subprocess
import sys

IS_MAC = platform.system() == "Darwin"
IS_WIN = platform.system() == "Windows"

INSTALL = {
    "ffmpeg": {"mac": "brew install ffmpeg   (no Homebrew? see https://brew.sh)",
               "win": "winget install Gyan.FFmpeg   (then open a new terminal)"},
    "python": {"mac": "brew install python@3.12   or download from https://www.python.org",
               "win": "winget install Python.Python.3.12   (or python.org, tick 'Add python.exe to PATH')"},
    "faster_whisper": {"any": "pip install faster-whisper"},
    "playwright": {"any": "pip install playwright   then   python -m playwright install chromium"},
    "rembg": {"any": "pip install rembg onnxruntime   (optional: cut the person out for words-behind-the-head)"},
}


def how(key):
    d = INSTALL[key]
    if "any" in d:
        return d["any"]
    return d["mac"] if IS_MAC else d["win"] if IS_WIN else d.get("mac", "")


def line(status, name, detail=""):
    print(f"[{status:8}] {name}" + (f"  -  {detail}" if detail else ""))


def has_module(name):
    return importlib.util.find_spec(name) is not None


def main():
    problems = 0
    print(f"System: {platform.system()} {platform.machine()}, Python {platform.python_version()}\n")

    v = sys.version_info
    if v < (3, 9):
        line("MISSING", "Python 3.10-3.13", "this Python is too old. Install: " + how("python")); problems += 1
    elif v >= (3, 14):
        line("WARNING", "Python version", "very new Python; speech-to-text packages may not install yet. If they fail, install Python 3.12: " + how("python"))
    else:
        line("OK", "Python", platform.python_version())

    for tool in ("ffmpeg", "ffprobe"):
        path = shutil.which(tool)
        if path:
            try:
                ver = subprocess.run([tool, "-version"], capture_output=True, text=True, timeout=20).stdout.split("\n")[0]
            except Exception:
                ver = "found"
            line("OK", tool, ver[:60])
        else:
            line("MISSING", tool, how("ffmpeg")); problems += 1

    if has_module("faster_whisper"):
        line("OK", "faster-whisper (speech to text)")
    else:
        line("MISSING", "faster-whisper (speech to text)", how("faster_whisper")); problems += 1

    if has_module("playwright"):
        try:
            from playwright.sync_api import sync_playwright
            with sync_playwright() as p:
                b = p.chromium.launch()
                b.close()
            line("OK", "Playwright + Chromium (graphics)")
        except Exception:
            line("MISSING", "Chromium for Playwright", "python -m playwright install chromium"); problems += 1
    else:
        line("MISSING", "Playwright (graphics)", how("playwright")); problems += 1

    line("OK" if has_module("rembg") else "OPTIONAL", "rembg (person cut-out)", "" if has_module("rembg") else how("rembg"))

    print("\nAll required tools are installed." if problems == 0 else f"\n{problems} required item(s) missing. Install them, open a new terminal, and run this again.")
    return 0 if problems == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
