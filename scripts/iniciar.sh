#!/usr/bin/env bash
# Enciende Emperador Santiago en modo rápido (interfaz ya compilada en :4173 + motor en :8787).
# Lo usa el ícono de Windows y el comando «emperador». Si ya está encendido, no hace nada.
# El motor se vigila: si se cae, se vuelve a encender solo. Registros en data/logs/.
cd "$(dirname "$(readlink -f "$0")")/.."
export PATH="$HOME/.local/bin:$PATH"
[ -s "$HOME/.nvm/nvm.sh" ] && . "$HOME/.nvm/nvm.sh" >/dev/null 2>&1
LOG=data/logs; mkdir -p "$LOG"
motor() { curl -fs -o /dev/null --max-time 3 http://localhost:8787/api/health; }
web() { curl -fs -o /dev/null --max-time 3 http://localhost:4173/; }
if motor && web; then echo "Ya estaba encendido"; exit 0; fi
command -v node >/dev/null || { echo "✗ No encuentro Node.js. Instálalo (ver INSTALAR.md)."; exit 1; }
[ -d node_modules ] || { echo "Instalando dependencias (solo la primera vez)…"; npm install > "$LOG/install.log" 2>&1; }

# compilar la interfaz solo si cambió algo desde la última vez (después de un git pull)
if [ ! -f web/dist/index.html ] || [ -n "$(find web/src web/public web/index.html -newer web/dist/index.html -print -quit 2>/dev/null)" ]; then
  echo "Preparando la interfaz (solo la primera vez o tras actualizar)…"
  npm run build -w web > "$LOG/build.log" 2>&1 || echo "⚠ Falló la compilación: mira $LOG/build.log"
fi

PIDS=()
if ! motor; then
  ( while true; do
      echo "--- $(date '+%F %T') encendiendo el motor" >> "$LOG/bridge.log"
      npm run start -w bridge >> "$LOG/bridge.log" 2>&1
      echo "--- $(date '+%F %T') el motor se detuvo; reintento en 3 s" >> "$LOG/bridge.log"
      sleep 3
    done ) &
  PIDS+=($!)
fi
if ! web; then
  npx -w web vite preview --port 4173 --strictPort > "$LOG/web.log" 2>&1 &
  PIDS+=($!)
fi
trap 'kill ${PIDS[*]} 2>/dev/null; pkill -P $$ 2>/dev/null' EXIT INT TERM
for i in $(seq 1 180); do motor && web && { echo "✓ Emperador Santiago listo en http://localhost:4173"; break; }; sleep 0.5; done
motor || { echo "⚠ El motor no respondió. Últimas líneas de $LOG/bridge.log:"; tail -15 "$LOG/bridge.log"; }
wait
