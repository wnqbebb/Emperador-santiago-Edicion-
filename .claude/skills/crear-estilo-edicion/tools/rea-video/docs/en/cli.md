# CLI reference

You usually don't need to type these commands: give an agent the repo and a video, and it calls them as described in [SKILL.md](../../skills/rea-video/SKILL.md). This page is for people who want to run the tool themselves or see what the agent is doing. For a guided path, start with [workflow.md](workflow.md).

## Install

Requires Python ≥ 3.10 and ffmpeg (macOS: `brew install ffmpeg`; Ubuntu: `apt install ffmpeg`).

```bash
git clone https://github.com/JuneYaooo/rea-video && cd rea-video
pip install -e ".[ocr]"          # numpy / opencv / pillow / pyyaml / onnxruntime + optional OCR
rea-video --help
bash scripts/install_skill.sh    # optional: installs the CLI and links the skill into the agent directories you have (~/.claude, ~/.codex, ~/.agents, ~/.gemini; ~/.claude if none exist)
```

If you install `[ocr]` by hand, the OCR dependency also installs `opencv-python`, which competes with rea-video's `opencv-python-headless` for the same `cv2` directory. Run this once afterwards (`install_skill.sh` does it for you):
`pip uninstall -y opencv-python && pip install --force-reinstall --no-deps "opencv-python-headless>=4.8,<5"`

Claude Code can also install the skill as a plugin. The CLI still needs `pip install`, and the skill checks for it first:

```text
/plugin marketplace add JuneYaooo/rea-video
/plugin install rea-video@rea-video
```

The first decompose downloads the audio separation models to `~/.cache/rea-video/models`: about 67 MB for vocals and music, and about 149 MB for sound effects. A 30-second video takes about a minute without a VLM.

Once the skill is installed, tell Claude Code, Codex or zcode something like "break down xxx.mp4 and tell me whether it's AI-made". The agent follows [SKILL.md](../../skills/rea-video/SKILL.md): check memory, decompose, review the frames, deliver from the template.

## Quick start

Reports are in Chinese by default. Add `--lang en` to `decompose`, or run `rea-video prefs lang en` once.

```bash

# 1. Deterministic forensics only (offline, free)
rea-video decompose ref.mp4 -o out/ref

# 2. Add a VLM (recommended, not required): a multimodal model looks at the frames, which improves live action / AI / 3D calls
#    Use Gemini directly (set the model with REA_GEMINI_MODEL); it watches clips with sound
export GEMINI_API_KEY=...
rea-video decompose ref.mp4 -o out/ref --vlm
#    For another multimodal model: export REA_VLM_BASE_URL=https://.../v1 REA_VLM_API_KEY=... REA_VLM_MODEL=gpt-4o
#    Settings can also live in a file: rea-video --env-file <path> decompose ref.mp4 -o out/ref --vlm
#    If every VLM call fails the run continues; the report and the "VLM:" line in `rea-video summary` say that all calls failed and the result is the same as no VLM

open out/ref/report.html

# 3. No VLM, but the agent can read images (zcode, Claude Code and other multimodal agents): let the agent act as the VLM
rea-video survey ref.mp4 -o out/ref  # overview first, then close-ups: finds cuts, transitions and key frames per shot (answer, then rerun the same command until done)
rea-video decompose ref.mp4 -o out/ref   # shots follow the cuts from survey
rea-video review out/ref             # writes per-shot visual review tasks and an answer template
rea-video apply-review out/ref --by zcode   # after the agent fills in the answers, merges them into the verdict and report

# 4. Corrections and preferences are remembered (in ~/.rea-video; change the location with REA_VIDEO_HOME)
rea-video correct out/ref --shots 3 --label still_motion --note "This is stop-motion"
rea-video prefs vlm on && rea-video prefs --note "Keep reports short"
rea-video memory

# Audio only: stems/original.wav (original), vocals.wav (dry vocals), music.wav (music), effects.wav (sound effects)
rea-video stems ref.mp4 -o out/ref
```

Audio separation uses the models below. They run on the local CPU and download on first use to `$REA_VIDEO_MODELS` (default `~/.cache/rea-video/models`):

- Vocals and music: UVR MDX-Net Inst HQ 3 (about 67 MB).
- Speakers (only with `rea-video[asr]` installed): pyannote segmentation 3.0 + 3D-Speaker CAM++ (about 35 MB together). When two or more people speak, each gets a track, `stems/voice_S1.wav` and so on, and spoken lines show who said them.
- Sound effects: BandIt v2 multilingual (about 149 MB; Watcharasupat, Wu, Orife, [arXiv 2407.07275](https://arxiv.org/abs/2407.07275), weights under CC BY-SA 4.0). It splits audio into dialogue, music and effects, and rea-video keeps the effects track. Effects in the report are found on this track and preview clips are cut from it, so they contain no vocals or music. It runs at about 1.5x the audio duration. If the model can't be downloaded, effects are detected on the mix instead.

The separation and text recognition models pick their thread count from the machine: performance cores on Apple silicon, physical cores elsewhere, capped by the cores available to the process (including container limits) and by 8. Set `REA_VIDEO_THREADS` to override it. The effect of thread count on results is below 16-bit audio precision and can be ignored.

Example output (mixed video):

```
Verdict: mixed production: code/template render 59% + AI-generated video 41%; overlays: subtitles, title (code or editor compositing)
#1 00:00.000 1.38s code/template render → R01 Remotion rebuild
#2 00:01.375 2.50s AI-generated video (24fps source, no sensor noise...) → R07 first/last-frame generation (capsule-cinema)
...
```

## Remake with capsule-cinema

```bash
CC=~/code/github/capsule-cinema   # capsule-cinema repo; or set CAPSULE_CINEMA_ROOT, or run rea-video prefs capsule_root $CC once and drop --capsule-root
rea-video plan out/ref --model seedance-2.5                                      # builds and checks the remake plan (part two of the report) from remake/intent.yaml and the model
rea-video remake-plan out/ref/breakdown.json --capsule-root $CC                  # turns the plan's generation units into jobs and handoff files (not written if the checks report errors)
rea-video remake-run out/ref/remake/jobs.json                                    # hands off to capsule-cinema to generate (billed; try --dry-run first)
rea-video assemble out/ref/breakdown.json out/ref/remake/results.json            # hands off to capsule-cinema to assemble and check; add --overlays to put subtitles and styled text back on replaced shots
rea-video capsule-draft out/ref/breakdown.json --capsule-root $CC --capsule-name my_remake
```

- Stills with pan and zoom, and held frames: no model call. They are rebuilt locally from the measured zoom and pan.
- Code renders and screen recordings: the report gives the text tracks and layout for a Remotion rebuild.
- Subtitles, styled text and stickers: kept out of generation prompts. References taken from the source (reference video, key frames, first and last frames) have the text erased. Put it back after generation with `assemble --overlays`.
- `capsule-draft`: injects the breakdown through capsule-cinema's own `tool_factory` and produces a reusable recipe draft, without changing capsule-cinema's code.

See [capsule-cinema.md](capsule-cinema.md).

## Commands

| Command | What it does |
|---|---|
| `decompose VIDEO [--vlm] [--no-ocr] [--ocr-lang zh\|en\|ja\|ko] [--lang zh\|en] [--no-packaging] [--max-vlm-shots N] [--no-asr] [--asr-lang auto\|bn] [--no-speakers] [--no-moments]` | Breaks down a video. Writes breakdown.json, report.html/md, the video package (`VIDEO.md` + `video/`), storyboard.jpg, first and last frames per shot, `packaging/` (subtitle SRT, styled ASS, packaging timeline, sticker crops) and `sfx/` (a short clip of each sound effect, playable from the report's effects table). `--lang en` puts the verdict, report, `summary` output and VLM descriptions in English (default Chinese; agents choose from the language of the request, and `rea-video prefs lang en` sets the default; the `*_zh` field names in breakdown.json stay, and their content follows the report language). `--no-packaging` skips the packaging layer (saves about 30–50 seconds per minute of video). `--ocr-lang en` reads English-only text with an English model that keeps word spaces better (about 8 MB; it cannot read Chinese, so leave mixed text on the default). `--ocr-lang ja` reads subtitles and styled text with a Japanese model (about 10 MB, downloaded to `$REA_VIDEO_MODELS` on first use; offline, point `$REA_OCR_REC_MODEL` at a local model), and `rea-video prefs ocr_lang ja` sets the default. `--ocr-lang ko` does the same with a Korean model (PP-OCRv5, about 14 MB) and turns off text direction classification, which misreads Korean lines as upside down. `--max-vlm-shots N` caps VLM calls (default 60); with more shots, the least certain go first and the rest rely on deterministic forensics, and the `VLM:` line says how many were sent. With the optional `rea-video[asr]`, local speech recognition runs on the dry vocals and writes timed lines to `speech.lines` and the report's script table (machine transcription, not proofread); `--no-asr` skips it. For Bengali speech add `--asr-lang bn`, which uses a Bengali model (SenseVoice doesn't support Bengali and hears it as English, Japanese or Korean; about 90 MB, downloaded to `$REA_VIDEO_MODELS` on first use), and `rea-video prefs asr_lang bn` sets the default |
| `survey VIDEO [-o OUT_DIR] [--vlm] [--no-detail] [--workers N]` | Looks before cutting. Round one lays the whole video out as a contact sheet of small cells (small cells save tokens and are only for finding cuts; the count follows the editing pace, half evenly spaced and half where the picture changes most) and asks whether each neighboring pair is the same picture, a lot of change, a hard cut, a transition or unclear. Later rounds zoom in frame by frame on transitions and unclear spots (transitions already dense enough in the overview, and unclear spots between adjacent frames, are not enlarged; this is decided from the change curve). Transition frames are sampled where change is greatest, tasks in a round can run concurrently, and there are at most three rounds. Once cuts are set, each shot gets a key-frame image (candidates for shots with a lot of action, a few cells for short shots), and the AI picks the key frames, names their kind and judges how the picture was made. Every image is filled to the size the model won't downscale (about 1568 px / 1.15 MP) with as many cells as fit. Questions and answers use JEV format: `state` holds the material, questions carry `criteria`, and answers contain only options and probabilities. Results go to `survey/timeline.json` (cuts, transition lengths, key frames per shot, shot lengths, change curve, base picture judgment per segment). decompose cuts shots from it, and the report's and package's "rhythm and key frames" come from it. Without a VLM the agent answers: the command prints the images to read and the answer files to write, then you rerun the same command. `--vlm` answers with the configured model. decompose runs it automatically when VLM is on (`--no-survey` skips it) |
| `review OUT_DIR` | Writes per-shot visual review tasks (review_tasks.json) and an answer template (review_answers.json) for an agent that can read images |
| `moments OUT_DIR [--vlm] [--no-vlm] [--redo]` | Finds special moments: magic reveals, plot twists, climaxes, continuity errors. It starts from the spoken lines, on-screen text, a whole-video contact sheet and tool candidates (a gasp, a sudden rise in voice level, fast motion that freezes; these are only hints), and picks the passages and their types. Each passage becomes a large frame-by-frame sheet, from which it picks the initial state, the method or key action, the moment of change and the reaction. If the change falls between two cells it checks frame by frame once more. Each moment is then told in 3–6 steps (the key step, the frame range of the change, a red circle when the position is certain, a zoom region, what is visible, what is inferred, why viewers missed it). The overview samples by visual change (denser where there is motion, near-identical frames merged). Results go to the report's "Special moments" section and `video/moments.md`. Each moment exports a numbered diagram with the frame-by-frame process (`M1.jpg`), a slow-motion clip of the reveal (`M1_slow_*.mp4`: only the changing part, 0.2 seconds per frame with timestamps, holding on a circled key frame), a reveal short (`M1_reveal_*.mp4`: normal speed → slowed and zoomed change → freeze → reaction), and the original clip with sound plus the source key frames (`moments/`). Without a VLM the agent answers and reruns the same command. A VLM that accepts video also gets the clip with sound. With only `GEMINI_API_KEY`, it uses Gemini's own API. decompose runs this automatically when VLM is on (about 3–5 extra calls; `--no-moments` skips it) |
| `apply-review OUT_DIR [ANSWERS] [--by NAME] [--lang zh\|en]` | Merges the agent's visual answers with the deterministic results and rewrites breakdown.json and the report. `--lang` can switch the report language at this step (verdict, evidence and report text are regenerated; descriptions and prompts already written by the VLM keep their language) |
| `correct OUT_DIR --shots N --label L [--real yes/no] [--note]` | Records a user correction: updates the verdict and report and saves it to memory (applied automatically to the same file later, and shown as a hint when reviewing similar shots) |
| `prefs [KEY VALUE] [--note TEXT]` | User preferences: default engine, whether VLM is on by default, VLM config file, reviewer name, report language (`lang zh\|en`), free-text notes for the agent |
| `memory [--export-labels YAML]` | Shows what is remembered (preferences, common corrections); exports corrections as evaluation samples |
| `probe VIDEO` | Reads metadata clues only (capture device, implicit AIGC labels, C2PA, editor signatures) |
| `summary breakdown.json` | Prints a compact verdict and marks low-confidence shots to review |
| `videomd OUT_DIR` | Regenerates the video package (`VIDEO.md` + `video/`, for models and downstream programs; format in [videomd.md](videomd.md)) from breakdown.json. decompose and apply-review do this automatically |
| `videomd OUT_DIR --check` | Validates a directory against the video package spec and lists each problem |
| `pdf OUT_DIR` | Prints report.html to report.pdf with the local Chrome / Chromium / Edge (`REA_CHROME` sets the path). Folded body text is expanded; reference data such as timelines and per-shot evidence stays folded |
| `tiles VIDEO --start --end --every [--grid]` | Builds a frame grid over a time range for close review. `--grid` draws a line every 0.1 in whole-frame coordinates, for placing the red circle on special moments |
| `frames OUT_DIR [--every 0.25] [--points 4000] [--all]` | Splits code-rendered shots into scenes (a new scene starts when the drawn elements change position or shape as a whole) and writes `frames/`: full-size first, middle and last frames per scene, `scene_XX_layer.png` (a cutout of the drawn layer with background and text removed), `points/scene_XX.json` (sample points of that layer) and `scenes.json` (base color, background glow, foreground colors, blob count, extent, centroid path over time). Works on dark and light backgrounds. decompose runs it automatically on code-rendered shots |
| `compare REF REMAKE [--scenes frames/scenes.json] [-o DIR]` | Compares the drawn layer of a remake and its source frame by frame: position, shape overlap and amount. Each side extracts foreground against its own base color, so a changed background can still be compared. Reports what to change (shift earlier or later, left or right, spread, amount, foreground and base color differences) for the whole clip, each scene and the worst frames. `-o` writes `compare.json` and a side-by-side of the worst moments, `compare_worst.jpg` |
| `drive OUT_DIR [--shots 3-7] [--depth] [--no-clean] [--prefer 10] [--max 15]` | Builds driving videos for dance and action shots: erases post-production subtitles and stickers, cuts at pauses near beats, and writes `drive/seg_XX.mp4` (silent), `seg_XX_first.jpg` (align the character image's framing and direction to it), `seg_XX_music.wav`, `segments.jpg` and a `README.md` with prompts for each route. By default it uses the plan's motion-driven units (shots marked with `performance.move` during review). `--depth` also writes depth videos (needs transformers + torch) |
| `drive OUT_DIR --join [RESULTS]` | Fits generated segments (default `drive/results.json`: `{"seg_01": path}`) to their lengths, joins them, cuts them by shot and writes `remake/mine.json`. Then run `remake` for the comparison video |
| `eval labels.yaml` | Measures accuracy and cut F1 on labeled samples |
| `capsule breakdown.json` | Exports capsule-cinema's video analysis JSON |
| `models [ID]` | Lists generation models in the capability map. With an id, prints that model's prompt format and key-frame requirements (`models keyframes` prints the general key-frame guide). Models added in `~/.rea-video/capabilities/models/*.yaml` are listed too |
| `plan OUT_DIR [--model ID] [--generate ai\|all]` | Builds part two of the report from the remake intent `remake/intent.yaml` (model, whole video or AI shots only, what to swap): generation units, inputs per call, draft prompts and plan checks. Final per-model prompts in `remake/prompts.json` are format-checked. The breakdown itself doesn't change |
| `remake-plan` | Writes the plan's generation units as jobs and handoff files |
| `remake` / `assemble` | Hand off to capsule-cinema to assemble the remake and check it |
| `remake-run JOBS [--dry-run] [--only G2\|2,5\|shot_002] [--capsule-root]` | Hands remake jobs to capsule-cinema (billed). Exits non-zero if any job produced no video |
| `capsule-draft breakdown.json` | Generates a capsule-cinema capsule draft |

## Pipeline

```
Ingest ─► Decompose ─► Video IR ─► Plan ─► Reconstruct ─► Verify ─► Remix
```

| Stage | Scope |
|---|---|
| Ingest, Decompose, Video IR (`breakdown.json`) | Available; the main body of this repo |
| Plan | Available: a remake route per shot, and capsule-cinema jobs for AI shots |
| Reconstruct | Partial: AI shots go to capsule-cinema and still pan-and-zoom shots are rebuilt locally. For code layers the tool gives text tracks and layout, and does not generate a Remotion project |
| Verify | Partial: `assemble` puts the remake together and outputs a comparison video. There is no automatic scorecard across all shots |
| Remix | Not available |

1. **Ingest**: probe, extract frames, separate audio.
2. **Decompose**: deterministic CV and a VLM split the work. CV handles exact time and position: cuts, OCR tracks, segmentation, camera motion, beats, word alignment. The VLM handles meaning: shot intent, performance, style.
3. **Video IR**: timeline → tracks → clips. Each clip is labeled with a render type (`code` / `gen` / `footage` / `audio`) and carries parameters, evidence and unknowns.
4. **Plan**: reads the [capability map](../../rea_video/capabilities/README.md), routes each generation unit to primitives and models, and outputs a Shot Recipe with cost estimates and points that need user confirmation.
5. **Reconstruct**: the code layer renders with tools such as Remotion, the generation layer calls models, the audio layer uses TTS, music and effects, and everything is composited.
6. **Verify**: checks cut alignment, OCR text consistency, layout IoU, perceptual similarity, subject consistency, motion paths, beats and lip sync, and outputs a scorecard so an agent can loop on the worst shots.
7. **Remix**: when swapping people, products, copy, language or aspect ratio, only the affected layers are re-rendered.

## Two modes

- **fidelity**: match structure, rhythm, camera, text and motion item by item, and measure the result with scores.
- **adapt**: keep the relationships that made the source work, such as the hook, reveal and rhythm, and rewrite the content for a new topic.

The two can be mixed by layer. For example, rhythm and camera can use fidelity while people and copy use adapt.

`rea-video clean-paths <dir> [--apply]`: removes local machine paths from an older breakdown package so it can be shared. By default it only reports. Paths still needed at runtime, such as generation jobs, are kept and listed.
