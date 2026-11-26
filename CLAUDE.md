# Emperador Santiago · Edición de Videos

## Cómo trabaja Santiago (modo chat)
Santiago sube su video **tal cual** al chat (crudo, uno o varios clips, cualquier formato: mp4, mov, webm)
y espera recibir el video **terminado para Instagram**: 9:16, bien cortado, con corrección de color,
voz limpia y volumen de redes. No le pidas que haga pasos técnicos: hazlo tú y entrégalo.

1. Copia los archivos subidos a una carpeta nueva del scratchpad (los adjuntos están en `/root/.claude/uploads/...`).
2. Unir y recortar (silencios, muletillas, tomas repetidas) + color + voz + 9:16:
   ```bash
   npm run unir -- "<clip1>" "<clip2>" … --instagram --salida "<carpeta de entrega>"
   ```
   Varios clips: se unen en el orden de sus nombres (clip 1, clip 2 … clip 10). Una carpeta también vale.
   Opciones: `--look cine|dorado|moody|vibrante|bn|…` (por defecto «pro», corrección natural), `--ritmo natural|agresivo`, `--velocidad 1.1`.
3. Revisa el resultado (duración antes/después, una hoja de cuadros con ffmpeg) y entrégalo con SendUserFile:
   `<nombre>_instagram.mp4` (para subir) y, si lo pide, el master y el `.srt`.
4. Si pide un estilo (Reels, Kallaway, Nick, Lobo, Arthur, Skylight), subtítulos con preset o música: usa el flujo
   de Crear video del bridge (`.claude/skills/emperador-santiago/SKILL.md`).

Reglas: nunca agrandar videos pequeños (el motor ya lo respeta) · siempre MP4 H.264 + AAC · avisar si la fuente es de
baja resolución (menos de 1080 de ancho se ve borroso en Instagram) · los archivos de la sesión se borran al cerrarla:
entrega siempre los videos por el chat.

## Si la sesión es nueva
`npm install` y, si falta `tools/.venv`, `npm run setup` (Whisper, caras, silueta). FFmpeg debe estar instalado.

## Más
- Guía de instalación local: `INSTALAR.md` · todo el sistema: `.claude/skills/emperador-santiago/SKILL.md`
- Repositorio: push con `git push origin master:main`
