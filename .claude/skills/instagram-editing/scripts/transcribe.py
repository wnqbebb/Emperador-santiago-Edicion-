#!/usr/bin/env python3
"""Transcribe a clip offline with word-level timestamps (faster-whisper). macOS and Windows.

Writes JSON: {"language": ..., "duration": ..., "words": [{"w": "hello", "start": 1.23, "end": 1.51, "p": 0.98}, ...],
              "segments": [{"start": .., "end": .., "text": ..}, ...]}
The first run downloads the speech model once (a few hundred MB) to the user's cache folder.

Usage:  python transcribe.py <video-or-audio> <out.json> [--model small.en|medium.en|small|medium] [--language en]
Tips:   English only -> small.en (fast) or medium.en (more accurate). Other languages -> small or medium + --language.
"""
import argparse
import json
import sys


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("media")
    ap.add_argument("out")
    ap.add_argument("--model", default="medium.en")
    ap.add_argument("--language", default=None)
    a = ap.parse_args()
    try:
        from faster_whisper import WhisperModel
    except ImportError:
        sys.exit("faster-whisper is not installed. Run: pip install faster-whisper")

    model = WhisperModel(a.model, device="auto", compute_type="auto")
    lang = a.language or ("en" if a.model.endswith(".en") else None)
    segments, info = model.transcribe(a.media, language=lang, word_timestamps=True, vad_filter=False,
                                      condition_on_previous_text=False)   # keeps repeated retakes instead of smoothing them away
    words, segs = [], []
    for s in segments:
        segs.append({"start": round(s.start, 3), "end": round(s.end, 3), "text": s.text.strip()})
        for w in s.words or []:
            words.append({"w": w.word.strip(), "start": round(w.start, 3), "end": round(w.end, 3), "p": round(w.probability, 3)})
    json.dump({"language": info.language, "duration": round(info.duration, 3), "words": words, "segments": segs},
              open(a.out, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(f"{len(words)} words, {len(segs)} segments, language {info.language} -> {a.out}")


if __name__ == "__main__":
    main()
