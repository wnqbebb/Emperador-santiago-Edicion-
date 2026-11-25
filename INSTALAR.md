# Instalar y trabajar en local · Emperador Santiago

## 1. Lo que necesitas en tu computadora

| Programa | Versión | Cómo se instala |
|---|---|---|
| **Git** | cualquiera reciente | https://git-scm.com |
| **Node.js** | 22 o más | https://nodejs.org (LTS) |
| **Python** | 3.10 a 3.13 | https://python.org (en Windows marca "Add to PATH") |
| **FFmpeg** | 6 o más | Mac: `brew install ffmpeg` · Windows: `winget install ffmpeg` · Linux: `sudo apt install ffmpeg` |

- **Windows:** usa **WSL2 (Ubuntu)** o **Git Bash**, porque los instaladores son scripts `bash`.
- **Espacio:** unos **10 GB** libres. Solo Python, con Whisper y Demucs, ocupa ~6 GB.

## 2. Instalar (una vez)

**Si tienes el paquete `emperador-santiago.bundle`** (te lo da Claude), sácalo así:

```bash
git clone emperador-santiago.bundle emperador-santiago
```

**Si ya está en tu GitHub:**

```bash
git clone https://github.com/wnqbebb/Emperador-santiago-Edicion-.git
```

```bash
cd emperador-santiago
```

```bash
npm run setup
```

`npm run setup` instala todo, en este orden:
1. Paquetes de Node (web, bridge, Remotion, HyperFrames, Playwright…).
2. El navegador de Playwright.
3. rea-video en `tools/.venv` (Python).
4. VES: Whisper, Demucs, rembg, librosa, yt-dlp, gallery-dl, el Remotion de VES y Edit Studio.
5. Las skills para Claude Code.

Tarda **10–20 min** la primera vez. Si algo falla, puedes repetir solo esa parte:

```bash
npm run setup:rea
```

```bash
npm run setup:ves
```

```bash
npm run skills
```

Para usar una clave de API, copia `.env.example` a `.env` y ponla ahí (el sistema lo lee al arrancar).

## 3. Arrancar

```bash
npm run dev
```

Abre **http://localhost:5173**. Arriba tienes las tres herramientas: **Editor**, **Unir clips** y **Crear video**.

## 4. Conectar tu IA (para Crear video, beats y motion graphics)

Elige una:
- **Suscripción de Claude:** instala Claude Code e inicia sesión una vez con `claude`. En la app aparece "Suscripción Claude (Claude Code)".
- **ChatGPT:** Codex CLI (`codex`). **Gemini:** Gemini CLI (`gemini`).
- **Claves de API:** copia `.env.example` a `.env` y pon la clave. Por ejemplo `ANTHROPIC_API_KEY=…` usa Claude Fable 5.2.

Sin IA funcionan: Unir clips, el editor rápido, los efectos, Remotion y HyperFrames.

## 5. Trabajar en local y sincronizar cambios

El código vive en GitHub. **Tú** y **yo** (Claude, en la web) trabajamos sobre el mismo repositorio:

| Quiero… | Comando |
|---|---|
| Traer lo último que hice yo | `git pull` |
| Guardar lo que cambiaste tú | `git add -A` → `git commit -m "qué cambié"` → `git push` |
| Ver qué cambió | `git status` · `git log --oneline` |

- Si los dos tocamos el mismo archivo, `git pull` te avisa del conflicto. Pídele a Claude Code: *"resuelve el conflicto de git"*.
- Tus videos, proyectos y renders **no** se suben a GitHub (carpetas `data/`, `qa/`, `projects/`).
- En local puedes trabajar con **Claude Code** dentro de la carpeta. Ya trae `.mcp.json` y las skills (Emperador, Arthur Brooks, Kallaway, Nick Saraev, Lobo de Wall Street, Skylight, Reels Instagram, crear-estilo-edicion, Remotion, HyperFrames, rea-video, Edit Studio…).

## 6. Las dependencias y qué hace cada una

| Pieza | Versión | Para qué | Primera vez |
|---|---|---|---|
| **HyperFrames** (`hyperframes`) | 0.9.91 | Render HTML+GSAP a MP4: exportar "HyperFrames", motion graphics originales, generador de la pestaña Motion | Descarga su propio Chrome al primer render. Telemetría apagada (`HYPERFRAMES_NO_TELEMETRY=1`) |
| **GSAP** | 3.15.1 | Animaciones dentro de HyperFrames | — |
| **Remotion** | 4.0.547 (editor) · 4.0.242 (VES) | Render final cuadro a cuadro | Descarga "chrome-headless-shell" al primer render. Licencia gratis para personas y equipos de hasta 3 |
| **Playwright** | 1.63 | Pruebas y "horneado" de efectos (pixelfx, corona 3D) a video transparente | `npx playwright install chromium` (lo hace el setup) |
| **three.js** | 0.180 | Corona dorada 3D | — |
| **pixelfx** | incluido en `vendor/` (MIT) | Efectos pixel art | — |
| **Whisper** (`faster-whisper`) | 1.2 | Palabras con tiempos: VES, muletillas, tomas repetidas, .srt | Descarga el modelo "small" (~460 MB) |
| **Whisper en el navegador** (transformers.js) | 4.3 | Transcripción del editor rápido, sin internet después de la 1.ª vez | ~150 MB, queda en caché |
| **Demucs** + **torch** | 4.1 · 2.15 | Separar voz / música / efectos (sonido de VES, laboratorio) | Modelos ~300 MB |
| **rea-video** | 0.1 (copia de crear-estilo-edicion) | Desarmar videos de referencia | Modelos de audio y OCR al primer uso |
| **FFmpeg** | sistema | Todo el corte, unión, audio y compresión | — |

## 7. Qué probar (en este orden)

1. **Unir clips:**
   - Nombra 3 tomas `clip 1`, `clip 2`, `clip 10` y súbelas. Comprueba que se ordenan 1, 2, 10.
   - Pulsa **Analizar cortes**. Revisa la barra de cada clip: rojo = silencio, ámbar = muletilla, violeta = toma repetida. Haz clic en un corte para conservarlo.
   - Pulsa **Renderizar video** y descarga el de redes, el master y el `.srt`.
2. **Crear video:**
   - Sube un clip hablando a cámara (o "Editarlo con una plantilla" desde Unir clips).
   - Responde las preguntas: Arthur Brooks → Talking head, el color recomendado de tu video, energía Viral, texturas Suaves.
   - **Empezar edición** → revisa el **tablero** (A/B/C en mini 9:16) y los **assets** con sus prompts → **Construir el borrador**.
   - Prueba también **Kallaway → Noticia con prueba**: pega 1–2 enlaces en *Fuentes y pruebas*; se capturan de verdad y salen arriba con tu cara abajo.
   - Prueba **Skylight → Premium**: sale directo el video final (cara arriba, subtítulo en dos niveles, mundos en el cielo). Pon los créditos de imágenes en la descripción.
   - Prueba **Nick Saraev** (pega el enlace de la herramienta en Fuentes) y **Lobo de Wall Street** (look estudio o casual); arrancan con los colores de cada estilo.
   - Prueba **Reels Instagram** (cara completa, educativo dividido o cinemático B/N): sale el video final con subtítulos, gráficos y sonido.
   - En el tablero usa **Pedir prompts**: «de lo que sugiere el plan» o escribe lo que quieres y «de lo que pido».
   - Revisa el borrador, el storyboard y la hoja de subtítulos. Si te gusta: **Aprobar** (escribes la frase) → **Render final**.
3. **Editor rápido:** sube un clip → Director IA → *Edición automática (offline)* → prueba Estilos de Santi y Motion (corona 3D, monedas) → Exportar con Navegador, Remotion y HyperFrames.
4. **Laboratorio:** "Crear un estilo nuevo" con 10–20 videos de un creador (fase 1 y 2).

Pruebas automáticas:

```bash
npm test
```

Las lentas (renders completos y flujo con IA):

```bash
RENDER=1 FLUJO=1 npm test
```

## 8. Si algo falla

| Síntoma | Solución |
|---|---|
| "Bridge IA conectado" no aparece | ¿Corre `npm run dev`? El bridge usa el puerto 8787 |
| "rea-video no está instalado" | `npm run setup:rea` |
| Falla Whisper / Demucs | `npm run setup:ves` (revisa que Python sea 3.10–3.13) |
| Remotion/HyperFrames tardan la 1.ª vez | Normal: descargan su navegador |
| La edición se cortó a medias | Botón **Reintentar** (retoma donde iba) |
| Mientras programas, el bridge se reinicia | `npm run dev` reinicia el bridge al guardar cambios en `bridge/`; un trabajo en curso se corta y se retoma con Reintentar |

## 9. Subirlo a la nube

Mira **`NUBE.md`**: necesitas un servidor (VPS) con Ubuntu. Un solo comando lo instala todo, con HTTPS y contraseña.
