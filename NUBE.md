# Subir Emperador Santiago a la nube

La app hace trabajo pesado: transcribe con Whisper, separa audio con Demucs y renderiza con Remotion y HyperFrames. Por eso necesita un **servidor propio (VPS)**. Vercel, Netlify y servicios parecidos no sirven.

## 1. Lo que necesitas

| Qué | Recomendado |
|---|---|
| Servidor | Ubuntu 24.04 con **4 vCPU, 8 GB de RAM y 80 GB de disco** (Hetzner CPX31, DigitalOcean 8 GB, Contabo…) |
| Dominio | Un subdominio apuntando a la IP del servidor, por ejemplo `editor.tudominio.com` (registro **A**) |
| Código | Tu repositorio privado de GitHub con este proyecto |

## 2. Instalar (una sola vez)

Entra al servidor:

```bash
ssh root@IP_DEL_SERVIDOR
```

Baja el instalador. Cambia `TU_USUARIO` por tu usuario de GitHub. Como el repositorio es privado, GitHub te pedirá un token (Settings → Developer settings → Personal access tokens).

```bash
git clone https://github.com/TU_USUARIO/emperador-santiago.git /opt/emperador-santiago
```

Instala todo. Cambia el dominio, el usuario y la clave por los tuyos:

```bash
DOMINIO=editor.tudominio.com USUARIO=santi CLAVE='una-clave-larga' REPO=https://github.com/TU_USUARIO/emperador-santiago.git bash /opt/emperador-santiago/deploy/instalar-servidor.sh
```

Tarda unos 20 minutos. Al final abre **https://editor.tudominio.com**. Te pedirá el usuario y la clave que elegiste.

## 3. Conectar tu IA en el servidor

Elige **una** de estas dos opciones.

**Tu suscripción de Claude.** Instala Claude Code para el usuario del servicio:

```bash
sudo -u emperador -i bash -c 'curl -fsSL https://claude.ai/install.sh | bash'
```

Después inicia sesión una vez. Abre un enlace que copias en tu navegador:

```bash
sudo -u emperador -i claude
```

**Una clave de API.** Edita el archivo de configuración y pon `ANTHROPIC_API_KEY=…`:

```bash
nano /opt/emperador-santiago/.env
```

Haya sido cualquiera de las dos, reinicia el servicio:

```bash
systemctl restart emperador
```

## 4. Actualizar cuando yo cambie algo

```bash
cd /opt/emperador-santiago && sudo -u emperador git pull && sudo -u emperador npm install && sudo -u emperador npm run build:nube && systemctl restart emperador
```

## 5. Cómo queda montado (seguridad)

- **Caddy** da HTTPS automático y pide usuario y clave antes de mostrar nada.
- Sirve la interfaz y pasa a la API solo las rutas del bridge.
- El **bridge** escucha solo en `127.0.0.1` (`SANTI_HOST`) y acepta peticiones solo desde tu dominio (`SANTI_WEB_ORIGIN`). Nadie puede usarlo directamente desde internet.
- Aprobar y el render final siguen necesitando la frase que escribes tú.
- Tus videos y proyectos quedan en el servidor, dentro de `/opt/emperador-santiago/data` y de las carpetas `projects/` de cada skill.

## 6. Si algo falla

| Síntoma | Qué hacer |
|---|---|
| La página no carga | Revisa que el dominio apunte a la IP del servidor, y mira `systemctl status caddy` |
| Sale «Bridge desconectado» | Mira el registro con `journalctl -u emperador -n 50` |
| Falla un render | Mira `free -h`: puede faltar RAM. Sube el servidor a 8 GB o más |
| «Origen no permitido» | En `.env`, `SANTI_WEB_ORIGIN` debe ser exactamente `https://tu-dominio`. Luego `systemctl restart emperador` |
