#!/usr/bin/env bash
# Instalación completa de Emperador Santiago · Edición de Videos.
set -euo pipefail
cd "$(dirname "$0")/.."
command -v ffmpeg >/dev/null || { echo "Falta FFmpeg: instálalo (https://ffmpeg.org/download.html) y vuelve a correr esto."; exit 1; }
echo "1/4 Paquetes de Node…";            npm install
echo "2/4 Navegador de Playwright…";      npx playwright install chromium
echo "3/4 rea-video (Python)…";          bash scripts/setup-rea.sh
echo "4/4 Skills para Claude Code…";     bash scripts/instalar-skills.sh
echo "✓ Todo listo. Arranca con: npm run dev"
