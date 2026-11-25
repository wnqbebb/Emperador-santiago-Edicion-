# Instagram editing skill for Claude Code

Turns a raw talking-head clip into an edited vertical video in the style of reels you like: best takes, tight pacing, captions, graphics and layered sound design. You get a finished MP4 (in Emperador Santiago it is rendered by the editor itself; no Premiere).

Everything runs on your own computer with free tools. Your footage is never uploaded.

## Install (once, about 10 minutes)

You need [Claude Code](https://claude.com/claude-code) and the free tools below. Claude can run the setup check for you and tell you what's missing.

**macOS** (Terminal):
```
brew install ffmpeg python@3.12
python3 -m pip install faster-whisper playwright
python3 -m playwright install chromium
```
No Homebrew? Install it from https://brew.sh first.

**Windows** (PowerShell):
```
winget install Gyan.FFmpeg
winget install Python.Python.3.12
python -m pip install faster-whisper playwright
python -m playwright install chromium
```
Open a new PowerShell window after installing, so the new commands are found.

Optional: `pip install rembg onnxruntime` for the "words behind your head" effect.

Python 3.10–3.13 is recommended. Brand-new Python releases sometimes lack the speech-to-text packages for a while.

**Add the skill:** copy the `instagram-editing` folder into your Claude skills folder:
- macOS: `~/.claude/skills/instagram-editing`
- Windows: `%USERPROFILE%\.claude\skills\instagram-editing`

## Use it

1. Make a folder for the video, with `Footage`, `Inspiration` and `Sounds` subfolders (`Brand` is optional). Drop your raw clip in Footage, 2-4 reels you like in Inspiration, and your sound effects and music in Sounds.
2. Open Claude Code in that folder and say: **"edit my reel"**.
3. Claude explains the workflow and then studies your footage and references, shows you a style brief, and builds version 1.
4. Give notes in plain English ("the pause at 0:07 is too long", "make the title bigger"). Each round becomes a new version; nothing is overwritten.

## What's inside

| | |
|---|---|
| `SKILL.md` | the workflow Claude follows |
| `references/` | digesting footage, editing rules, three reel styles, graphics, sound design, delivery |
| `scripts/check_setup.py` | checks your tools and prints install commands for your system |
| `scripts/transcribe.py` | offline speech-to-text with word timestamps |
| `scripts/render_html.py` | renders code-built graphics to transparent video |
| `preferences.md` | your lasting style rules |
