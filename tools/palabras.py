#!/usr/bin/env python3
"""Palabras con tiempos (faster-whisper) para la Unión de clips.
  python palabras.py audio.wav [modelo] [idioma]            → [palabras]
  python palabras.py a.wav b.wav c.wav --modelo small --idioma es  → [[palabras de a], [de b], …]  (el modelo se carga UNA vez)"""
import json, os, sys, wave
import numpy as np
from faster_whisper import WhisperModel

args = sys.argv[1:]
wavs = [a for a in args if a.endswith(".wav")]
rest = [a for a in args if not a.endswith(".wav")]
opt = {rest[i][2:]: rest[i + 1] for i in range(len(rest) - 1) if rest[i].startswith("--")}
pos = [a for i, a in enumerate(rest) if not a.startswith("--") and not (i > 0 and rest[i - 1].startswith("--"))]
modelo = opt.get("modelo", pos[0] if pos else "small")
idioma = opt.get("idioma", pos[1] if len(pos) > 1 else None)
model = WhisperModel(modelo, device="cpu", compute_type="int8", cpu_threads=os.cpu_count() or 4)


def palabras(path):
    with wave.open(path) as w:  # wav mono 16 kHz que prepara el bridge (sin depender de PyAV)
        audio = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float32) / 32768.0
    segments, _ = model.transcribe(audio, language=idioma, word_timestamps=True, vad_filter=False, beam_size=1, best_of=1,
                                   condition_on_previous_text=False,
                                   initial_prompt="Eh, este, mmm, o sea, bueno.")  # ayuda a que transcriba las muletillas
    return [{"w": w.word.strip(), "t0": round(w.start, 3), "t1": round(w.end, 3), "p": round(w.probability, 3)}
            for s in segments for w in (s.words or [])]


res = [palabras(p) for p in wavs]
print(json.dumps(res[0] if len(wavs) == 1 and "--modelo" not in args else res, ensure_ascii=False))
