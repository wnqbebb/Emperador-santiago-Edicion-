# English workflow

This guide goes from install to a remake plan in English. For every command and flag, see the [CLI reference](cli.md).

## 1. Install

You need Python ≥ 3.10 and ffmpeg (macOS: `brew install ffmpeg`; Ubuntu: `apt install ffmpeg`).

```bash
pip install "rea-video[ocr] @ git+https://github.com/JuneYaooo/rea-video"
rea-video --help
```

From a clone, `bash scripts/install_skill.sh` installs the CLI and links the skill into your agent directories.

**Windows** (without Git Bash, do these steps by hand):

```powershell
winget install Gyan.FFmpeg     # or: choco install ffmpeg; then open a new terminal
git clone https://github.com/JuneYaooo/rea-video; cd rea-video
pip install ".[ocr]"
New-Item -ItemType Directory -Force "$HOME\.claude\skills" | Out-Null
New-Item -ItemType Junction -Path "$HOME\.claude\skills\rea-video" -Target "$PWD\skills\rea-video"
```

`Junction` doesn't need administrator rights. `rea-video pdf` looks for Chrome or Edge under `Program Files` or `%LOCALAPPDATA%`. If yours is elsewhere, set `REA_CHROME`.

Common setup problems:

| Problem | What to do |
|---|---|
| Windows: `requires a different Python: 3.8.10 not in '>=3.10'` | Run `py -0p` to list versions, then `py -3.12 -m pip install ".[ocr]"`. If `rea-video` isn't found afterwards, run `py -3.12 -m rea_video` |
| `externally-managed-environment` | Don't use `--break-system-packages`. Run `pipx install "rea-video[ocr] @ git+https://github.com/JuneYaooo/rea-video"` or `bash scripts/install_skill.sh` |
| No matching `onnxruntime` package | Use Python 3.10–3.14: `pipx install --python python3.12 "rea-video[ocr] @ git+https://github.com/JuneYaooo/rea-video"` or `PYTHON_BIN=python3.12 bash scripts/install_skill.sh` |
| `opencv-python` conflicts with the headless build after a manual `[ocr]` install on Python ≤ 3.12 | `pip uninstall -y opencv-python && pip install --force-reinstall --no-deps "opencv-python-headless>=4.8,<5"` |

Optional local speech recognition gives you timed spoken lines when a video has no burned-in subtitles:

```bash
pip install "rea-video[ocr,asr] @ git+https://github.com/JuneYaooo/rea-video"
```

## 2. Switch to English

```bash
rea-video prefs lang en
```

This makes English the default for reports, CLI help and common errors. To get English help and errors without saving a preference, set `REA_VIDEO_LANG=en` instead. That variable doesn't change the report language, so also pass `--lang en` to `decompose`.

What stays the same in English mode:

- **Source text.** Original captions, spoken lines and other quoted text stay in the language of the video.
- **JSON keys.** Schema keys don't change. Fields such as `*_zh` in `breakdown.json` keep their names, and their content follows the report language.

## 3. Decompose

```bash
rea-video decompose ref.mp4 -o out/ref --lang en
rea-video summary out/ref/breakdown.json
```

This runs offline. A vision model (VLM) is optional but makes live action / AI / 3D calls more reliable. The simplest setup is a Gemini key:

```bash
export GEMINI_API_KEY=...
rea-video decompose ref.mp4 -o out/ref --vlm --lang en
```

You can also keep these in a file and pass `rea-video --env-file <path> decompose ...`. Check the `VLM:` line in `summary`: `ok` means it worked, `partial` means some shots got results, `failed` or `not_configured` means the run is the same as having no VLM, and `off` means it wasn't requested.

If subtitles are English only, add `--ocr-lang en`. If they are Japanese or Korean, add `--ocr-lang ja` or `--ocr-lang ko`. For Bengali speech, add `--asr-lang bn`.

## 4. Review and apply

The tool measures pixels, and some labels need someone to look at the frames. An agent that can read images can do this without a VLM:

```bash
rea-video review out/ref
# fill in out/ref/review_answers.json using the tasks and images in out/ref/review_tasks.json
rea-video apply-review out/ref --by your-name
rea-video summary out/ref/breakdown.json
```

- Write `evidence`, `description` and prompts in English.
- Leave `label_probs` as `{}` for shots you didn't look at. They are skipped.
- Answers are merged with the measurements instead of replacing them, so strong evidence such as frame rate and AIGC labels still counts.
- Check shots marked as disputed first, and confirm that any evidence a VLM cites is really visible.
- If you can't view the images, don't override the tool's production-method labels. List uncertain shots instead.
- If you forgot `--lang en`, run `rea-video apply-review out/ref --lang en`. Report text is regenerated, and descriptions and prompts already written by a VLM keep their language.

To correct a single shot and have the tool remember it:

```bash
rea-video correct out/ref --shots 3 --label still_motion --note "This is a slow zoom on a photo"
```

## 5. Read the report

Open `out/ref/report.html`, or make a PDF with `rea-video pdf out/ref` (needs Chrome, Chromium or Edge). The report starts with the verdict, then covers content and structure, characters and scenes, sound, shooting and editing, packaging, the remake plan, the shot list and uncertain points.

Treat "to be confirmed" as a real answer: the tool couldn't settle that point. Machine-transcribed speech is not proofread. Agents should read `VIDEO.md` and `video/` instead of the full `breakdown.json`; see [videomd.md](videomd.md). For what each label means, see [what-it-detects.md](what-it-detects.md).

## 6. Plan a remake

The breakdown and remake plan are separate. Describe what you want in `out/ref/remake/intent.yaml`:

```yaml
model: seedance-2.5
generate: ai           # ai (default): generate only AI shots; all: generate every shot
swaps:
  - from: the original lipstick
    to: my insulated bottle
    image: /absolute/path/product.jpg
```

Then build the plan:

```bash
rea-video models                 # list models
rea-video models seedance-2.5    # prompt format and key-frame needs for one model
rea-video plan out/ref
```

If no model is set, `plan` uses your `rea-video prefs engine <id>` value, then `minimax-h3`. Draft prompts are in the report. Write the final ones to `out/ref/remake/prompts.json` as `{"G1": "..."}` and run `plan` again until its checks pass.

To generate and assemble with Capsule Cinema:

```bash
rea-video prefs capsule_root /path/to/capsule-cinema
rea-video remake-plan out/ref/breakdown.json
rea-video remake-run out/ref/remake/jobs.json --dry-run
rea-video remake-run out/ref/remake/jobs.json    # billed model calls
rea-video assemble out/ref/breakdown.json out/ref/remake/results.json --overlays
```

`rea-video remake out/ref` also needs Capsule Cinema. It rebuilds still shots, cuts in any finished clips, uses the source as a placeholder for the rest, and writes per-shot progress to `remake/status.md`. Add your own clips to `remake/mine.json` as `{"results": {"<shot number>": {"video": "/absolute/path.mp4"}}}` and run it again.

Other shot types:

- **Code-rendered shots:** rebuild them with an HTML video framework, or run `rea-video code-remake out/ref` for a quick draft.
- **Dance and action shots:** run `rea-video drive out/ref`, generate from the driving videos, then run `rea-video drive out/ref --join`.

Remake options:

| Option | What it is | Requirements |
|---|---|---|
| [capsule-cinema](https://github.com/JuneYaooo/capsule-cinema) | Open-source local generation pipeline that works directly with `remake-plan` and `remake-run` | Local setup with your own models and keys; billed per model call |
| [ChatCut](https://chatcut.io/r/github-e4rd?utm_content=skill_reply) (rea-video sponsor) | AI video editor with desktop (macOS / Windows) and web versions that can remake a reference video on one timeline | Account required, no model setup. Regular editing uses your existing agent subscription; generating AI video or images needs a ChatCut membership and uses credits; remaking a reference video needs the desktop version |
| [HyperFrames](https://github.com/heygen-com/hyperframes) | Open-source HTML video framework for rebuilding code-rendered and motion-graphics shots | Node.js 22 or later; the framework is free (Apache-2.0), and its Studio app has paid plans |
| Do it yourself | Shoot and edit yourself, or generate by hand on another platform, following the report's shooting plan and shot list | rea-video is free; other platforms charge their own fees |

More detail: [replicate.md](replicate.md), [capsule-cinema.md](capsule-cinema.md).
