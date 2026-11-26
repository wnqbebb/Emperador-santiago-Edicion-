#!/usr/bin/env bash
# Apaga Emperador Santiago (motor + interfaz).
pkill -f "scripts/iniciar.sh" 2>/dev/null
pkill -f "tsx src/server.ts" 2>/dev/null; pkill -f "tsx watch src/server.ts" 2>/dev/null
pkill -f "vite preview" 2>/dev/null; pkill -f "node .*vite" 2>/dev/null; pkill -f "palabras_srv.py" 2>/dev/null
echo "Emperador Santiago apagado"
