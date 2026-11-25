---
name: skylight
description: "Skylight: turn a long podcast (a YouTube link or a file) into a premium 9:16 viral clip, all on this computer for $0. Two parts. The podcast clipper transcribes the whole podcast, maps every camera angle and picks a 40-60 s clip that opens on the interviewer's question, gives one point or story and ends on the guest's conclusion. The editor reframes it to 9:16 with the speaker tracked (face top half, nose centred), writes a planning doc (script right, notes left, paste-in images), pulls one accent colour from the footage and builds every scene in code. Talking shots get a two-tier caption (DM Sans light lead-in, bold keyword that blurs or glitches in), name cards and static punch-ins. B-roll gets hand-drawn arrows and selector boxes. White light-paper animations (bar and line graphs, merging orbs, tiles, highlight box, pills) and generated worlds fill the rest. A world is a cut-out object floating in a code-made sky, sunset, studio, space or night, with drifting cloud layers. Every cut lands soft and pulls into focus; pans are hard cuts that slide. The user's own music bed sits under the voice, with no sound effects. macOS and Windows. Use whenever the user says Skylight, premium clips, the premium podcast style, podcast clipper, clip this podcast, make a viral clip / reel / short from a podcast or interview, or asks for this style."
---

# Skylight

Podcast in, a premium 9:16 clip out. **Format: 9:16, 1080x1920, always.** The podcast is usually 16:9 and gets reframed with
face tracking, which is part of the style. Everything runs locally: free pictures from Wikimedia Commons, the backgrounds and
textures made in code, the render with HyperFrames, no paid service and no API key.

Read `reference/style.md` first (the look, type, transitions, pacing and sound in numbers). Copy the shape of the real files in
`examples/ai-shutdown-1123/work/` and `examples/hormozi-ideas-1123/work/`.

## What you need from the user

Ask once, in one message, only for what they didn't already give. Then do the whole edit without more questions.
- **The podcast:** a YouTube link or a video file. Two or more cameras is best (close on each person plus a wide). One camera works too.
- Optional: the moment they want ("the part about pricing"). Otherwise the clipper picks the best question.
- Optional: **their own music bed** (an audio file they have the rights to). Never pick a track for them. Without one the clip
  has the voice only. They can also set `SKYLIGHT_MUSIC` to a file once.
- Names and titles for the name cards, if the video's description doesn't give them.

If they clip someone else's podcast, remind them once that posting it is their call and their responsibility.

## How to run it

Every step is `node ~/.claude/skills/skylight/scripts/pc.mjs <command> <dir> ...`, written `pc <command>` below. Write the full
command each time (in zsh a `$PC` variable won't split). On Windows `~` is `C:\Users\<them>`.

Run `pc setup` once. It must print "All set"; fix every MISSING line the way it says (Mac: `brew install ffmpeg node`, Windows:
`winget install Gyan.FFmpeg OpenJS.NodeJS Python.Python.3.12`), asking the user before installing anything.

New video: `pc new ~/Skylight/<short-name>` (below: `<dir>`).

### Part 1: the podcast clipper

1. `pc get <dir> <link or file>`: the podcast as H.264 up to 1080p, plus `raw/podcast.info.json` (title and description: names,
   titles, chapters).
2. `pc breakdown <dir>`: the word-by-word transcript and a frame-by-frame breakdown. A 17-minute podcast takes ~6 minutes. It writes:
   - `work/breakdown.md`: every line with its time, the camera angle on screen, and **Q** on questions.
   - `work/angles.png`: one picture per camera.
   - `work/shots.json`.
3. **Choose the clip** by reading `breakdown.md` (and the description's chapters).
   - Start on **one of the interviewer's questions**: that's the hook.
   - The guest's answer **delivers one point concisely or tells one story**.
   - **End on the guest's conclusion.**
   - 40-60 s.
   - **A new camera angle every few lines**: the breakdown shows them.
   - Keep transitional statements. Cut repeats, false starts, long pauses and tangents. Cut at word edges with ~0.1 s of air.
   - Write `work/clip.json`: `{"title", "src": "raw/podcast.mp4", "why", "segments": [[start, end], ...]}` in source seconds.
   - Before you commit, sheet the stretch at 1 fps and look at who is talking.
4. `pc cut <dir>`: `work/clip.mp4`, `voice.wav` and `words.json` (re-transcribed on the clip). Read `work/transcript.txt` and fix
   misheard words in `words.json`.

### Part 2: the editor

5. `pc track <dir>`: the 9:16 A-roll (`work/aroll.mp4`).
   - **What it does:** the face sits in the top half with the nose on the centre line (`--nose 0.36`), face height ~34% of the
     frame (`--face`). The tracking is smoothed and has a dead zone and a speed limit. It never goes out of bounds. A speaker
     change inside a shot becomes a cut.
   - **Look at `work/aroll_sheet.png`.** In wide shots the mouth check can pick a listener with a hand at their mouth, or miss a
     talker whose beard hides their lips.
   - **Wrong person?** Add `{"s", "e", "x": share of the source width}` to `work/speakers.json` and run it again.
6. `pc palette <dir>`: the accent colour that stands out in the A-roll, made into two vibrant tones (bright, dark) and two dull
   ones (white, black) used in every scene. Three options go in `work/palette.json` and `palette.png`. Choose by topic; the
   footage's own colour wins when it fits, blue is the safe default.
7. **Plan every line**, write `work/plan.json` (format below), then `pc plandoc <dir>` → `work/plan.html`.
   - **What goes where:** A-roll for transitional statements and to rest the viewer. B-roll for emotional moments and the people
     or things being talked about. A white animation for every valuable moment that can be visualised: a number, a comparison,
     a change, a threshold.
   - **Use 2-4 `world` scenes per clip**, wherever a line names a thing or an image. They're the signature of the style.
   - **Shares to aim for:** talk ~40%, B-roll ~25%, full screens ~35%. About 0.4 cuts a second. Never more than ~4.5 s on a
     face; cut away within 7 s.
   - Fill the plan yourself. Give the user `plan.html` with the video: they can change any line there and press "Copy my plan"
     to send it back to you.
8. **Pictures.**
   - `pc images <dir> slot="search words" ...` fetches from Wikimedia Commons (free licences only, contact sheets in `work/dl/`).
     Use short search words ("acoustic guitar"). Commons rejects bursts, so the script sends one request at a time.
   - Then `pc prep <dir> name=slot_k:how ...` with one of these:
     - `cover`: a full-frame 9:16 B-roll. Add `:x,y` to say where to centre the crop.
     - `white`: an object on a white background, cut out. Add `:l,t,r,b` to crop a group shot to one object.
     - `glass`: like `white`, but glass stays see-through.
     - `person`: a person cut out with `hyperframes remove-background`, locally.
     - `logo`: keeps the logo's transparency.
   - B-roll should show people when it can, and be in colour, not black and white.
   - To cut out a guest, grab a frame from the podcast first: `ffmpeg -ss <t> -i raw/podcast.mp4 -frames:v 1 work/x.png`.
   - Write `IMAGE_CREDITS.md` from `work/dl/credits.json`. CC BY and BY-SA pictures need the credit in the post's description.
9. `pc build <dir>`, then `pc snap <dir> 1.0,5.5,...` and **look** at the stills. Check:
   - every caption page;
   - the scene after every cut;
   - the arrows on their targets;
   - the bold words fitting the frame.

   Fix what's wrong, then `pc render <dir>`. A 45 s clip renders in about a minute.
10. `pc mix <dir> [--music <their file>]`: the voice, their bed 13.2 dB under it, no sound effects, -15.5 LUFS.
    - `--sfx soft` adds whooshes on the transitions only; `--sfx full` adds the whole code-made kit.
    - Then `pc final <dir> <name>` → `out/<name>.mp4`.
    - `pc all <dir> <name> [--music file]` runs build, render, mix and final in one go.
11. Show them `out/<name>.mp4`, `work/plan.html` and the credits. Ask for their notes, change the plan and render again.

### plan.json

```json
{"title": "...", "duration": 41.1, "palette": 0, "special_font": "sans | serif",
 "people": {"roman": {"name": "Roman Yampolskiy", "title": "AI safety researcher"}},
 "scenes": [ {"type": "aroll", "s": 0, "e": 2.18, "in": "focus", "namecard": {"who": "roman", "side": "left", "t": 0.3, "e": 3.7}},
             {"type": "aroll", "s": 2.18, "e": 4.13, "in": "focus", "punch": 1.35}, ... ],
 "captions": [ {"s": 0.0, "at": "what would / !!g convince you?"},
               {"s": 12.62, "at": "and we couldn't / !!shut it down / for a month.", "pos": "top", "ink": "dark"}, ... ]}
```

**Scenes** (`s`/`e` in clip seconds, back to back):
- `aroll`:
  - optional `namecard` the first time each person speaks (interviewer left, guest right);
  - optional `punch` 1.3-1.4 for a static punch-in.
- `broll`:
  - `img` (a picture or an `.mp4`);
  - `drift` [grow, dx, dy];
  - `box` [x, y, w, h, t] for a selector box;
  - `arrow` {from, to, t, bend};
  - `texture` cloth|none.
- `bars`: `bars` [{label, keys [[t, height 0-1, grey?]]}].
- `line`: `pts`, `t`, `dur`, `threshold` [v, label, t].
- `orbs`: `labels`, `merge` t.
- `days`: tiles that light up.
  - `n` and `keys` [[t, lit, secs]] for a calendar;
  - or `labels` for named tiles.
- `duo`: a cut-out `img` rising, `left`/`right` logos, `shape`.
- `world`, a generated place:
  - `plate`: `sky` (a real sky photo prepped as `assets/img/sky.jpg`, otherwise made in code), `sunset`, `night`, `studio`, `studio_light`, `space`, `paper`, or any picture path.
  - `objects`: `[{img, x, y (centre/top px), w, r (deg), spin (deg/s), bob (px), enter: rise|drop|pop|fade|none, t, glow}]`. Cut-outs come from `prep ...:white`, `:glass` or `:person`.
  - `clouds`: two drifting layers, one behind and one in front; on by default for sky and sunset.
  - `sparkle`: n glowing specks drifting up (night, space, studio).
- `still`.

**`in`** (how a scene starts):
- `focus`: a hard cut that lands blurred and pulls focus in 5 frames. Every cut does this.
- `pan`: a hard cut, then the new shot slides ~6.5% and settles in 0.5 s. Use it into B-roll and full screens, and on camera
  changes between two people.
- `return`: back to the A-roll, landing at 104% and settling.
- `whipup`: a vertical whip, the next scene rising from below (sky → night).
- `rise`.

**Captions** (one page per phrase):
- **Tiers:** split by ` / `.
  - A plain tier is the thin lead-in.
  - `!` makes a tier bold; `!!` makes it a bold *special* tier.
  - `!!g` glitches it in letter by letter, `!!w` writes it out, `!p` pops it in.
  - A third plain tier prints small.
- **Inline:** `[close to zero,]` is a highlight box; `{more efficient}` is a pill.
- **`pos`:** `aroll` (default, left at ~65%), `tl`, `tr`, `bl`, `br`, `low`, `top`, `mid`, `bottom`.
- **`ink: dark`:** for the white scenes.
- Words come on with the voice (aligned to `words.json`). A page clears 0.6 s after its last word.

## Rules

- **The clip comes first.** It's a question, an answer and a conclusion. A great edit can't save a clip without a hook.
- **The footage keeps its own colour.** No grade on the speakers. The only darkening is the lower gradient under the captions.
- **One accent colour, four tones, in every scene.** Two fonts: DM Sans Light and DM Sans Bold, or Instrument Serif for a
  "serif" special font. Three textures: cloth (light, on B-roll), halftone (cut-out layouts) and light paper (white animations).
- **Every line gets the two-tier caption**, with one special word or phrase per page. Lowercase, never all caps, no boxes, no strokes.
- **More worlds than stock photos.** When a line names a thing, prefer a `world` (a cut-out object in a generated place) to a plain
  photo. Glass objects get `:glass` so the scene shows through.
- **No sound effects by default, the user's own music under the voice.** Never pick a music track for them.
- **No slow pushes or zooms on the speakers.** Static punch-ins are fine.
- **No flash frames, no black frames, no dissolves between shots.**
- **Credit every picture** (`IMAGE_CREDITS.md`). Use only free-licence pictures or ones the user gives you.
- Never post or upload anything for the user.

## Files

- **`scripts/pc.mjs`:** the one entry point (macOS and Windows). It finds ffmpeg (PATH, `PC_FFMPEG`, Homebrew, winget), the
  private Python (`~/.cache/skylight/venv`) and yt-dlp.
- **`scripts/breakdown.py`:** transcript + shots + camera angles + faces → `breakdown.md`.
- **`scripts/cut.py`:** `clip.json` → the clip, the voice, the words.
- **`scripts/track.py`:** the 9:16 tracked A-roll (YuNet faces, mouth activity, `speakers.json` hints).
- **`scripts/palette.py`:** accent colour → four tones, three options.
- **`scripts/plandoc.py`:** the planning document.
- **`scripts/fetch_images.py`, `scripts/prep_images.py`:** Commons pictures, covers, cut-outs, logos.
- **`scripts/gen_assets.py`:** cloth, halftone and paper textures; the world plates (sky, sunset, night, studio, studio_light,
  space) and two cloud layers, all made in code.
- **`scripts/build.py` + `scripts/premium.js`:** plan → the HyperFrames page and the cue sheet. The runtime draws every frame
  from the time alone.
- **`scripts/sfx.py`, `scripts/mix.py`:** the optional sound kit made in code (`sfx/`, free to use) and the mix and master.
- **`assets/fonts/`:** DM Sans and Instrument Serif (OFL, licences inside).
- **`assets/models/`:** the YuNet face model (MIT, OpenCV Zoo).
- **`examples/`:** two finished clips' real working files to copy.
- **`reference/style.md`:** the style in numbers.
