#!/usr/bin/env bash
# Instala lo necesario para crear estilos (ejecútalo dentro de system/).
set -e
echo "→ Python (análisis, transcripción, sonido)"
pip install -r requirements.txt demucs yt-dlp gallery-dl
echo "→ rea-video (incluido en el paquete)"
pip install ../tools/rea-video || echo "  ⚠ rea-video no se instaló; el proceso sigue sin él"
echo "→ Render (Remotion)"
(cd render && npm install)
echo "→ Plugin Edit Studio → .claude/skills"
mkdir -p .claude/skills && cp -r ../plugins/edit-studio/skills/* .claude/skills/ 2>/dev/null || true
echo "→ Skills Remotion y HyperFrames"
npx -y skills add remotion-dev/skills -a claude-code -y || true
npx -y skills add heygen-com/hyperframes -a claude-code -y || true
command -v ffmpeg >/dev/null || echo "⚠ Falta ffmpeg (brew install ffmpeg / apt install ffmpeg / winget install ffmpeg)"
echo "✓ Listo. Empieza con: python3 pipeline/style_lab.py nuevo <estilo> --refs <carpeta> --creador \"Nombre\""
