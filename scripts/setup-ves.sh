#!/usr/bin/env bash
# Instala VES + la skill crear-estilo-edicion (incluida en .claude/skills/crear-estilo-edicion).
set -euo pipefail
cd "$(dirname "$0")/.."
SKILL=.claude/skills/crear-estilo-edicion
VES=$SKILL/system
[ -d tools/.venv ] || bash scripts/setup-rea.sh
echo "  → Python de VES (Whisper, Demucs, rembg, librosa, yt-dlp, gallery-dl)…"
tools/.venv/bin/pip install -q -r "$VES/requirements.txt" demucs yt-dlp gallery-dl
echo "  → Render de VES (Remotion propio)…"
(cd "$VES/render" && npm install --no-audit --no-fund >/dev/null)
echo "  → Plugin Edit Studio (movimientos, géneros, voz) → .claude/skills"
for s in edit-director edit-voice; do rm -rf ".claude/skills/$s"; cp -R "$SKILL/plugins/edit-studio/skills/$s" ".claude/skills/$s"; done
# edit-gen no se instala: la regla 2 del método prohíbe generar con IA de pago.
echo "  ✓ VES listo. Pestaña Laboratorio en el editor, o: tools/.venv/bin/python $VES/pipeline/ves.py --help"
