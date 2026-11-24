# Formatos de datos del análisis

Todo vive en `styles/<estilo>/references/vNN/`. Hay ejemplos reales en `plantillas/ejemplo_scenes.json` y `plantillas/ejemplo_edit_logic.json` (Arthur v01 «my life»).

## evidence.json (automático: `style_lab.py preparar`)
Planos detectados (corte ffmpeg), palabras con tiempo (`words: [{w, start, end}]`), paleta por plano y duración. Nivel `observed`/`derived`.

## scenes.json (lo escribe el modelo, `BRIEF_ANALISIS.md`)
Lista de escenas (beats visuales de 1.5–4 s):
```json
{"id": "v01_s01", "start": 0.0, "end": 1.03, "category": "captions_text", "script": "Hi friends,",
 "what": "qué se ve", "design": "fuentes, tamaños, posición, colores hex, formas",
 "effects": "texturas, blur, viñeta, grano…", "animation": "entrada/salida, duración, sensación",
 "why": "por qué aquí respecto al guion", "quality": 5, "best_t": 0.6}
```
Categorías: captions_text · broll_text · imagery_characters · line_text · line_illustration · text_centric · center_illustration · side_illustration · object_element · graph_stats · ui_screen · timeline · split_layout · aroll_plain · title_cta (o una nueva en snake_case, explicada).

## edit_logic.json (lo escribe el modelo, `BRIEF_LOGICA.md`)
`triggers` (palabra → elemento con `offset_s`), `transitions` (tipo y frames), `text_fx`, `camera`, `rhythm`, `typography`, `textures`, `distinct`.

## sfx_events.json (automático: `style_lab.py sonido`)
Separa voz y resto (Demucs) y lista los efectos detectados: `{t, dur, kind: pop|click|hit/boom|whoosh|riser|swell, gain_db, to_cut, word, to_word}` (distancia en segundos al corte y a la palabra más cercanos).

## energy.json / ENERGY_SUMMARY.json (automático: `style_lab.py energia`)
Conteo y tasa por segundo de escenas, disparadores, cortes secos, transiciones, efectos de texto y movimientos de cámara, más tipos de transición.

## ANIMATIONS.json (automático: `style_lab.py biblioteca`)
Una entrada por escena que no es solo subtítulos: `{aid: "V01-A02", scene, category, start, end, dur, script, what, design, effects, animation, why, quality, sheet}`. `sheet` = hoja de 5 keyframes.

## style.json (lo escribe el modelo desde `plantillas/style.json`)
Tokens del render: fuentes, tamaños de subtítulos y modo, paleta y roles, zona segura, texturas, `transitions.allowed` + `min_gap_s`, `sfx` por tipo de escena, `scenes_allowed`, `motion`.

## VIDEO.md (rea-video, opcional)
Desglose por capas de rea-video: cómo se hizo cada toma, subtítulos (SRT/ASS), cortes y beat, audio. Es evidencia de apoyo: se contrasta con las hojas.
