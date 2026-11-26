#!/usr/bin/env bash
# Instala o actualiza TODO Emperador Santiago de una vez (se puede repetir sin miedo).
#   bash ~/Emperador-santiago-Edicion-/scripts/instalar.sh
# Deja: dependencias, el comando «emperador» (sirve desde cualquier carpeta), la música,
# los íconos de Windows (Escritorio + menú Inicio) y el sistema encendido.
set -e
cd "$(dirname "$(readlink -f "$0")")/.."
PROY="$(pwd)"
[ -s "$HOME/.nvm/nvm.sh" ] && . "$HOME/.nvm/nvm.sh" >/dev/null 2>&1
paso() { echo; echo "▸ $1"; }

paso "1/6 Bajando la última versión"
git pull --ff-only || { git stash push -u -m "antes de instalar $(date '+%F %T')" && git pull --ff-only; }

paso "2/6 Herramientas del sistema"
command -v node >/dev/null || { echo "✗ Falta Node.js. Instálalo con la guía INSTALAR.md y vuelve a ejecutar esto."; exit 1; }
if ! command -v ffmpeg >/dev/null; then echo "Instalando FFmpeg (te pedirá tu contraseña de Ubuntu)…"; sudo apt-get update -qq && sudo apt-get install -y -qq ffmpeg; fi
echo "✓ Node $(node -v) · FFmpeg listo"

paso "3/6 Dependencias del programa"
npm install --no-audit --no-fund
[ -x tools/.venv/bin/python ] || { echo "Instalando la parte de Python (Whisper, caras…). Tarda unos minutos, solo esta vez."; npm run setup; }

paso "4/6 Comando «emperador» (funciona desde cualquier carpeta)"
mkdir -p "$HOME/.local/bin"
ln -sf "$PROY/scripts/emperador" "$HOME/.local/bin/emperador"
chmod +x scripts/emperador scripts/iniciar.sh scripts/detener.sh scripts/instalar-icono.sh
for rc in "$HOME/.bashrc" "$HOME/.profile"; do grep -q 'HOME/.local/bin' "$rc" 2>/dev/null || echo 'export PATH="$HOME/.local/bin:$PATH"' >> "$rc"; done
export PATH="$HOME/.local/bin:$PATH"
echo "✓ Ya puedes escribir: emperador"

paso "5/6 Música y efectos"
if [ -d sonidos/musica ] && [ -n "$(ls -A sonidos/musica 2>/dev/null)" ]; then echo "✓ Ya estaba descargada"; else bash scripts/descargar-sonidos.sh || echo "⚠ No se pudo bajar la música ahora; luego: bash scripts/descargar-sonidos.sh"; fi

paso "6/6 Íconos de Windows"
if command -v powershell.exe >/dev/null; then bash scripts/instalar-icono.sh; else echo "(no es Windows: me salto los íconos)"; fi

echo
bash scripts/detener.sh >/dev/null 2>&1 || true
"$PROY/scripts/emperador" abrir
echo
echo "════════════════════════════════════════════════════════════"
echo " ✓ Emperador Santiago instalado y encendido."
echo "   Desde ahora: clic en la corona (barra de tareas / Escritorio)."
echo "   Para anclarla: menú Inicio → clic derecho en «Emperador Santiago» → Anclar a la barra de tareas."
echo "   Actualizar en el futuro: ícono «Actualizar Emperador» o escribe: emperador actualizar"
echo "════════════════════════════════════════════════════════════"
