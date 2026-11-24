# Using capsule-cinema

`remake-run`, `assemble` and `remake` run capsule-cinema's `scripts/remake_reference.py`, and `capsule-draft` runs this package's `rea_video/integrations/to_capsule.py`. Both run in **capsule-cinema's own Python environment**, so they can import its code and read its `.env`. The interpreter is chosen in this order: `--python` (on `remake-run` and `capsule-draft`) > `$CAPSULE_CINEMA_PYTHON` > `<capsule-root>/.venv/bin/python` > the current interpreter. rea-video's own required dependencies are numpy, OpenCV, Pillow, PyYAML, videomd and onnxruntime.

```bash
CC=~/code/github/capsule-cinema          # capsule-cinema repo

# 1) Decompose (VLM recommended; reuses capsule-cinema's Gemini config; add --lang en for an English report)
rea-video --env-file $CC/.env decompose ref.mp4 -o out/ref --vlm

# 2a) Generate a capsule draft (no changes to capsule-cinema's code; injects the breakdown through tool_factory)
rea-video capsule-draft out/ref/breakdown.json \
    --capsule-root $CC --capsule-name my_ref_remake            # add --write-capsule to save it under capsules/

# 2b) Remake: plan from intent and model → generation jobs → capsule-cinema generates → assemble on the original timeline with a comparison video
rea-video plan out/ref --model seedance-2.5               # reads out/ref/remake/intent.yaml; final prompts go in remake/prompts.json
rea-video remake-plan out/ref/breakdown.json --capsule-root $CC
rea-video remake-run out/ref/remake/jobs.json --dry-run   # inspect the jobs first
rea-video remake-run out/ref/remake/jobs.json             # real calls (billed)
rea-video assemble out/ref/breakdown.json out/ref/remake/results.json
```

- Generated shots: each call of a generation unit is one job. The input type follows the plan (source reference video / one source key frame per shot / first and last frames / text only), and the prompt is the final version in `remake/prompts.json`. No jobs are written if the plan checks report errors.
- Still pan-and-zoom shots and held frames: no model call. `assemble` rebuilds them locally from the measured zoom and pan.
- Code-rendered and screen-recorded shots: the source is kept by default (`keep_original`). To rebuild them, implement the report's text tracks and layout in Remotion.
- To run part of a plan: `remake-run ... --only G2` (a generation unit), or `--only 2,5` / `--only shot_002` (the units containing those shots). If any shot produces no video, the command exits non-zero and the details are in results.json.
- If capsule-cinema isn't at the default path (`~/code/github/capsule-cinema`), set it once with `rea-video prefs capsule_root <path>`, or pass `--capsule-root` every time. `remake-run` must use the same root as `remake-plan`.
