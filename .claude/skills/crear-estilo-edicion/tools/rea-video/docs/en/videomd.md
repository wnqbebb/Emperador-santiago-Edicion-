# The VIDEO.md package

Breaking down a video produces two things:

- **A report for people** (`report.html` / `report.pdf`): what the video is about, why it works, how it was made, and how to remake it.
- **A package for models and programs** (`VIDEO.md` + `video/`): the same conclusions in a fixed format in one directory. Agents read it to answer questions, and downstream projects read it to create remake jobs.

Every skill has a `SKILL.md`, and every video has a `VIDEO.md`. VIDEO.md is an open format. The spec, design notes, integration and generation guides, and validator live at [videomd/videomd](https://github.com/videomd/videomd), which is the source of truth. This page only covers what a rea-video package contains.

## Read it layer by layer

1. **Card** (`VIDEO.md` front matter, a few hundred tokens): what the video is about, how it was made, and how certain that is.
2. **Overview and map** (`VIDEO.md` body, about 1–2k tokens): verdict, story line, remake summary, uncertain points. The map has one file per line: `path | ~tokens | contents · when to read`.
3. **Timeline** (`video/timeline.md`): one shot per line. Keys with `~` are inferred. Keys without it are visible in the picture or measured.
4. **Shot files** (`video/shots/<id>.md`) and frames: open these only to verify a particular shot.

For a 3-minute talking-head video, reading through the overview takes about 2k tokens and adding the timeline about 4k. The full data in `breakdown.json` is about 190k tokens.

## What rea-video puts in the package

| File | Contents |
|---|---|
| `VIDEO.md` | The card has `made_mix` (production methods by share of duration), `confidence`, `readers` (tool / vision model / agent / human) and `source.sha256`. The body has the verdict, what it's about, story line, remake summary, real assets to obtain, uncertain points and the map |
| `video/timeline.md` | `story` narrative role · `seen` picture · `act` performance · `camera` camera movement · `overlay` overlays · `made~` production method · `material~` material source · `remake` remake route · `flag` needs review |
| `video/content.md` | Content and structure, story line, spoken lines |
| `video/cast.md` | Characters, scenes, props |
| `video/sound.md` | Voice, music, sound effects, beat and sources |
| `video/rhythm.md` | Rhythm and key frames: cuts per minute, shot lengths, change curve (one digit per 0.5 seconds), time and length of cuts and transitions (each time with the source frame number @N; if survey checked it, what it cut to), and key frames per shot (time + kind: first frame, action start / landing, turn, element in or out, composition change, peak expression, mid-transition and so on) |
| `video/moments.md` | Special moments (magic reveals, twists, climaxes, continuity errors), one per line: type, time of the change, the four key frames (initial state / method / change / reaction), what happened, and paths to the clip and reveal short. The next line has the explanation steps (* marks the key step) and what's visible / inferred / why viewers missed it. If moments haven't been searched yet, it says how to do it |
| `video/look.md` | Shot size, camera, lighting, editing and gear for live-action shots (when there are any) |
| `video/packaging.md` | Timing and style of subtitles, styled text, stickers and picture-in-picture |
| `video/remake.md` | Remake plan: generation units, shooting schedule, code compositing, real assets to prepare, performance and emotion |
| `video/shots/<id>.md` | Per shot: `inferred` (production method, probability, runner-up, who decided, whether it has real assets), `flags`, `keyframes` (time and kind), `frames`. The body has what's visible, inference and basis, and prompts |
| `breakdown.json`, `shots/`, `stems/`, `sfx/`, `packaging/`, `frames/` (only with code-rendered shots), `storyboard.jpg`, `audio.png` | Full data and media files, all listed in the map |

Topic files with no content aren't generated.

## Commands

```bash
rea-video decompose ref.mp4 -o out/ref      # generates the package along with the breakdown
rea-video videomd out/ref                   # regenerates the package from breakdown.json
rea-video videomd out/ref --check           # validates against the VIDEO.md spec (uses the videomd package)
```

```python
import videomd
pkg = videomd.read("out/ref")   # {"card", "map", "timeline", "shots"}
```
