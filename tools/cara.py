#!/usr/bin/env python3
"""Dónde está la cara en un video vertical (mediana de 9 cuadros, YuNet): python cara.py video.mp4 modelo.onnx → {x, y, h} en fracción."""
import json, statistics, sys
import cv2

cap = cv2.VideoCapture(sys.argv[1])
n = int(cap.get(cv2.CAP_PROP_FRAME_COUNT)) or 1
det = cv2.FaceDetectorYN.create(sys.argv[2], "", (540, 960), 0.6, 0.3, 50)
xs, ys, hs = [], [], []
for k in range(9):
    cap.set(cv2.CAP_PROP_POS_FRAMES, int(n * (k + 0.5) / 9))
    ok, fr = cap.read()
    if not ok:
        continue
    fr = cv2.resize(fr, (540, 960))
    _, f = det.detect(fr)
    if f is not None and len(f):
        x, y, w, h = max(f, key=lambda r: r[2] * r[3])[:4]
        xs.append(float(x + w / 2) / 540); ys.append(float(y + h / 2) / 960); hs.append(float(h) / 960)
print(json.dumps({"x": statistics.median(xs) if xs else 0.5, "y": statistics.median(ys) if ys else 0.36, "h": statistics.median(hs) if hs else 0.3}))
