#!/usr/bin/env bash
# rea-video (Apache-2.0) en el entorno de Python del proyecto (tools/.venv).
# Usa la copia que trae la skill crear-estilo-edicion (sin la parte de remake/promoción); si no está, la de GitHub.
set -euo pipefail
cd "$(dirname "$0")/.."
PY=$(command -v python3 || command -v python)
"$PY" -c 'import sys; assert sys.version_info >= (3, 10), "rea-video necesita Python 3.10+"'
[ -d tools/.venv ] || "$PY" -m venv tools/.venv
LOCAL=.claude/skills/crear-estilo-edicion/tools/rea-video
if [ -d "$LOCAL" ]; then tools/.venv/bin/pip install -q "$LOCAL[ocr]"
else tools/.venv/bin/pip install -q "rea-video[ocr] @ git+https://github.com/JuneYaooo/rea-video@fc69e194bdb4da91f72420c58debbc38eee647f5"; fi
tools/.venv/bin/rea-video --help >/dev/null && echo "  ✓ rea-video instalado en tools/.venv"
