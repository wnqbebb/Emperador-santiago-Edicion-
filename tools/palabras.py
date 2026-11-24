#!/usr/bin/env python3
"""Palabras con tiempos (faster-whisper) para la Unión de clips: python palabras.py audio.wav [modelo] [idioma]."""
import json, sys, wave
import numpy as np
from faster_whisper import WhisperModel

with wave.open(sys.argv[1]) as w:  # wav mono 16 kHz que prepara el bridge (sin depender de PyAV)
    audio = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float32) / 32768.0
model = WhisperModel(sys.argv[2] if len(sys.argv) > 2 else "small", device="cpu", compute_type="int8")
lang = sys.argv[3] if len(sys.argv) > 3 else None
segments, _ = model.transcribe(audio, language=lang, word_timestamps=True, vad_filter=False,
                               initial_prompt="Eh, este, mmm, o sea, bueno.")  # ayuda a que transcriba las muletillas
words = [{"w": w.word.strip(), "t0": round(w.start, 3), "t1": round(w.end, 3), "p": round(w.probability, 3)}
         for s in segments for w in (s.words or [])]
print(json.dumps(words, ensure_ascii=False))
