---
name: arthur-brooks-style
description: Editar videos cortos (1–3 min, 9:16) en el estilo de Arthur Brooks y en sus 5 formatos (documental biográfico, animación minimal con voz en off, talking head + minimal, clip de podcast, podcast en pantalla dividida). Incluye el rulebook por principio, la biblioteca de 506 escenas reales con hojas de fotogramas clave y el desglose de los 20 videos de referencia. Úsalo para planificar, recomendar escenas, construir y revisar ediciones en este estilo.
---

# Skill: estilo Arthur Brooks

Igual que en el método de las transcripciones: los **videos de referencia** enseñan la lógica (dónde va cada escena respecto al guion) y el **tablero** enseña el diseño. Esta skill contiene las dos cosas.

## Contenido
| Archivo | Qué es |
|---|---|
| `RULEBOOK.md` | Los principios del estilo (captions, b-roll + texto, pinturas, línea + texto, línea + ilustración, solo texto, ilustración central, ilustración lateral, objeto, gráficas, más UI, timeline, pantalla dividida y título/CTA). Cada uno trae ejemplos reales con su diseño, efectos, animación y el porqué |
| `library/<principio>/<id>.jpg` + `.md` | Las **506 escenas** de los 20 videos. Cada una tiene una hoja de 5 fotogramas clave (cómo se anima) y su ficha |
| `VIDEOS.md` → `references/vNN/` | Desglose por video: `breakdown.md`, `scenes.json` (escena por escena), subtítulos `.srt`, `transcript.txt` y hojas `study/` cada 1.5 s |
| `../../styles/arthur-brooks/formats/` | Los 5 formatos, el árbol de decisión y la anatomía de v01 "my life" (la referencia maestra) |
| `../../styles/arthur-*/style.json` | Tokens de cada formato para el render (VES) |
| Tablero | Pizarra de inspiración en claude.ai: tablero completo con 254 escenas top y una sección por principio con su desglose |


## Método Joseph (manda sobre lo anterior) → `JOSEPH_METODO.md`
1. Transcripción al milisegundo, silencios cortados a 30 ms.
2. **Plan por beats** (`pipeline/beats_v123.py` → `projects/<p>/beats.json` → panel): guion + clip a la derecha, 3 diseños A/B/C sacados de `library/ANIMATIONS.json` (339 animaciones con ID `VNN-ANN` y hoja de keyframes), nota «visto en los reels». **Anuncia → cara · describe → se muestra.** El humano elige y pega el plan.
3. Construcción con las escenas `j_*` (render/src/scenes_joseph.tsx): `j_graph` (pr. 10), `j_line` (pr. 4–5, cámara sigue la línea), `j_quote` (pr. 6), `j_illus` (pr. 7–9, recortes con `pipeline/cutout.py`), `j_half` (pr. 8), `j_painting` (pr. 3), `j_broll` (pr. 2). Todo sincronizado a la palabra (`t` absolutos).
4. Captions modo `arthur` (pr. 1): ≤5 palabras por sentido, clave grande centrada, resto al 75 % del ancho arriba/abajo, caja de acento 1 de cada 4 serif.
5. Borrador (60–70 %) → revisiones concretas con tiempo → sonido (música cinematográfica, clic en textos, highlighter en gráficos, whoosh en transiciones) → final.

## Flujo (siempre)
1. `ves.py new <p> --video RAW --style arthur-<formato>` → `ves.py all <p> --lang es` (transcribe, corte con 30 ms de margen, paleta, captions, plan.html).
2. **Recomendar escenas:** para cada línea del guion, busca en `references/*/scenes.json` escenas con un `script` o un `why` parecidos (mismo tipo de momento: anuncia algo nuevo, describe, da un dato, cuenta una historia, cierra). Propón 3–4 con su `id` y la ruta a su hoja en `library/`.
3. **El humano planifica** en `plan.html`. Reglas de oro sacadas de las referencias:
   - Cuando anuncia algo nuevo, su cara (A-roll con caption). Cuando lo describe, lo muestras (b-roll, pintura, ilustración).
   - Una cifra o una progresión va con línea o gráfica. Una persona va con objeto o personaje. Una idea abstracta va con ilustración central. Una cita o un cierre, con una escena solo de texto y comillas.
4. Traduce el plan a `edit_plan.json` → `validate` → `storyboard` (zona segura: todo centrado y cerca de la mitad) → aprobación humana → `render`.
5. **Revisión:** el primer borrador está al 60–70 %. Aplica cada revisión comparando con la hoja de la escena de referencia.
6. `sound`: clicks en los textos, highlighters en las gráficas, whooshes en las transiciones y música cinematográfica con ducking.

## Revisión obligatoria antes del render
Storyboard + hoja de captions (`captionsheet`) + hoja de paletas + 5 muestras de música + paquete de assets `ASSETS_<p>.md` → el humano aprueba → `approve` → `render`. Ver AGENTS.md.

## Reglas visuales globales (de los 20 videos)
- **Captions:** sans (tipo Inter) + serif itálica de alto contraste (tipo Playfair). La palabra clave va grande en el centro y el resto pequeño en los huecos de arriba y abajo. Las frases tienen como máximo 5 palabras y se escriben palabra a palabra.
- **Paleta:** azul `#1B54F8` (de `#0134ED` a `#1369FA`), blanco roto `#FAF7FA` y negro `#040104`. El rojo aparece solo de forma puntual.
- **Texturas:** papel claro o rugoso, tela rugosa en las siluetas, grano. El b-roll lleva bordes oscurecidos y con un poco de blur.
- **Ritmo:** una escena cada ~1.6–2.5 s en animación y documental; en podcast, el ritmo lo marcan los cambios de cámara y los punch-ins.
- **Continuidad:** el texto puede quedarse fijo mientras cambia el b-roll debajo, y entre escenas se reutilizan elementos gráficos (por ejemplo, el punto de la espiral pasa a ser el punto de la "j").
- **Zona segura:** todo el contenido importante va centrado, dentro del rectángulo verde del storyboard.
