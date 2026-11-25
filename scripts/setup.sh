#!/usr/bin/env bash
# Instalación completa de Emperador Santiago · Edición de Videos.
set -euo pipefail
cd "$(dirname "$0")/.."
command -v ffmpeg >/dev/null || { echo "Falta FFmpeg: instálalo (https://ffmpeg.org/download.html) y vuelve a correr esto."; exit 1; }
echo "1/5 Paquetes de Node…";            npm install
echo "2/5 Navegador de Playwright…";      npx playwright install chromium
# Linux / WSL: Chromium necesita librerías del sistema (libnss3, libnspr4…). Sin ellas no funcionan renders ni pruebas.
if [ "$(uname)" = "Linux" ] && ! ldconfig -p 2>/dev/null | grep -q libnspr4; then
  echo "    → Faltan librerías de sistema para Chromium; se instalan con sudo (te pedirá tu contraseña de Ubuntu)…"
  sudo npx playwright install-deps chromium || echo "    ⚠ No se pudieron instalar. Hazlo a mano: sudo npx playwright install-deps chromium"
fi
echo "3/5 rea-video (Python)…";          bash scripts/setup-rea.sh
echo "4/5 VES · crear-estilo-edicion…";  bash scripts/setup-ves.sh
echo "5/5 Skills para Claude Code…";     bash scripts/instalar-skills.sh
echo "✓ Todo listo. Arranca con: npm run dev"
