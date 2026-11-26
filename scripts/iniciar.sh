#!/usr/bin/env bash
# Arranca Emperador Santiago en modo rápido (sin «npm run dev»): web ya compilada + bridge.
# Lo usa el icono de Windows. Si ya está encendido, no hace nada. Se queda abierto mientras el sistema funciona.
cd "$(dirname "$0")/.."
export PATH="$HOME/.local/bin:$PATH"
[ -s "$HOME/.nvm/nvm.sh" ] && . "$HOME/.nvm/nvm.sh" >/dev/null 2>&1
LOG=data/logs; mkdir -p "$LOG"
encendido() { curl -fs -o /dev/null http://localhost:8787/api/health && curl -fs -o /dev/null http://localhost:4173/; }
if encendido; then echo "Ya estaba encendido"; exit 0; fi
# compilar la web solo si cambió algo desde la última vez (después de un git pull)
if [ ! -f web/dist/index.html ] || [ -n "$(find web/src web/public web/index.html -newer web/dist/index.html -print -quit 2>/dev/null)" ]; then
  echo "Preparando la interfaz (solo la primera vez o tras actualizar)…"
  npm run build -w web > "$LOG/build.log" 2>&1 || { echo "Falló la compilación: mira $LOG/build.log"; }
fi
npm run start -w bridge > "$LOG/bridge.log" 2>&1 &
B=$!
npx -w web vite preview --port 4173 --strictPort > "$LOG/web.log" 2>&1 &
W=$!
trap 'kill $B $W 2>/dev/null' EXIT INT TERM
for i in $(seq 1 120); do encendido && { echo "✓ Emperador Santiago listo en http://localhost:4173"; break; }; sleep 0.5; done
wait $B $W
