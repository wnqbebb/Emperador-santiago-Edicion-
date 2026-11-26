#!/usr/bin/env python3
"""Whisper siempre cargado: el bridge lo abre una vez y le manda trabajos por la entrada estándar.
Entrada (una línea JSON):  {"wavs": ["a.wav", ...], "modelo": "small", "idioma": "es"}
Salida  (una línea JSON):  [[palabras de a], ...]   ó   {"error": "..."}"""
import json, os, sys, wave
import numpy as np
from faster_whisper import WhisperModel

modelos = {}
def modelo(nombre):
    if nombre not in modelos:
        modelos[nombre] = WhisperModel(nombre, device="cpu", compute_type="int8", cpu_threads=os.cpu_count() or 4)
    return modelos[nombre]

def palabras(m, path, idioma):
    with wave.open(path) as w:
        audio = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float32) / 32768.0
    segs, _ = m.transcribe(audio, language=idioma, word_timestamps=True, vad_filter=False, beam_size=1, best_of=1,
                           condition_on_previous_text=False, initial_prompt="Eh, este, mmm, o sea, bueno.")
    return [{"w": w.word.strip(), "t0": round(w.start, 3), "t1": round(w.end, 3), "p": round(w.probability, 3)} for s in segs for w in (s.words or [])]

modelo(sys.argv[1] if len(sys.argv) > 1 else "small")   # precarga
print(json.dumps({"listo": True}), flush=True)
for linea in sys.stdin:
    try:
        t = json.loads(linea)
        m = modelo(t.get("modelo", "small"))
        print(json.dumps([palabras(m, p, t.get("idioma")) for p in t["wavs"]], ensure_ascii=False), flush=True)
    except Exception as e:  # noqa: BLE001
        print(json.dumps({"error": str(e)}), flush=True)
