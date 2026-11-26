#!/usr/bin/env bash
# Baja la librería de sonido de Santiago desde Google Drive (no va en git porque pesa):
#   sonidos/musica/<Ánimo>/   → Animada, Clásica, Esenciales, Soft, Triste… (la música de fondo por ánimo)
#   sonidos/generales/         → 220+ efectos y memes para usar a mano
# El kit profesional de efectos por momento (sonidos/kit) ya viene en el repo.
# Uso:  bash scripts/descargar-sonidos.sh
set -e
cd "$(dirname "$0")/.."
PY=tools/.venv/bin/python
[ -x "$PY" ] || PY=python3
"$PY" -m pip install -q gdown >/dev/null 2>&1 || pip3 install -q --user gdown
GD="$PY -m gdown"
mkdir -p sonidos
echo "▸ Música (por ánimo)…"
$GD --folder "https://drive.google.com/drive/folders/1KuTnq7D6UsHPn4sSqYUSXxqYSG54dAYW" -O sonidos/musica --remaining-ok
echo "▸ Efectos generales…"
$GD --folder "https://drive.google.com/drive/folders/1BZIfJnh2god0n8DRW5ybcvUq9Q7jxFdz" -O sonidos/_drive_efectos --remaining-ok
[ -d "sonidos/_drive_efectos/Generales" ] && rm -rf sonidos/generales && mv "sonidos/_drive_efectos/Generales" sonidos/generales
rm -rf sonidos/_drive_efectos
echo "✓ Listo. Ánimos de música:"; ls sonidos/musica
echo "  Puedes añadir tus canciones: crea una carpeta en sonidos/musica/<Ánimo> y mételas ahí; aparecen solas en la app."
