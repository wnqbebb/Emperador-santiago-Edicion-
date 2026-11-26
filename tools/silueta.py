#!/usr/bin/env python3
"""Máscara de la persona en cada cuadro (para poner texto DETRÁS de ella): python silueta.py video.mp4 modelo.onnx salida.mp4
Usa el modelo pphumanseg que trae Edit Studio (local, gratis). Salida: video en grises, blanco = persona, bordes suaves."""
import subprocess, sys
import cv2, numpy as np

src, model, out = sys.argv[1:4]
if out.endswith(".png"):                                      # una sola imagen → la persona recortada con transparencia
    im = cv2.imread(src); h, w = im.shape[:2]; net = cv2.dnn.readNetFromONNX(model)
    net.setInput((cv2.dnn.blobFromImage(cv2.resize(im, (192, 192)), 1 / 255.0, (192, 192), (0, 0, 0), swapRB=True) - 0.5) / 0.5)
    m = cv2.GaussianBlur(np.clip((cv2.resize(net.forward()[0, 1], (w, h)) - 0.35) / 0.3, 0, 1), (0, 0), 3)
    cv2.imwrite(out, np.dstack([im, (m * 255).astype(np.uint8)])); print("silueta:", out); sys.exit(0)
cap = cv2.VideoCapture(src)
fps = cap.get(cv2.CAP_PROP_FPS) or 30
w, h = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)), int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
net = cv2.dnn.readNetFromONNX(model)
ff = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "gray", "-s", f"{w}x{h}", "-r", str(fps), "-i", "-",
                       "-c:v", "libx264", "-crf", "18", "-pix_fmt", "yuv420p", out], stdin=subprocess.PIPE)
prev = None
while True:
    ok, fr = cap.read()
    if not ok:
        break
    blob = (cv2.dnn.blobFromImage(cv2.resize(fr, (192, 192)), 1 / 255.0, (192, 192), (0, 0, 0), swapRB=True) - 0.5) / 0.5
    net.setInput(blob)
    m = net.forward()[0, 1]
    m = cv2.resize(m, (w, h))
    m = np.clip((m - 0.35) / 0.3, 0, 1)                      # contraste: bordes firmes pero suaves
    m = cv2.GaussianBlur(m, (0, 0), 3)
    if prev is not None:
        m = 0.6 * m + 0.4 * prev                              # sin parpadeo entre cuadros
    prev = m
    ff.stdin.write((m * 255).astype(np.uint8).tobytes())
ff.stdin.close()
ff.wait()
print("silueta:", out)
