"""The generation part of a remake: which shots a video model makes and how they are fed to it.

Three inputs, kept apart:
  - the breakdown: the source's shots, scenes and timing (facts, the same whatever model is used)
  - the remake intent (remake/intent.yaml, filled in with the user): the model, whether every shot is generated or only
    the ones the source generated, and what is swapped for what (people, animals, products), with images where given
  - the model's limits from the capability map: seconds per call, shots per call, reference video / images it takes

One packer turns them into generation units. The feed is chosen from what the model takes, best first:
  remix      the source stretch as reference video; the model copies cuts, camera and pacing
  keyframes  no reference video but several shots and images per call: one source frame per shot fixes composition
  frames     one shot per call from its first (and last) frame
  text       prompt only
and consecutive shots go into as few calls as the limits allow (a long stretch is cut where the scene changes).

Prompts come in two layers: a brief per unit (what each shot is in the source, what changes, which image is which) with a
generic draft, and the final prompt the agent writes for the model's own format (remake/prompts.json). `checks()` reports
what would go wrong before anything is paid for: images or reference seconds over the limit, very short units, too many
calls, swaps with nothing to show them, prompts that break the model's format.
"""
from __future__ import annotations

import json
import re
from pathlib import Path

import yaml

from .readings import shot_description
from . import entities, performance
from .classify import LABEL_ZH
from .i18n import T, join, lang, model_name, semi, shot_ids, using
from .plan import camera_move_words, framing_words, hailuo_bracket, shot_prompts, with_acting

REF_CLIP_S = 15.0  # one reference video: Seedance / Kling take clips up to about 15 s each
SHORT_UNIT_S = 3.0  # a call this short on its own is unstable and wasteful
CALLS_PER_MIN = 12  # more calls than this per generated minute: the plan is cutting too finely
UNKNOWN_IMAGES = 4  # a model that takes reference images without a stated limit is planned for this many
REMIX_MIN_REF_S = 5.0  # reference video shorter than this per call is a motion / look reference, too short to carry a stretch of shots

GEN_LABELS = ("ai_video", "cg_3d", "anim_2d")
# generate = all: filmed and clipped shots are generated too (the user swaps people / products and remakes it by model);
# code, screen and still inserts are still built locally
ALL_GEN_LABELS = GEN_LABELS + ("live_action", "stop_motion", "film_footage", "avatar")
INSERT_LABELS = ("code_render", "screen_capture", "still_motion", "static_hold")
INTENT_FILE = Path("remake") / "intent.yaml"
REDRAWN_DIR = Path("remake") / "redrawn"
PROMPTS_FILE = Path("remake") / "prompts.json"

STRATEGY_ZH = {"remix": ("参考原片改写", "remix of the source"), "keyframes": ("关键帧参考多镜头", "multi-shot from source keyframes"),
               "frames": ("首帧 / 首尾帧逐镜", "first / last frame, shot by shot"), "text": ("文生视频", "text to video")}


def strategy_name(s: str) -> str:
    zh, en = STRATEGY_ZH.get(s, (s, s))
    return T(zh, en)


# ---------------------------------------------------------------- intent
def clean_intent(d) -> dict:
    """The intent as the planner reads it; anything malformed is dropped, not guessed."""
    d = d if isinstance(d, dict) else {}
    out: dict = {"generate": "all" if str(d.get("generate", "ai")).strip().lower() == "all" else "ai", "swaps": []}
    if isinstance(d.get("model"), str) and d["model"].strip():
        out["model"] = d["model"].strip()
    for s in d.get("swaps") or []:
        if not isinstance(s, dict) or not (s.get("to") or s.get("image")):
            continue
        img = s.get("image")
        img = str(Path(img).expanduser().resolve()) if isinstance(img, str) and img.strip() else None
        out["swaps"].append({"from": str(s.get("from") or "").strip(), "to": str(s.get("to") or "").strip(), "image": img})
    if d.get("notes"):
        out["notes"] = str(d["notes"]).strip()
    return out


def load_intent(out: Path) -> dict:
    p = Path(out) / INTENT_FILE
    if not p.is_file():
        return clean_intent({})
    try:
        return clean_intent(yaml.safe_load(p.read_text(encoding="utf-8")))
    except yaml.YAMLError as exc:
        return {**clean_intent({}), "error": str(exc)[:200]}


def save_intent(out: Path, intent: dict) -> Path:
    p = Path(out) / INTENT_FILE
    p.parent.mkdir(parents=True, exist_ok=True)
    keep = {k: v for k, v in intent.items() if k in ("model", "generate", "swaps", "notes") and v not in (None, "", [])}
    p.write_text(yaml.safe_dump(keep, allow_unicode=True, sort_keys=False), encoding="utf-8")
    return p


def load_prompts(out: Path) -> dict[str, str]:
    """remake/prompts.json: {"G1": "<final prompt>"}, written for the chosen model's own format."""
    p = Path(out) / PROMPTS_FILE
    try:
        got = json.loads(p.read_text(encoding="utf-8")) if p.is_file() else {}
    except (OSError, ValueError):
        return {}
    return {k: v for k, v in got.items() if isinstance(v, str) and v.strip()} if isinstance(got, dict) else {}


def save_prompts(out: Path, prompts: dict[str, str]) -> Path:
    p = Path(out) / PROMPTS_FILE
    p.parent.mkdir(parents=True, exist_ok=True)
    clean = {k: v.strip() for k, v in prompts.items() if isinstance(k, str) and isinstance(v, str) and v.strip()}
    p.write_text(json.dumps(clean, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return p


# ---------------------------------------------------------------- what the model takes
def spec_of(model: dict | None) -> dict:
    m = model or {}
    lim, prim = m.get("limits") or {}, set(m.get("primitives") or [])
    d, refs = lim.get("duration_s") or {}, lim.get("refs") or {}
    rv = (lim.get("ref_video_s") or {}).get("max")
    multi_ref = "video.multi_reference" in prim
    plan = m.get("planning") or {}
    return {"max": float(d.get("max") or 10), "min": float(d.get("min") or 0),
            "steps": [float(x) for x in d.get("steps") or []], "steps_with_refs": [float(x) for x in lim.get("duration_with_refs_s") or []],
            "multi_shot": "video.multi_shot" in prim, "shots": int(lim.get("shots_per_generation") or 0) or None,
            "ref_video": "video.reference_video" in prim, "ref_videos": int(refs.get("video") or 1),
            "ref_total": float(rv) if rv else REF_CLIP_S * max(1, int(refs.get("video") or 1)),
            "multi_ref": multi_ref, "images": int(refs.get("image") or (UNKNOWN_IMAGES if multi_ref else 0)),
            "images_stated": bool(refs.get("image")), "prefer": plan.get("strategy"), "plan_images": plan.get("images"),
            "no_real_faces": bool(plan.get("no_real_faces")),
            "no_audio_with_ref_video": bool(plan.get("no_audio_with_ref_video")),
            "max_hardcut_s": float(plan["max_hardcut_s"]) if plan.get("max_hardcut_s") else None,
            "api_params": dict(plan["api_params"]) if isinstance(plan.get("api_params"), dict) else {},
            "first": "video.i2v_first_frame" in prim, "last": "video.i2v_first_last" in prim,
            "exclusive": bool(lim.get("exclusive_inputs")), "native_audio": bool((m.get("audio") or {}).get("native"))}


def effective_native_audio(spec: dict, strategy: str) -> bool:
    """Whether the chosen strategy can actually generate native sound on this model."""
    return bool(spec.get("native_audio")) and not (strategy == "remix" and spec.get("no_audio_with_ref_video"))


def call_seconds(spec: dict, secs: float, refs: bool = False) -> int:
    """The length one call asks for: the model's allowed lengths when it only takes some (Veo: 4 / 6 / 8 s, 8 s with
    reference images), else whole seconds within its range; the clip is trimmed to `secs` afterwards."""
    steps = (spec.get("steps_with_refs") if refs else None) or spec.get("steps") or []
    if steps:
        return int(next((x for x in sorted(steps) if x >= secs - 0.05), max(steps)))
    lo, hi = int(spec.get("min") or 1), int(spec.get("max") or 15)
    return int(min(hi, max(lo, -(-round(secs, 2) // 1))))


def planned_images(spec: dict) -> int:
    """Images a plan uses per call: the model's limit, or the narrower default its capability entry sets."""
    return min(spec["images"], spec.get("plan_images") or spec["images"])


def choose_strategy(spec: dict, n_own: int) -> str:
    pref = spec.get("prefer")
    if pref == "text":
        return "text"
    if pref == "frames" and spec["first"]:
        return "frames"
    if spec["ref_video"] and (spec["multi_shot"] or pref == "remix") and pref in (None, "remix") and spec["ref_total"] >= REMIX_MIN_REF_S:
        return "remix"
    if spec["multi_shot"] and spec["multi_ref"] and pref in (None, "keyframes") and planned_images(spec) >= n_own + 2:
        return "keyframes"
    if spec["multi_shot"] and not spec["multi_ref"] and n_own == 0:
        return "text"
    if spec["first"]:
        return "frames"
    return "text"


# ---------------------------------------------------------------- packing
def runs(shots: list[dict], labels: tuple, skip: set[int], joinable_inserts: bool) -> list[list[dict]]:
    """Stretches of consecutive shots to generate. Inserts made elsewhere (code, screen, stills, a clip reused from
    another unit) do not break a stretch when the strategy can carry them; anything else does."""
    out, cur = [], []
    for r in shots:
        lab = r["base"]["label"]
        if lab in labels and r["index"] not in skip:
            cur.append(r)
            continue
        if cur and joinable_inserts and (lab in INSERT_LABELS or r["index"] in skip):
            continue
        if cur:
            out.append(cur)
        cur = []
    if cur:
        out.append(cur)
    return out


def pack(run: list[dict], max_s: float, max_shots: int | None, new_scene: set[int], new_part: set[int] | None = None) -> list[list[dict]]:
    """Fewest calls within the per-call seconds and shots; where there is a choice, cut where a part of the story
    starts (a new caption card or narrative step) and at a scene change, and avoid calls shorter than SHORT_UNIT_S.
    A single shot longer than max_s stays one unit (made in parts)."""
    new_part = new_part or set()
    n = len(run)
    best = [0.0] + [float("inf")] * n
    prev = [0] * (n + 1)
    for j in range(1, n + 1):
        for i in range(j - 1, -1, -1):
            seg = run[i:j]
            dur = sum(r["duration"] for r in seg)
            if len(seg) > 1 and (dur > max_s + 1e-6 or (max_shots and len(seg) > max_shots)):
                break
            # a story part (caption card, narrative step) is the stronger seam; a colour-histogram scene change the weaker
            cost = (1.0 + (0.3 if i > 0 and run[i]["index"] not in new_part else 0.0) + (0.2 if i > 0 and run[i]["index"] not in new_scene else 0.0)
                    + (0.5 if dur < SHORT_UNIT_S else 0.0))
            if best[i] + cost < best[j]:
                best[j], prev[j] = best[i] + cost, i
    out, j = [], n
    while j > 0:
        out.append(run[prev[j]:j])
        j = prev[j]
    return out[::-1]


def _ranges(seg: list[dict]) -> list[list[float]]:
    out: list[list[float]] = []
    for r in seg:
        if out and abs(out[-1][1] - r["start"]) < 1e-3:
            out[-1][1] = r["end"]
        else:
            out.append([r["start"], r["end"]])
    return [[round(a, 3), round(z, 3)] for a, z in out]


def _clips(ranges: list[list[float]], each: float) -> list[list[list[float]]]:
    """Source ranges as reference clips of at most `each` seconds."""
    clips, cur, used = [], [], 0.0
    for a, z in ranges:
        while z - a > 1e-3:
            take = min(z - a, each - used)
            cur.append([round(a, 3), round(a + take, 3)])
            used += take
            a += take
            if used >= each - 1e-3:
                clips.append(cur)
                cur, used = [], 0.0
    if cur:
        clips.append(cur)
    return clips


# ---------------------------------------------------------------- one unit
_WORD_NUMS = ("ONE", "TWO", "THREE", "FOUR", "FIVE", "SIX", "SEVEN", "EIGHT", "NINE", "TEN", "ELEVEN", "TWELVE")
_STATIC_ZH_RE = re.compile(r"^(?:(?:竖屏|横屏|方屏)(?:\s*\d+:\d+)?[，,；;\s]*)*(?:(?:大?远景|大?全景|中近景|中全景|中景|近景|大?特写|平视|略?[俯仰]拍|顶拍)[，,。；;\s]*)+")
_STATIC_EN_RE = re.compile(r"^(?:(?:vertical|horizontal|square)(?:\s*\d+:\d+)?[,;.\s]*)*(?:(?:extreme\s+|medium\s+)?(?:wide|full|medium|close-up)(?:\s+shot)?[,;.\s]*|(?:eye-level|slightly\s+(?:high|low)\s+angle|high\s+angle|low\s+angle|top-down)[,;.\s]*)+", re.I)
_LANG_MAP = {"zh": "Chinese", "en": "English", "ja": "Japanese", "ko": "Korean", "es": "Spanish", "fr": "French"}
_REAL_FACE_LABELS = ("live_action", "film_footage", "avatar")


def _shot_text(r: dict) -> str:
    """What happens in the shot, in the report's language when the reader wrote it in both."""
    p = shot_prompts(r)
    if lang() == "en" and p.get("video_prompt_en"):
        return p["video_prompt_en"]
    return p.get("video_prompt") or shot_description(r)


def _motion_text(r: dict, en: bool = False) -> str:
    """Motion-only text for first/last-frame image-to-video: prefers an explicit motion_prompt, else strips static
    framing prefixes from the video prompt so the text does not repeat what the input frame already shows."""
    p = shot_prompts(r)
    if en:
        if p.get("motion_prompt_en"):
            return p["motion_prompt_en"]
        base = p.get("video_prompt_en") or ""
        return _STATIC_EN_RE.sub("", base).strip() or base
    if lang() == "en" and p.get("motion_prompt_en"):
        return p["motion_prompt_en"]
    if p.get("motion_prompt"):
        return p["motion_prompt"]
    base = _shot_text(r)
    return (_STATIC_EN_RE if lang() == "en" else _STATIC_ZH_RE).sub("", base).strip() or base


def _line_lang(text: str, default_code: str = "") -> str:
    if re.search(r"[\u3040-\u30ff]", text):
        return "Japanese"
    if re.search(r"[\uac00-\ud7af]", text):
        return "Korean"
    if re.search(r"[\u3400-\u9fff]", text):
        return "Chinese"
    return _LANG_MAP.get(default_code.lower(), "English")


def _shot_audio(b: dict | None, r: dict, want_dialogue: bool, want_sfx: bool) -> tuple[list[dict], list[str]]:
    """Spoken lines and diegetic SFX falling inside shot `r`."""
    if not b:
        return [], []
    dlg: list[dict] = []
    if want_dialogue:
        narr_lang = str(((b.get("whole_video_vlm") or {}).get("narration") or {}).get("language") or "")
        for idx, ln in enumerate(entities.script(b), 1):
            a, z = ln.get("start"), ln.get("end")
            if isinstance(a, (int, float)) and isinstance(z, (int, float)) and r["start"] <= (a + z) / 2 < r["end"]:
                txt = str(ln.get("text") or "").strip()
                if not txt:
                    continue
                spk = str(ln.get("voice") or ln.get("speaker") or f"S{idx}").strip()
                dlg.append({"speaker": spk, "text": txt, "lang": _line_lang(txt, narr_lang),
                            **({"delivery": ln["delivery"]} if ln.get("delivery") else {})})
    sfx: list[str] = []
    if want_sfx:
        for e in (b.get("audio_plan") or {}).get("sfx_merged") or []:
            t = e.get("t")
            if isinstance(t, (int, float)) and r["start"] <= t < r["end"] and e.get("confidence") != "low" and e.get("sync_with") != "text_pop":
                desc = str(e.get("description") or e.get("type") or "").strip()
                if desc and desc not in sfx:
                    sfx.append(desc)
    return dlg, sfx


def _has_real_face(r: dict, person_shots: set[int]) -> bool:
    """Whether a shot likely shows a real / identifiable face (not a tabletop, product or scenery shot)."""
    lab = (r.get("base") or {}).get("label")
    if lab == "avatar":
        return True
    faces = r.get("faces")
    if isinstance(faces, (int, float)) and faces >= 0.15:
        return True
    if lab in ("live_action", "film_footage"):
        if r["index"] in person_shots or performance.of(r):
            return True
        if faces is None:  # breakdown without face detection: be conservative on live/film shots
            return True
    return False


def _brief(seg: list[dict], keyframe_tag: dict[int, str], b: dict | None = None,
           want_dialogue: bool = False, want_sfx: bool = False) -> list[dict]:
    person_shots = {s for c in (entities.cast(b).get("characters") or []) if c.get("kind") == "person" for s in (c.get("shots") or [])} if b else set()
    out, acc = [], 0.0
    for r in seg:
        act = performance.of(r)
        mv_loc, mv_en = camera_move_words(r)
        dlg, sfx = _shot_audio(b, r, want_dialogue, want_sfx)
        has_face = _has_real_face(r, person_shots)
        out.append({"shot": r["index"], "time": [round(r["start"], 3), round(r["end"], 3)], "at": round(acc, 3),
                    "duration": round(r["duration"], 3), "label": r["base"]["label"],
                    "source": shot_description(r),
                    "action": with_acting(_shot_text(r), act, en=lang() == "en"),
                    "motion": with_acting(_motion_text(r, en=lang() == "en"), act, en=lang() == "en"),
                    "framing": framing_words(r)[0], "camera_move": mv_loc,
                    "action_en": with_acting(shot_prompts(r).get("video_prompt_en") or "", act, en=True),
                    "motion_en": with_acting(_motion_text(r, en=True), act, en=True),
                    "framing_en": framing_words(r)[1], "camera_move_en": mv_en,
                    "bracket": hailuo_bracket(r), "real_face": has_face,
                    "composition": keyframe_tag.get(r["index"]),
                    **({"dialogue": dlg} if dlg else {}),
                    **({"sfx": sfx} if sfx else {}),
                    **({"acting": performance.summary(act)} if act else {})})
        acc += r["duration"]
    return out


REF_TAG = re.compile(r"@(图片|视频)(\d+)")


def _swap_line(sw: dict) -> str:
    # the words describe what the shot shows, not an edit: Seedance-style models read 换成 / 替换 / 改成 as an edit task
    f = sw.get("from") or T("主体", "subject")
    t = sw.get("to") or sw.get("tag") or T("用户给的主体", "the user's subject")
    return (T("原片里{f}的位置，这次是{t}", "where the source has {f}, this video has {t}", f=f, t=t)
            + (T("（参考 {k}）", " (see {k})", k=sw["tag"]) if sw.get("tag") else ""))


def _format_audio_bits(x: dict, fmt: dict, en: bool) -> str:
    """Format a shot's spoken lines and SFX in the chosen model's own syntax."""
    bits = []
    sfx_tpl = fmt.get("sfx_fmt")
    for s in x.get("sfx") or []:
        if en and not s.isascii():
            continue
        bits.append(sfx_tpl.format(speaker="", lang="English", text=s, emotion="") if sfx_tpl else T("音效：{s}", "SFX: {s}", s=s))
    dlg_tpl = fmt.get("dialogue_fmt")
    for idx, d in enumerate(x.get("dialogue") or [], 1):
        spk = d.get("speaker") or f"S{idx}"
        if en and not spk.isascii():
            spk = f"S{idx}"
        elif dlg_tpl and "({speaker})" in dlg_tpl and not re.fullmatch(r"S\d+", spk):
            spk = f"S{idx}"  # MiniMax H3 expects speaker codes (S1), (S2)
        txt = d["text"].replace('"', "'")
        if dlg_tpl:
            bits.append(dlg_tpl.format(speaker=spk, lang=d.get("lang", "Chinese"), text=txt, emotion=""))
        else:
            bits.append(T('{p}："{t}"', '{p}: "{t}"', p=spk, t=txt))
    return (". " if en else "。") + (" ".join(bits) if en else "；".join(bits)) if bits else ""


def _tail_lines(raw_tail: list[str] | None, brief: list[dict], ambience: str = "") -> list[str]:
    """Populate soundscape tail fields (such as MiniMax H3's overall_soundscape:) with measured SFX / ambience when available."""
    if not raw_tail:
        return []
    sfx_en = list(dict.fromkeys(s for x in brief for s in (x.get("sfx") or []) if s.isascii()))
    amb_en = ambience.strip() if ambience and ambience.isascii() else ""
    out = []
    for line in raw_tail:
        if line.startswith("overall_soundscape:") and (sfx_en or amb_en):
            parts = [amb_en.rstrip(".")] if amb_en else []
            if sfx_en:
                parts.append("Distinct action sounds: " + ", ".join(sfx_en[:5]))
            out.append("overall_soundscape: " + ". ".join(parts) + ".")
        else:
            out.append(line)
    return out


def _draft(strategy: str, refs: list[dict], brief: list[dict], swaps: list[dict], style, fmt: dict | None = None,
           ambience: str = "") -> str:
    """A prompt from the brief: what to keep, what changes, shot by shot. `fmt` (the model's `draft` block in
    prompting.yaml) sets the prompt language, the shot lines, how images / videos are named, camera brackets, dialogue
    syntax and the fixed fields, so the draft is already in the model's own shape."""
    raw = fmt or {}
    dl = raw.get("lang") or lang()
    with using(dl):
        # any field may be split by language ({zh: …, en: …}); a field missing for this language falls back to the generic shape
        fmt = {k: (v.get(lang()) if isinstance(v, dict) else v) for k, v in raw.items()}
        en = lang() == "en"
        vids = T("、", ", ").join(dict.fromkeys(r["tag"] for r in refs if r["tag"].startswith("@视频")))
        head = []
        if strategy == "remix":
            head.append(T("{v} 是原片：照它的分镜生成，镜头数、每个镜头的时长、景别、机位、运镜、动作和剪辑节奏都跟它一致，画面内容照下面写",
                          "{v} is the source: follow its shots (count, length, size, camera, movement, action and cutting rhythm); the picture is as written below", v=vids))
        elif strategy == "keyframes":
            head.append(T("按下面的镜头顺序一次生成，镜头之间硬切；每个镜头的构图、景别和机位参考对应的原片画面图",
                          "Generate the shots below in order in one go, hard cuts between them; each shot takes composition, size and camera from its source frame image"))
        head += [_swap_line(sw) for sw in swaps]
        # in first/last-frame mode, the input frame already fixes aspect ratio, lighting and colour grade; repeating them weakens motion
        if strategy != "frames":
            st = style.get(lang(), "") if isinstance(style, dict) else style
            if st:
                head.append(st)
        if fmt.get("negatives_line", True):
            head.append(T("画面里不要出现字幕、文字和水印", "No subtitles, captions or watermarks in the picture"))
        lines = []
        for i, x in enumerate(brief, 1):
            if strategy == "frames":
                text = (x.get("motion_en") if en and x.get("motion_en") else x.get("motion") or x.get("action")) \
                    or T("（缺镜头描述：先看图复核补写）", "(no description: write one in the image review)")
                mv = x.get("camera_move_en") if en else x.get("camera_move")
                if fmt.get("camera_brackets") and x.get("bracket") and "[" not in text:
                    text = f"{x['bracket']} {text}"
                elif mv and mv.lower() not in text.lower():
                    text = mv + T("，", ", ") + text
            else:
                text = (x.get("action_en") if en and x.get("action_en") else x["action"]) \
                    or T("（缺镜头描述：先看图复核补写）", "(no description: write one in the image review)")
                framing = x.get("framing_en") if en else x.get("framing")
                if strategy == "keyframes" and not x.get("composition") and framing:
                    text = framing + T("。", ". ") + text
                if x.get("composition"):
                    text += T("（构图参考 {k}）", " (composition: {k})", k=x["composition"])
                if fmt.get("camera_brackets") and x.get("bracket") and "[" not in text:
                    text = f"{x['bracket']} {text}"
            audio_tail = _format_audio_bits(x, fmt, en)
            if audio_tail:
                text = text.rstrip("。.；;") + audio_tail
            a, z = x["at"], x["at"] + x["duration"]
            i_word = _WORD_NUMS[i - 1] if i <= len(_WORD_NUMS) else str(i)
            keys = {"i": i, "I_WORD": i_word, "text": text, "a": _mmss(a), "z": _mmss(z), "at": _mmss(a, ms=True),
                    "s0": int(round(a)), "s1": max(int(round(z)), int(round(a)) + 1), "d": max(1, int(round(x["duration"])))}
            shot_tpl = fmt.get("remix_shot") if strategy == "remix" and fmt.get("remix_shot") else fmt.get("shot")
            if shot_tpl:
                if len(brief) == 1 and strategy == "frames" and not fmt.get("first_shot"):
                    lines.append(text)
                else:
                    lines.append((fmt.get("first_shot") if i == 1 and fmt.get("first_shot") else shot_tpl).format(**keys))
            elif len(brief) == 1:
                lines.append(text)
            elif strategy == "remix":
                lines.append(T("镜头{i}：{t}", "Shot {i}: {t}", i=i, t=text))
            else:
                lines.append(T("镜头{i}（从 {a:.1f} 秒起）：{t}", "Shot {i} (from {a:.1f}s): {t}", i=i, a=a, t=text))
        sep = T("。", ". ")
        join_str = fmt.get("join") if isinstance(fmt.get("join"), str) else "\n"
        body_lines = join_str.join(ln.rstrip(".") + "." if join_str == " " and not ln.rstrip().endswith((".", "!", "?", '"')) else ln for ln in lines)
        prefix = (sep.join(h.rstrip("。.") for h in head) + sep.rstrip() + (" " if join_str == " " else "\n")) if head else ""
        out = (fmt.get("head") or "") + prefix + body_lines
        tail = _tail_lines(fmt.get("tail"), brief, ambience=ambience)
        if tail:
            out += "\n" + "\n".join(tail)
    tags = {"图片": fmt.get("image_tag"), "视频": fmt.get("video_tag")}
    return REF_TAG.sub(lambda m: tags[m.group(1)].format(n=m.group(2), n0=max(0, int(m.group(2)) - 1)) if tags[m.group(1)] else m.group(0), out)


def _mmss(t: float, ms: bool = False) -> str:
    return f"{int(t // 60):02d}:{t % 60:06.3f}" if ms else f"{int(t // 60):02d}:{int(round(t)) % 60:02d}"


def _inputs(strategy: str, refs: list[dict], seg: list[dict], spec: dict) -> list[dict]:
    own = [r for r in refs if r.get("user")]
    kf = [r for r in refs if r.get("keyframe")]
    vids = [r for r in refs if r["tag"].startswith("@视频")]
    out = [{"kind": "text", "need": "yes", "source": T("见下面的提示词", "see the prompt below"),
            "why": T("按这个模型的写法写最终版（remake/prompts.json）", "final version in this model's format (remake/prompts.json)")}]
    if vids:
        out.append({"kind": "ref_video", "need": "yes", "source": semi().join(f"`{r['tag']}` " + r["what"] for r in vids),
                    "why": T("模型照它出同样的镜头切换、运镜和动作，一次出完这段的镜头", "the model copies its cuts, camera and action and makes the stretch in one go")})
    if own:
        out.append({"kind": "ref_image", "need": "yes", "source": semi().join(f"`{r['tag']}` " + r["what"] for r in own),
                    "why": T("换进去的人、动物、商品，跨镜头一致", "what is swapped in, the same in every shot")})
    if kf:
        out.append({"kind": "ref_image", "need": "yes", "source": T("原片镜头 {s} 的画面（擦掉字幕）", "source frames of shots {s} (subtitles erased)",
                                                                     s="、".join(f"#{r['keyframe']}" for r in kf)),
                    "why": T("每个镜头一帧原片定构图和机位", "one source frame per shot fixes composition and camera")})
    if strategy == "frames":
        r = seg[0]
        out.append({"kind": "first_frame", "need": "yes", "source": T("原片 `{f}`（擦掉字幕；换人、换物时先照着重画）", "source `{f}` (subtitles erased; redraw it first when people or products change)",
                                                                       f=r["assets"]["first_frame"]),
                    "why": T("锁住构图、景别和主体位置", "locks composition, size and subject position")})
        moves = (r.get("features") or {}).get("camera") not in (None, "static", "unknown")
        if spec["last"] and (moves or r["duration"] >= 3):
            out.append({"kind": "last_frame", "need": "opt", "source": T("原片 `{f}`，处理同首帧", "source `{f}`, treated like the first frame", f=r["assets"]["last_frame"]),
                        "why": T("有运镜或动作时给终点，动作和落幅更接近原片", "with a move, pinning the end keeps action and final framing close to the source")})
    return out


def build_unit(seg: list[dict], k: int, strategy: str, spec: dict, own: list[dict], swaps: list[dict], style,
               model: dict | None, fmt: dict | None = None, b: dict | None = None) -> dict:
    t0, t1 = seg[0]["start"], seg[-1]["end"]
    dur = round(sum(r["duration"] for r in seg), 3)
    ranges = _ranges(seg)
    votes: dict[str, float] = {}
    for r in seg:
        votes[r["base"]["label"]] = votes.get(r["base"]["label"], 0.0) + r["duration"]
    label = max(votes.items(), key=lambda kv: kv[1])[0]
    parts = int(-(-dur // spec["max"])) if len(seg) == 1 and dur > spec["max"] + 1e-6 else 1
    refs = [dict(r) for r in own] if strategy != "frames" or not spec["exclusive"] else []
    kept_tags = {r["tag"] for r in refs}
    unit_swaps = [sw if sw.get("tag") in kept_tags else {**sw, "tag": None} for sw in swaps]
    keyframe_tag: dict[int, str] = {}
    if strategy == "remix":
        each = min(REF_CLIP_S, spec["ref_total"])
        for part in range(parts):
            a0 = t0 + dur * part / parts
            pr = [[a0, a0 + dur / parts]] if parts > 1 else ranges
            for c, rr in enumerate(_clips(pr, each), 1):
                refs.append({"tag": f"@视频{c}", "part": part + 1, "ranges": rr,
                             "what": (T("第 {k} 次：", "call {k}: ", k=part + 1) if parts > 1 else "")
                             + T("原片 {s}（擦掉字幕和贴纸）", "source {s} (subtitles and stickers erased)", s=join(f"{a:.1f}–{z:.1f}s" for a, z in rr))})
    elif strategy == "keyframes":
        # image slots left after the user's own: when they run short, the longest shots keep their source frame and the
        # rest get their framing in words (a call kept whole beats a frame for every shot when subjects have no image)
        room = max(0, planned_images(spec) - len(refs))
        framed = {r["index"] for r in sorted(seg, key=lambda r: -r["duration"])[:room]}
        for r in seg:
            if r["index"] not in framed:
                continue
            tag = f"@图片{sum(1 for x in refs if x['tag'].startswith('@图片')) + 1}"
            keyframe_tag[r["index"]] = tag
            refs.append({"tag": tag, "keyframe": r["index"], "t": round(r["start"] + min(0.3, r["duration"] / 2), 3),
                         "what": T("原片镜头 #{i} 的画面（擦掉字幕）：只参考构图、景别和机位", "source shot #{i} (subtitles erased): composition, size and camera only", i=r["index"])})
    can_audio = effective_native_audio(spec, strategy)
    vsrc = (((b or {}).get("sound_sources") or {}).get("voice") or {}).get("source")
    want_dlg = can_audio and (vsrc == "ai_video_native" or bool(((b or {}).get("intent") or {}).get("native_dialogue")))
    ambience = str(((b or {}).get("whole_video_vlm") or {}).get("ambience") or "")
    brief = _brief(seg, keyframe_tag, b=b, want_dialogue=want_dlg, want_sfx=can_audio)
    call_s = call_seconds(spec, dur / parts, refs=bool(refs))
    unit = {"id": f"G{k}", "kind": "generate", "strategy": strategy, "label": label, "label_zh": LABEL_ZH[label],
            "shots": [r["index"] for r in seg], "start": round(t0, 3), "end": round(t1, 3), "duration": dur, "ranges": ranges,
            "mode": "multi_shot" if len(seg) > 1 else ("split" if parts > 1 else "single"), "calls": parts,
            "generate_s": round(dur / parts, 3), "call_s": call_s, "model": (model or {}).get("id"), "model_name": model_name((model or {}).get("name")),
            "refs": refs, "brief": brief, "draft": _draft(strategy, refs, brief, unit_swaps, style, fmt, ambience=ambience), "draft_format": bool(fmt),
            "inputs": _inputs(strategy, refs, seg, spec)}
    unframed = [x["shot"] for x in brief if strategy == "keyframes" and not x.get("composition")]
    missing = [x["shot"] for x in brief if not x["action"]]
    if missing:
        unit["prompt_missing"] = missing
    acting = [{"shot": r["index"], "line": performance.summary(a), "key": a["key"],
               "how": performance.ROUTE_ZH[performance.route_kind(a, r["base"]["label"])]} for r in seg for a in [performance.of(r)] if a]
    if acting:
        unit["acting"] = acting
    if unframed:
        unit["unframed"] = unframed
        unit["note"] = T("参考图名额不够：镜头 {s} 没配原片画面，构图写在提示词里", "not enough image slots: shots {s} have no source frame, their framing is written in the prompt",
                         s=shot_ids(unframed))
    if len(ranges) > 1:
        unit["note"] = (unit.get("note", "") + semi() if unit.get("note") else "") + T("这几镜在成片里被插入画面隔开：连着生成，剪辑时把插入画面放回去",
                         "these shots are separated by inserts in the cut: generate them together and put the inserts back in the edit")
    return unit


# ---------------------------------------------------------------- the whole generation part
def part_starts(b: dict) -> set[int]:
    """Shots where a part of the video begins: a narrative step starts, or a caption card / title changes there."""
    from .narrative import beats

    out = {x["shots"][0] for x in beats(b) if x.get("shots")}
    cues = [c for c in (b.get("packaging") or {}).get("text_cues") or [] if c.get("kind") in ("subtitle", "title", "huazi", "label")]
    for r in b["shots"]:
        if any(abs(c["t0"] - r["start"]) <= 0.5 for c in cues):
            out.add(r["index"])
    return out


def plan_generation(b: dict, model: dict | None, intent: dict, new_scene: set[int], style, skip: set[int],
                    notes: dict | None = None, hardcut_max_s: float = 10.0) -> dict:
    """Generation units and the facts they were planned on. `skip`: shots made another way (motion drive, a clip
    reused from another unit)."""
    spec = spec_of(model)
    labels = ALL_GEN_LABELS if intent.get("generate") == "all" else GEN_LABELS
    own = []
    swaps = []
    for s in intent.get("swaps") or []:
        tag = None
        if s.get("image"):
            tag = f"@图片{len(own) + 1}"
            own.append({"tag": tag, "user": True, "path": s["image"],
                        "what": (s["to"] or T("用户给的参考图", "the user's reference image")) + (T("（替换原片的{f}）", " (replaces the source's {f})", f=s["from"]) if s["from"] else "")})
        if s["from"] or s["to"]:
            swaps.append({"from": s["from"], "to": s["to"], "tag": tag})
    strategy = choose_strategy(spec, len(own))
    cap_hardcut = spec.get("max_hardcut_s") or hardcut_max_s
    if strategy == "remix":
        max_s, max_shots = min(spec["max"], spec["ref_total"]), (spec["shots"] if spec["multi_shot"] else 1)
    elif strategy == "keyframes":
        # a swapped-in subject with no image is held only by its description: every extra call is another chance for it
        # to come out different, so keep calls whole and let some shots go without a source frame; otherwise apply S06 hardcut guard
        text_only = any(not s.get("image") for s in intent.get("swaps") or [])
        max_s = spec["max"] if text_only else min(spec["max"], cap_hardcut)
        max_shots = spec["shots"] if text_only else min(x for x in (spec["shots"], planned_images(spec) - len(own)) if x)
    elif strategy == "text" and spec["multi_shot"]:
        max_s, max_shots = min(spec["max"], cap_hardcut), spec["shots"]
    else:
        max_s, max_shots = spec["max"], 1
    units: list[dict] = []
    new_part = part_starts(b)
    for run in runs(b["shots"], labels, skip, joinable_inserts=strategy in ("remix", "keyframes", "text") and max_shots != 1):
        for seg in pack(run, max_s, max_shots, new_scene, new_part):
            units.append(build_unit(seg, len(units) + 1, strategy, spec, own, swaps, style, model, (notes or {}).get("draft"), b=b))
    return {"strategy": strategy, "spec": spec, "labels": list(labels), "units": units, "own_refs": own,
            "rules": {"max_s": max_s, "max_shots": max_shots, "generate": intent.get("generate", "ai")}}


# ---------------------------------------------------------------- checks
TAG_RES = (r"@图片(\d+)", r"@Image(\d+)", r"@Element(\d+)", r"@Subject(\d+)", r"<Picture (\d+)>",
           r"(?<![@<])图片(\d+)", r"(?<![@<])图(\d+)", r"\[Image (\d+)\]", r"\b[Ii]mage (\d+)\b")
ZERO_TAG_RE = r"<IMAGE_(\d+)>"
VIDEO_TAG_RES = (r"@视频(\d+)", r"@Video(\d+)", r"<Video (\d+)>", r"(?<![@<])视频(\d+)", r"\b[Vv]ideo (\d+)\b")


def lint_prompt(text: str, n_images: int, n_videos: int, notes: dict | None) -> list[str]:
    """The errors of `lint`."""
    return [m for lv, m in lint(text, n_images, n_videos, notes) if lv == "error"]


def lint(text: str, n_images: int, n_videos: int, notes: dict | None) -> list[tuple[str, str]]:
    """What breaks the model's own format, as (level, message): image / video numbers past what is sent, length,
    required and forbidden parts (from the model's `lint` notes in the capability map). A forbid rule may carry
    `when: refs` (only when reference images or videos are sent) and `level: warn` (a risk, not a format error)."""
    rules = (notes or {}).get("lint") or {}
    errs: list = []
    imgs = [int(x) for p in TAG_RES for x in re.findall(p, text)] + [int(x) + 1 for x in re.findall(ZERO_TAG_RE, text)]
    vids = [int(x) for p in VIDEO_TAG_RES for x in re.findall(p, text)]
    if imgs and max(imgs) > n_images:
        errs.append(T("提到了第 {k} 张图，但只传 {n} 张", "refers to image {k} but only {n} are sent", k=max(imgs), n=n_images))
    if vids and max(vids) > n_videos:
        errs.append(T("提到了第 {k} 段视频，但只传 {n} 段", "refers to video {k} but only {n} are sent", k=max(vids), n=n_videos))
    if rules.get("max_cjk") and len(re.findall(r"[\u3400-\u9fff]", text)) > int(rules["max_cjk"]):
        errs.append(T("中文 {n} 字，超过这个模型的 {m} 字", "{n} Chinese characters, over this model's {m}",
                      n=len(re.findall(r"[\u3400-\u9fff]", text)), m=rules["max_cjk"]))
    if rules.get("max_chars") and len(text) > int(rules["max_chars"]):
        errs.append(T("{n} 字符，超过这个模型的 {m}", "{n} characters, over this model's {m}", n=len(text), m=rules["max_chars"]))
    for need in rules.get("require") or []:
        if need not in text:
            errs.append(T("缺少「{x}」", "missing “{x}”", x=need))
    warns = []
    for f in rules.get("forbid") or []:
        if not isinstance(f, dict) or not f.get("re") or (f.get("when") == "refs" and not (n_images or n_videos)):
            continue
        hit = re.search(f["re"], text)
        if hit:
            msg = str(f.get("why") or f["re"]) + T("（「{w}」）", " (“{w}”)", w=hit.group(0))
            (warns if f.get("level") == "warn" else errs).append(msg)
    if rules.get("language") == "en":
        body = re.sub(r"<d>.*?</d>|\"[^\"]*\"", "", text, flags=re.S)  # dialogue and on-screen text keep their own language
        cjk = len(re.findall(r"[㐀-鿿]", body))
        if cjk > 0.05 * max(1, len(body)):
            errs.append(T("这个模型的提示词要用英文（台词和画面文字除外）", "this model's prompts should be in English (dialogue and on-screen text aside)"))
    return [("error", e) for e in errs] + [("warn", w) for w in warns]


SHOT_RES = (r"\[Shot (\d+)\]", r"镜头\s*(\d+)", r"第\s*(\d+)\s*个镜头", r"\bShot (\d+)\b")
WORD_SHOT_RE = re.compile(r"\bSHOT\s+(" + "|".join(_WORD_NUMS) + r")\b")


def shots_written(text: str) -> int:
    """How many shots a prompt numbers (0 when it does not number them)."""
    nums = [int(x) for p in SHOT_RES for x in re.findall(p, text)]
    nums += [_WORD_NUMS.index(w) + 1 for w in WORD_SHOT_RE.findall(text)]
    return max(nums or [0])


def redrawn_frame(out: Path, name: str) -> Path | None:
    """A source frame the user redrew with the swapped-in subject: remake/redrawn/<name>.png|jpg|webp."""
    return next((f for ext in ("png", "jpg", "jpeg", "webp") if (f := Path(out) / REDRAWN_DIR / f"{name}.{ext}").is_file()), None)


def part_frame_name(u: dict, part: int, key: str) -> str:
    """The name of a frames unit's first / last frame; a unit generated in several calls has a pair per call."""
    return f"{u['id']}_{key}" if int(u.get("calls") or 1) <= 1 else f"{u['id']}_p{part}_{key}"


def wants_last_frame(u: dict) -> bool:
    return any(x["kind"] == "last_frame" and x["need"] != "no" for x in u.get("inputs") or [])


def source_frame_names(u: dict) -> list[str]:
    """The frames this unit takes from the source, by the name a redrawn version goes under."""
    names = [f"shot{int(r['keyframe']):03d}" for r in u.get("refs") or [] if r.get("keyframe")]
    if u.get("strategy") == "frames":
        keys = ("first", "last") if wants_last_frame(u) else ("first",)
        names += [part_frame_name(u, part, key) for part in range(1, int(u.get("calls") or 1) + 1) for key in keys]
    return names


def unit_images(u: dict) -> list[dict]:
    """The images one unit sends, in prompt order."""
    return [r for r in u.get("refs") or [] if r["tag"].startswith("@图片")]


def checks(plan: dict, intent: dict, prompts: dict[str, str], notes: dict | None, gen_seconds: float, root: Path | None = None) -> list[dict]:
    """Problems to fix before paying for generation. level "error" blocks `remake-plan`; "warn" is shown."""
    spec, units = plan.get("spec") or {}, plan.get("units") or []
    out: list[dict] = []

    def add(level: str, msg: str, unit: str | None = None) -> None:
        out.append({"level": level, "msg": msg, **({"unit": unit} if unit else {})})

    if intent.get("error"):
        add("error", T("remake/intent.yaml 读不了：{e}", "remake/intent.yaml cannot be read: {e}", e=intent["error"]))
    if intent.get("generate") == "all" and not intent.get("swaps"):
        add("warn", T("整条重做，但意图里没写要换什么（swaps）", "the whole video is remade but the intent lists nothing to swap (swaps)"))
    for s in intent.get("swaps") or []:
        if s.get("image") and not Path(s["image"]).is_file():
            add("error", T("参考图找不到，请重新提供：{p}", "reference image missing, provide it again: {p}", p=Path(s["image"]).name))
    if spec.get("multi_ref") and not spec.get("images_stated"):
        add("warn", T("能力地图没写这个模型最多几张参考图，按 {n} 张排的；查到实际数后补进模型资料", "the capability map has no image limit for this model; planned for {n}, add the real one", n=UNKNOWN_IMAGES))
    if spec.get("exclusive") and plan.get("strategy") == "frames" and any(s.get("image") for s in intent.get("swaps") or []):
        add("warn", T("当前模型在首尾帧模式下不接收额外参考图：先把替换主体画进每段的参考帧（存进 remake/redrawn/，文件名见各单元的提示）再生成",
                      "in first/last-frame mode this model takes no extra reference images: redraw each part's reference frames with the swapped subject first (into remake/redrawn/, named in each unit's warning)"))
    for u in units:
        n_img, n_vid = len(unit_images(u)), len({r["tag"] for r in u["refs"] if r["tag"].startswith("@视频")})
        if spec.get("images") is not None and n_img > max(spec["images"], 0) and (n_img or spec.get("multi_ref")):
            add("error", T("{u} 要传 {n} 张图，超过这个模型的 {m} 张", "{u} sends {n} images, over this model's {m}", u=u["id"], n=n_img, m=spec["images"]), u["id"])
        for part in sorted({r.get("part", 1) for r in u["refs"] if r["tag"].startswith("@视频")}):
            part_vids = [r for r in u["refs"] if r["tag"].startswith("@视频") and r.get("part", 1) == part]
            if len(part_vids) > max(1, int(spec.get("ref_videos") or 1)):
                add("error", T("{u} 单次要传 {n} 段参考视频，超过这个模型的 {m} 段", "{u} sends {n} reference clips in one call, over this model's {m}",
                               u=u["id"], n=len(part_vids), m=spec.get("ref_videos", 1)), u["id"])
            secs = sum(z - a for r in part_vids for a, z in r["ranges"])
            if secs > spec.get("ref_total", 1e9) + 1e-3:
                add("error", T("{u} 参考视频共 {s:.1f} 秒，超过这个模型的 {m:.0f} 秒", "{u} has {s:.1f}s of reference video, over this model's {m:.0f}s",
                               u=u["id"], s=secs, m=spec["ref_total"]), u["id"])
        if u["generate_s"] < SHORT_UNIT_S:
            add("warn", T("{u} 只有 {d:.1f} 秒：单独生成不稳，按模型最短时长生成后剪短，或和相邻镜头合到一起",
                          "{u} is only {d:.1f}s: unstable on its own; generate the model's minimum and trim, or join it with a neighbour", u=u["id"], d=u["generate_s"]), u["id"])
        stale_frames = [x for x in source_frame_names(u) if not (root and redrawn_frame(root, x))] if intent.get("swaps") else []
        if stale_frames:
            add("warn", T("{u} 的参考帧还是原片里被替换的主体，模型会在镜头中途变来变去：先照换入的主体重画，存成 remake/redrawn/{f}.png",
                          "{u}'s reference frames still show the subject being swapped, so the model may morph it mid-shot: redraw them with the new subject as remake/redrawn/{f}.png",
                          u=u["id"], f="|".join(stale_frames)), u["id"])
        if spec.get("no_real_faces"):
            framed_shots = {int(r["keyframe"]) for r in u.get("refs") or [] if r.get("keyframe") and not (root and redrawn_frame(root, f"shot{int(r['keyframe']):03d}"))}
            frames_unredrawn = u.get("strategy") == "frames" and any(not (root and redrawn_frame(root, x)) for x in source_frame_names(u))
            face_shots = [x["shot"] for x in u.get("brief") or []
                          if x.get("real_face") and (n_vid > 0 or frames_unredrawn or x["shot"] in framed_shots)]
            if face_shots:
                m_name = u.get("model_name") or u.get("model") or "?"
                add("warn", T("{u}：{m} 不收带真人脸的参考图或参考视频（镜头 {s} 含实拍/真人画面），请先把参考帧重画成虚拟/授权形象存入 remake/redrawn/，或换其他模型",
                              "{u}: {m} rejects reference images or videos with real human faces (shots {s} show filmed / real people); redraw frames into remake/redrawn/ or pick another model",
                              u=u["id"], m=m_name, s=shot_ids(face_shots)), u["id"])
        final = prompts.get(u["id"])
        if not final:
            m = u.get("model_name") or u.get("model") or "?"
            add("warn", T("{u} 还是工具草稿（已按 {m} 的格式排好）：对照它的写法核对、改好后放进 remake/prompts.json",
                          "{u} still has the tool's draft (already in {m}'s layout): check it against the model's notes and put the final into remake/prompts.json", u=u["id"], m=m)
                if u.get("draft_format") else
                T("{u} 还是通用草稿：按 {m} 的写法写好最终提示词，放进 remake/prompts.json", "{u} still has the generic draft: write the final prompt in {m}'s format into remake/prompts.json", u=u["id"], m=m), u["id"])
        draft_or_final = final or u.get("draft") or ""
        for lv, e in lint(draft_or_final, n_img, n_vid, notes):
            if final or lv == "warn":  # a draft is the tool's own wording: only its risks are worth a line
                add(lv, f"{u['id']}: {e}", u["id"])
            elif not final and ((notes or {}).get("lint") or {}).get("language") == "en" and ("英文" in e or "English" in e):
                add("warn", T("{u} 的草稿里还带有中文（如替换主体或镜头描述），这个模型要求英文提示词：请翻译后写入 remake/prompts.json，或运行 rea-video plan --rewrite-prompts",
                              "{u}'s draft still contains non-English text, while this model expects English prompts: translate it into remake/prompts.json or run rea-video plan --rewrite-prompts", u=u["id"]), u["id"])
        if final:
            n = shots_written(final)
            if n and len(u["shots"]) > 1 and n != len(u["shots"]):  # written for another split of the shots
                add("error", T("{u} 的最终提示词写了 {n} 个镜头，单元里有 {m} 个：按现在的单元重写", "{u}'s final prompt numbers {n} shots but the unit has {m}: rewrite it for the current unit",
                               u=u["id"], n=n, m=len(u["shots"])), u["id"])
    stale = sorted(set(prompts) - {u["id"] for u in units})
    if stale:
        add("warn", T("remake/prompts.json 里的 {s} 已经不在方案里，用不到了", "{s} in remake/prompts.json are not in the plan", s="、".join(stale)))
    calls = sum(u["calls"] for u in units)
    if units and gen_seconds > 0 and calls / (gen_seconds / 60) > CALLS_PER_MIN:
        add("warn", T("{c} 次生成做 {s:.0f} 秒，切得太碎", "{c} calls for {s:.0f}s: cut too finely", c=calls, s=gen_seconds))
    return out


DEFAULT_MODEL = "minimax-h3"  # used until the user names a model or sets a usual one (prefs engine)


REWRITE_TEMPLATE = """You are an expert video-generation prompt engineer.
Rewrite each generation unit's draft prompt into an idiomatic, production-ready final prompt strictly tailored to the target video model: {model_name} ({model_id}).

Target strategy: {strategy}
{strategy_rule}

Target model prompt-writing specification:
{guide}

Hard validation rules your output MUST satisfy:
- Output ONLY a valid JSON object: {{"prompts": {{"G1": "...", ...}}}} with one string per unit id.
- Keep the exact number of shots in each multi-shot unit (if a unit has N shots and the model numbers shots, number 1..N; if the model forbids shot numbering like LTX-2.5, write one continuous paragraph with explicit cut transitions).
- Address uploaded images and videos ONLY up to the exact count sent in each unit, using this model's exact reference syntax.
- If the model requires English prompts, translate all scene, subject, swap and action descriptions into natural English, while keeping spoken dialogue or on-screen text in its original language.
- Respect the model's negative-prompt rule: if the model forbids negative words (no / not / without / 不要), rewrite constraints positively.
- Never describe emotions with abstract labels ("happy", "sad"); keep concrete visible facial expressions, body actions, camera movements and end states.

Generation units to rewrite:
{units_json}
"""


def _unit_rewrite_spec(u: dict, fmt: dict) -> dict:
    raw = fmt or {}
    img_tpl = raw.get("image_tag")
    vid_tpl = raw.get("video_tag")
    if isinstance(img_tpl, dict):
        img_tpl = img_tpl.get(raw.get("lang") or lang()) or next(iter(img_tpl.values()), None)
    if isinstance(vid_tpl, dict):
        vid_tpl = vid_tpl.get(raw.get("lang") or lang()) or next(iter(vid_tpl.values()), None)

    def _tag(tag: str) -> str:
        m = REF_TAG.fullmatch(tag)
        if not m:
            return tag
        tpl = img_tpl if m.group(1) == "图片" else vid_tpl
        return tpl.format(n=m.group(2), n0=max(0, int(m.group(2)) - 1)) if tpl else tag

    imgs = [{"index": i, "tag": _tag(r["tag"]), "what": r["what"]} for i, r in enumerate(unit_images(u), 1)]
    vids = [{"index": i, "tag": _tag(r["tag"]), "what": r["what"]}
            for i, r in enumerate([x for x in u.get("refs") or [] if x["tag"].startswith("@视频") and x.get("part", 1) == 1], 1)]
    return {"id": u["id"], "shots_count": len(u["shots"]), "duration_s": u["duration"], "strategy": u["strategy"],
            "uploaded_images": imgs, "uploaded_videos": vids, "shots": u["brief"], "draft": u["draft"]}


def rewrite_prompts(plan: dict, out: Path, client=None) -> dict[str, str]:
    """Use a configured LLM/VLM client to rewrite every generation unit's prompt into the target model's native style,
    validate against `lint` + shot counts (retrying once with error feedback if needed), and save `remake/prompts.json`."""
    units = plan.get("units") or []
    if not units:
        return {}
    if client is None:
        from .vlm import make_client

        client = make_client(Path(out) / "vlm_cache")
    if client is None:
        raise RuntimeError("no LLM/VLM configured (set GEMINI_API_KEY or REA_VLM_BASE_URL / REA_VLM_API_KEY / REA_VLM_MODEL)")
    notes = plan.get("prompting") or {}
    fmt = notes.get("draft") or {}
    st = plan.get("strategy") or "frames"
    st_rule = {
        "frames": "IMPORTANT (First/Last-Frame I2V mode): The input image ALREADY fixes subject appearance, clothing, background, lighting and framing. Write ONLY the motion progression, end state and camera movement; delete static scene/appearance descriptions.",
        "remix": "IMPORTANT (Reference-video Remix mode): The reference video carries shot cuts, camera movement and pacing. Assign roles to uploaded assets clearly and describe what happens in each shot with the swapped subjects/props.",
        "keyframes": "IMPORTANT (Multi-shot Keyframe Reference mode): Each framed shot gets a source composition image; swapped subjects have their own reference images. State each image's role clearly and write shots in order.",
        "text": "Text-to-video mode: Describe subject, action progression, end state, environment, camera movement and lighting clearly.",
    }.get(st, "")
    guide_keys = ("structure", "language", "length", "multi_shot", "references", "dialogue", "negatives", "camera", "frame_mode", "pitfalls", "lint")
    guide = yaml.safe_dump({k: notes[k] for k in guide_keys if notes.get(k)}, allow_unicode=True, sort_keys=False).strip() or "Follow standard concise video prompting."
    u_specs = [_unit_rewrite_spec(u, fmt) for u in units]
    base_prompt = REWRITE_TEMPLATE.format(
        model_name=plan.get("model_name") or plan.get("model") or "video model",
        model_id=plan.get("model") or "unknown",
        strategy=st, strategy_rule=st_rule, guide=guide,
        units_json=json.dumps(u_specs, ensure_ascii=False, indent=2),
    )
    got = dict(load_prompts(out))
    pending = list(units)
    feedback = ""
    for _attempt in range(2):
        if not pending:
            break
        ask = base_prompt if not feedback else (base_prompt + "\n\nFix these validation errors from your previous attempt:\n" + feedback)
        ans = client.ask_json(ask, media=[], max_tokens=4096)
        raw_map = ans.get("prompts") if isinstance(ans.get("prompts"), dict) else ans
        bad_lines = []
        still_pending = []
        for u in pending:
            uid = u["id"]
            cand = str((raw_map or {}).get(uid) or "").strip()
            if not cand:
                still_pending.append(u)
                bad_lines.append(f"- {uid}: missing from JSON output")
                continue
            n_img = len(unit_images(u))
            n_vid = len({r["tag"] for r in u["refs"] if r["tag"].startswith("@视频") and r.get("part", 1) == 1})
            errs = lint_prompt(cand, n_img, n_vid, notes)
            n_sh = shots_written(cand)
            if n_sh and len(u["shots"]) > 1 and n_sh != len(u["shots"]):
                errs.append(f"numbers {n_sh} shots, but unit {uid} has {len(u['shots'])} shots")
            if errs:
                still_pending.append(u)
                bad_lines.append(f"- {uid}: " + "; ".join(errs))
            else:
                got[uid] = cand
        pending = still_pending
        feedback = "\n".join(bad_lines)
    if pending:
        from .util import LOG

        LOG.warning("rewrite_prompts skipped %d unit(s) that still failed lint: %s", len(pending), feedback)
    if got:
        save_prompts(out, got)
    return got


def check_lines(cs: list[dict]) -> list[str]:
    icon = {"error": "❌", "warn": "⚠️"}
    return [f"- {icon.get(c['level'], '-')} {c['msg']}" for c in cs]


# ---------------------------------------------------------------- report
INPUT_ZH = {"text": ("文字提示词", "text prompt"), "first_frame": ("首帧图", "first frame"), "last_frame": ("尾帧图", "last frame"),
            "ref_image": ("参考图", "reference images"), "ref_video": ("参考视频", "reference video")}
NEED_ZH = {"yes": ("要", "yes"), "opt": ("建议", "worth it"), "no": ("不用", "no")}


def _fed(u: dict) -> str:
    return " + ".join(dict.fromkeys(T(*INPUT_ZH[x["kind"]]) for x in u.get("inputs") or [] if x["need"] != "no" and x["kind"] != "text"))


def report_md(plan: dict, prompts: dict[str, str]) -> list[str]:
    """The generation subsection of the remake part: how it was grouped, then one block per unit."""
    units = plan.get("units") or []
    if not units:
        return []
    rules, spec = plan.get("rules") or {}, plan.get("spec") or {}
    st = plan.get("strategy")
    how = {"remix": T("这段原片擦掉字幕后当参考视频，模型照它的分镜、运镜和节奏出完这段的镜头",
                      "the source stretch, subtitles erased, is the reference video; the model follows its shots, camera and pacing"),
           "keyframes": (T("这个模型也能吃参考视频，这里按它的默认排法：", "the model also takes reference video, but its default plan is used here: ")
                         if spec.get("ref_video") else T("这个模型不吃参考视频，", "the model takes no reference video: "))
                        + T("每个镜头给一张擦掉字幕的原片画面定构图，换进去的东西各给参考图",
                            "one source frame per shot (subtitles erased) fixes composition, swapped-in things get their own images"),
           "frames": T("一次只出一个镜头，从原片首帧（和尾帧）起步", "one shot per call, from the source's first (and last) frame"),
           "text": T("只有文字提示词", "prompt only")}[st]
    notes_md = [T("- 分组：连着的镜头尽量放进同一次生成，单次 ≤{s:.0f} 秒", "- Grouping: consecutive shots share a call where they fit, ≤{s:.0f}s per call", s=rules.get("max_s") or 0)
         + (T("、≤{n} 个镜头", ", ≤{n} shots", n=rules["max_shots"]) if rules.get("max_shots") else "")
         + T("；段太长时优先在换场景处切开", "; a long stretch is cut at a scene change first"),
         T("- 输入：{h}", "- Inputs: {h}", h=how)]
    if plan.get("audio_note"):
        notes_md.append(T("- 声音：{a}", "- Audio: {a}", a=plan["audio_note"]))
    if plan.get("overlay_note"):
        notes_md.append(T("- 包装层：{a}", "- Packaging: {a}", a=plan["overlay_note"]))
    L = [T("| 段 | 镜头 | 时间 | 时长 | 要准备 |", "| Part | Shots | Time | Length | Prepare |"), "|---|---|---|---|---|"]
    for u in units:
        when = join(f"{a:.1f}–{z:.1f}s" for a, z in u["ranges"])
        call = u.get("call_s") or u["generate_s"]
        length = (T("生成 {m:.0f}s，剪到 {d:.1f}s", "generate {m:.0f}s, trim to {d:.1f}s", m=call, d=u["generate_s"])
                  if call - u["generate_s"] >= 0.5 else f"{u['duration']:.1f}s")
        L.append(f"| {u['id']} | {shot_ids(u['shots'])} | {when} | {length}"
                 f"{T('（{c} 次）', ' ({c} calls)', c=u['calls']) if u['calls'] > 1 else ''} | {_fed(u) or '—'} |")
    L += ["", '<details class="ref"><summary>' + T("这样分段的原因", "Why it is split this way") + "</summary>", ""] + notes_md + ["", "</details>"]
    for u in units:
        L += ["", "<details><summary>" + T("{id} · 镜头 {sh} · {d:.1f}s", "{id} · shots {sh} · {d:.1f}s",
                                           id=u["id"], sh=shot_ids(u["shots"]), d=u["duration"]) + "</summary>", "",
              ]
        L += [f"- {T(*INPUT_ZH[x['kind']])}{T('：', ': ')}{x['source']}" for x in u["inputs"] if x["need"] != "no" and x["kind"] != "text"]
        for k in ("note",):
            if u.get(k):
                L += ["", f"- {u[k]}"]
        for a in u.get("acting") or []:
            L.append(T("- 表演 #{s}{k}：{l}（{h}，见「表演与情绪」）", "- Acting #{s}{k}: {l} ({h}, see “Acting and emotion”)",
                       s=a["shot"], k=T("（看点）", " (key)") if a["key"] else "", l=a["line"], h=a["how"]))
        final = prompts.get(u["id"])
        L += ["", T("提示词：", "Prompt:") if final
              else T("提示词草稿（已按 {m} 的格式排好，生成前核对后写进 remake/prompts.json）：", "Draft prompt (in {m}'s layout; check it and put the final into remake/prompts.json before generating):",
                     m=u.get("model_name") or u.get("model")) if u.get("draft_format")
              else T("提示词草稿（通用写法，生成前按 {m} 的写法改写进 remake/prompts.json）：", "Draft prompt (generic; rewrite it in {m}'s format into remake/prompts.json before generating):",
                     m=u.get("model_name") or u.get("model")),
              "", "```text", final or u["draft"], "```", "", "</details>"]
    return L
