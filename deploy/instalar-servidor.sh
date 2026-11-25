#!/usr/bin/env bash
# Instala Emperador Santiago en un servidor Ubuntu 24.04 (VPS), con HTTPS y contraseña.
# Uso (como root):  DOMINIO=editor.tudominio.com USUARIO=santi CLAVE='tu-clave' REPO=https://github.com/wnqbebb/Emperador-santiago-Edicion-.git bash instalar-servidor.sh
set -euo pipefail
: "${DOMINIO:?Falta DOMINIO (ej. editor.tudominio.com)}"
: "${USUARIO:?Falta USUARIO para entrar}"
: "${CLAVE:?Falta CLAVE para entrar}"
: "${REPO:?Falta REPO (la URL de tu repositorio de GitHub)}"
DIR=/opt/emperador-santiago

echo "1/7 Paquetes del sistema (FFmpeg, Python, Git, Caddy)…"
apt-get update -y
apt-get install -y git ffmpeg python3 python3-venv python3-pip curl ca-certificates gnupg debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf https://dl.cloudsmith.io/public/caddy/stable/gpg.key | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt > /etc/apt/sources.list.d/caddy-stable.list
apt-get update -y && apt-get install -y caddy

echo "2/7 Node.js 22…"
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt-get install -y nodejs

echo "3/7 Usuario y código…"
id emperador >/dev/null 2>&1 || useradd -m -s /bin/bash emperador
[ -d "$DIR/.git" ] || git clone "$REPO" "$DIR"
chown -R emperador:emperador "$DIR"

echo "4/7 Instalar todo (10–20 min la primera vez)…"
sudo -u emperador bash -c "cd $DIR && npm run setup"
npx --yes playwright install-deps chromium

echo "5/7 Construir la interfaz para la nube…"
sudo -u emperador bash -c "cd $DIR && npm run build:nube"

echo "6/7 Configuración (.env)…"
ENVF="$DIR/.env"
[ -f "$ENVF" ] || sudo -u emperador cp "$DIR/.env.example" "$ENVF"
grep -q '^SANTI_HOST=' "$ENVF" || echo "SANTI_HOST=127.0.0.1" >> "$ENVF"
grep -q '^SANTI_WEB_ORIGIN=' "$ENVF" || echo "SANTI_WEB_ORIGIN=https://$DOMINIO" >> "$ENVF"
cp "$DIR/deploy/emperador.service" /etc/systemd/system/emperador.service
systemctl daemon-reload && systemctl enable --now emperador

echo "7/7 HTTPS y contraseña (Caddy)…"
HASH=$(caddy hash-password --plaintext "$CLAVE")
cp "$DIR/deploy/Caddyfile" /etc/caddy/Caddyfile
mkdir -p /etc/systemd/system/caddy.service.d
printf '[Service]\nEnvironment="DOMINIO=%s" "USUARIO=%s" "CLAVE_HASH=%s"\n' "$DOMINIO" "$USUARIO" "$HASH" > /etc/systemd/system/caddy.service.d/emperador.conf
usermod -aG emperador caddy
systemctl daemon-reload && systemctl restart caddy

echo
echo "✓ Listo: https://$DOMINIO  (usuario: $USUARIO)"
echo "  Conecta tu IA: entra como 'emperador' y ejecuta 'claude' una vez, o pon ANTHROPIC_API_KEY en $ENVF y reinicia: systemctl restart emperador"
