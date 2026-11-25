# Skylight

A free Claude Code skill that turns a long podcast into a **premium 9:16 clip** for Shorts, Reels and TikTok.

Give it a podcast (a YouTube link or a file). Claude listens to the whole thing, finds the best question-and-answer moment,
cuts it with several camera angles, reframes it vertical with the speaker's face tracked, and edits it:
- thin captions with one bold keyword that blurs or glitches in;
- name cards;
- B-roll with hand-drawn arrows and selector boxes;
- clean white animations (graphs, orbs, tiles, highlight boxes);
- **generated worlds**: an object floating in the clouds, a sunset, a studio or space.

You also get a planning page where you can change any line and send it back.

- Runs on your computer with your Claude Code subscription: **$0 per clip**, no API keys, no credits.
- Pictures come from Wikimedia Commons (free licences only), with a credits list for your description.
- Skies, clouds, studios, textures and the optional sound effects are all made in code, so they're yours to use.

## Install

Paste the install prompt (`INSTALL PROMPT (paste into Claude Code).txt`, next to this zip in the Drive folder) into Claude Code.
Or do it by hand:
1. Copy this `skylight` folder to `~/.claude/skills/skylight` (Windows: `C:\Users\<you>\.claude\skills\skylight`).
2. Run `node ~/.claude/skills/skylight/scripts/pc.mjs setup` until it prints "All set".

You need Node 18+, Python 3.9+ and ffmpeg. Setup tells you the exact command for anything that's missing:
- Mac: `brew install ffmpeg node`
- Windows: `winget install Gyan.FFmpeg OpenJS.NodeJS Python.Python.3.12`

The first run downloads about 1 GB of free tools: the speech model, OpenCV and the HyperFrames renderer.
Made and tested on a Mac; built to run on Windows too (one Node entry point, no shell scripts).

## Use it

Start a new Claude Code session and say:

> make me a Skylight clip from this podcast: <YouTube link or file>

Add your own music if you want a bed under the voice ("use ~/Music/bed.mp3 as the music"); without one it's voice only.
You get `~/Skylight/<name>/out/<name>.mp4`, the planning page `work/plan.html` and the picture credits.

If you clip someone else's podcast, make sure you're allowed to post it, and put the picture credits in your description.

## Credits

The style was learned from Joseph (Video Editing)'s YouTube tutorial on premium podcast clips with Claude, then rebuilt from
scratch. None of his footage, pictures, sounds or prompts are in here.
- Fonts: DM Sans and Instrument Serif (SIL Open Font License, in `assets/fonts/`).
- Face model: YuNet from OpenCV Zoo (MIT).
- Renders with [HyperFrames](https://github.com/heygen-com/hyperframes).

## License

MIT, see `LICENSE`. The fonts keep their own licence (OFL).
