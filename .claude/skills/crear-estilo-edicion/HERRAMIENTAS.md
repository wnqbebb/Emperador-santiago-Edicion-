# Herramientas necesarias

Instalación: dentro de `system/`, `bash instalar.sh`.

| Herramienta | Para qué | Viene |
|---|---|---|
| **rea-video** (`tools/rea-video/`, Apache 2.0) | Desglose toma por toma: cómo se hizo cada toma, subtítulos SRT/ASS, cortes y beat, voz, música (BPM) y efectos; VIDEO.md por capas | Incluido; el instalador lo instala con `pip install tools/rea-video` |
| **`system/reverse/`** | Planos, palabras y paleta (`breakdown.py`), hojas de estudio (`sheets.py`), sonido con Demucs (`audio_sfx.py`), formatos (`classify.py`), biblioteca (`build_library.py`) | Incluido |
| **`system/pipeline/style_lab.py`** | Orquesta las 9 fases y empaqueta la skill del estilo | Incluido |
| **MCP Playwright** | Buscar y descargar en internet (referencias, fuentes, ejemplos de efectos) | `system/.mcp.json` |
| **Remotion** + **HyperFrames** (skills) | Construir las escenas que falten; clonar una animación concreta (`reverse-any-video`) | El instalador las descarga |
| **Edit Studio** (`plugins/edit-studio/`) | Vocabulario de 268 movimientos y 15 géneros para nombrar lo que se ve; medir un efecto de un clip de ejemplo (`measure-ref`) | Incluido |
| Programas | Python 3.10+, Node 18+, ffmpeg, yt-dlp, gallery-dl, Demucs (`pip install demucs`) | El instalador |

Descargar referencias: Instagram/TikTok con `gallery-dl`, YouTube con `yt-dlp` en tu computador (YouTube bloquea servidores en la nube).
