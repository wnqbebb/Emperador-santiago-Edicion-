# Brief 1: análisis escena por escena de un video de referencia (estilo «{ESTILO}»)

Eres un editor de video senior haciendo ingeniería inversa. Para CADA video asignado, en
`{ROOT}/styles/{ESTILO}/references/vNN/`:

Material (léelo con la herramienta Read; las imágenes se ven):
- `study/timeline_XX.jpg` — un fotograma cada 1.5 s con el tiempo impreso (8x3 por hoja). ES LA FUENTE PRINCIPAL.
- `study/shots_XX.jpg` + `study/shots.txt` — planos detectados por corte (id, inicio-fin, lo que se dice).
- `transcript.txt`, `vNN.srt` — lo que se dice (palabra a palabra con tiempos en evidence.json → "words").
- `../../formats/labels.json` — formato del video si ya lo etiquetó el humano (si dice "?", propón uno y justifícalo).
- `rea/VIDEO.md` (si existe) — desglose de rea-video: cómo se hizo cada toma, subtítulos, cortes, audio. Úsalo como evidencia, no como verdad: compara con las hojas.

Divide el video en ESCENAS (beats visuales: cambia el diseño/la composición, no solo la cámara). Típicamente 1 escena cada 1.5–4 s.
Para cada escena clasifica `category` en UNA de:
  captions_text (texto en pantalla sobre A-roll) · broll_text · imagery_characters (pinturas/fotos/personajes + texto) ·
  line_text · line_illustration · text_centric (solo texto / citas con comillas) · center_illustration ·
  side_illustration · object_element · graph_stats · ui_screen (interfaz/redes) · timeline · split_layout ·
  aroll_plain (A-roll sin texto destacado) · title_cta (título de inicio / cierre / CTA)
Si el estilo tiene un tipo de escena que no encaja en ninguna, crea una categoría nueva en snake_case y explícala en breakdown.md.

Escribe `scenes.json` (lista JSON, español) con, por escena:
{
 "id": "vNN_s01", "start": 0.0, "end": 2.4, "category": "...",
 "script": "lo que se dice en ese tramo",
 "what": "qué se ve, concreto",
 "design": "fuentes (sans vs serif itálica, peso, mayúsculas), tamaños relativos, posición en pantalla (tercios, centro), colores (hex aproximado si se puede), forma/bordes",
 "effects": "texturas (papel, tela, halftone, grano), blur, viñeta, desaturación, glow, scanlines…",
 "animation": "cómo entra/sale y se mueve: pop+blur+fade, write-on por palabra, slide de cámara, línea que se dibuja, zoom, duración estimada en segundos y sensación (suave/seca)",
 "why": "por qué el editor usó esta escena AQUÍ respecto al guion (psicología: anunciar vs describir, emoción, dato, transición, hook)",
 "quality": 1-5 (5 = escena de inspiración top que copiarías),
 "best_t": segundo exacto del fotograma más representativo (de las hojas)
}
Y `breakdown.md` (español, ≤ 60 líneas): formato, estructura del guion (hook → … → cierre), ritmo (seg/escena),
sistema de captions (fuentes, posición, palabra destacada), paleta, texturas, 5–8 técnicas destacables con tiempos,
y "reglas copiables" en viñetas.

Sé literal con lo que ves: no inventes fuentes si no puedes saberlo ("serif itálica tipo Playfair" está bien).
Escribe los archivos con la herramienta Write. No modifiques nada más. Al terminar devuelve solo: por video, nº de escenas,
conteo por categoría y nº de escenas con quality ≥ 4.


---

# Brief 2: LÓGICA DE EDICIÓN de cada video (segundo pase, más fino)

Ya existe para cada video `references/vNN/`: scenes.json (escenas), evidence.json (palabras con tiempos en "words"),
study/timeline_XX.jpg (1 fotograma cada 1.5 s), breakdown.md. El video está en {ROOT}/{REFS}/vNN.mp4.
Ahora necesitamos lo que el primer pase NO capturó. Usa Bash + ffmpeg para mirar de cerca, por ejemplo cada transición:
  ffmpeg -v error -ss <t-0.3> -t 0.7 -i {REFS}/vNN.mp4 -vf "fps=15,scale=160:-1,drawtext=text='%{pts\:hms}':fontsize=12:fontcolor=yellow:x=2:y=2,tile=11x1" -frames:v 1 /tmp/tr_vNN_<t>.jpg
y léelo con Read (ves las imágenes). Mira TODAS las transiciones/cambios de escena y los momentos donde aparece texto o un gráfico.

Escribe `references/vNN/edit_logic.json` con:
{
 "triggers": [ {"t_word": 3.42, "word": "palabra exacta que dispara", "element": "qué aparece (texto/ícono/foto/gráfico/zoom/cambio de color)", "category": "(de scenes.json)", "offset_s": -0.1, "why": "relación palabra→imagen (literal / metáfora / dato / énfasis / cambio de tema)"} ],
 "transitions": [ {"t": 12.3, "from": "aroll|escena X", "to": "...", "type": "corte seco | flash blanco | flash amarillo | inversión de color | zoom-blur | whip-pan | wipe | crossfade | match-cut (elemento compartido) | glitch | slide", "frames": 3, "detail": "..."} ],
 "text_fx": [ {"t": 5.1, "fx": "write-on por palabra | gris→blanco | blur-in | pop | escala | máscara | tracking", "detail": "..."} ],
 "camera": [ {"t": 8.0, "move": "punch-in | zoom-out | pan | slide | push-in lento | shake | rack-focus", "scale_or_dir": "1.0→1.3", "dur_s": 0.0} ],
 "rhythm": {"events_per_10s": [..], "avg_hold_text_s": 0.0, "notes": "..."},
 "typography": "fuentes observadas, pesos, itálica, tamaños relativos, mayúsculas, color de la palabra clave, cuántas palabras por bloque",
 "textures": "papel / tela / pintura / grano / halftone / viñeta, intensidad y dónde",
 "distinct": ["5 cosas que hacen ÚNICO este video frente a los demás del creador (para no editar todos igual)"]
}
y `references/vNN/edit_logic.md` (≤ 50 líneas, español): las 10 reglas copiables más importantes de ESTE video con tiempos de ejemplo.
Sé literal y preciso con tiempos (±0.1 s). No modifiques otros archivos. Devuelve solo: por video nº de triggers, transiciones (por tipo) y las 3 rarezas más útiles.


Regla de evidencia (REA): cada afirmación es `observed` (la ves en un fotograma con su tiempo), `derived` (calculada) o `inferred` (interpretación). Lo que no puedas ver, escríbelo como desconocido; no lo inventes.


---

# Lógica de edición · estilo {CREADOR}

<!-- PLANTILLA. Se escribe agregando los edit_logic.json de los N videos + ENERGY_SUMMARY.json + sfx_events.json. -->

## 1. Sincronía palabra → elemento
- Mediana de `offset_s`: «…» s (imágenes «…» s antes; texto «…»). Evidencia: «vNN t…».
- ¿El corte cae en la palabra funcional que abre la frase? «sí/no + ejemplos».
- ¿Los subtítulos cruzan el corte? «…»

## 2. Qué elemento según lo que se dice
| Lo que se dice | Elemento | Ejemplos (VNN-ANN) |
|---|---|---|

## 3. Transiciones firma por formato
| Formato | Transiciones (además del corte seco, que es el «…» %) | Cámara |
|---|---|---|

## 4. Ritmo (de ENERGY_SUMMARY.json)
Escenas/s «…» · transiciones/s «…» · texto/s «…» · movimientos de cámara/s «…».

## 5. Tipografía
«voces tipográficas, pesos, mayúsculas, cuántas palabras por bloque, color de la palabra clave»

## 6. Texturas y color
«…»

## 7. Sonido (de sfx_events.json)
Efectos por minuto «…» · tipos «…» · música «…» dB bajo la voz.


---

# Formatos del estilo {CREADOR}

<!-- PLANTILLA. Arthur tiene 5 (documental, animación con voz en off, talking head + minimal, clip de podcast, pantalla dividida).
     Agrupa los videos por cómo están hechos (labels.json + classification.json) y describe cada formato. -->

| Formato | Videos | Cómo reconocerlo (señales) | Estructura típica | Transiciones firma | Ritmo |
|---|---|---|---|---|---|
| «…» | v01, v04 | «cara %, fondos planos %, cortes/min» | «hook → … → cierre» | «…» | «…» |

## Árbol de decisión
1. ¿«señal»? → «formato»
2. …

## Referencia maestra
«el video más completo del creador, como fue v01 "my life" para Arthur, con su anatomía segundo a segundo»


---

# Rulebook · estilo {CREADOR}

<!-- PLANTILLA. Un apartado por PRINCIPIO (Arthur tiene 10: captions, b-roll+texto, pinturas, línea+texto, línea+ilustración,
     texto centrado, ilustración central, lateral, objeto, gráficos). Salen de agrupar las escenas quality ≥ 4 del tablero
     por categoría. Cada regla cita evidencia (vNN, segundo, ID de animación). -->

## Principio 1 · «nombre»
**Cuándo se usa:** «qué se dice en ese momento» (triggers de edit_logic.json)
**Qué lo compone:** «elementos»
**Fuentes:** «…» · **Colores:** «hex» · **Tamaños y patrones:** «…» · **Texturas:** «…»
**Animación:** «entrada, duración, easing, salida» · **Sonido:** «…»
**Ejemplos:** VNN-ANN (vNN 0:00) · VNN-ANN (vNN 0:00) · VNN-ANN (vNN 0:00)
**Por qué funciona:** «psicología: anunciar vs describir, emoción, dato…»
**Escena del render que lo recrea:** `j_*` / `arthur_*` / nueva (ver CREAR una escena en SKILL de la creadora)

## Principio 2 · «nombre»
…


---

---
name: {estilo}-editing
description: Edita videos verticales cortos en el estilo de {CREADOR}: plan por beats con 3 diseños A/B/C sacados de {N_ANIM} animaciones reales del creador, subtítulos con su regla, sus principios de diseño, animaciones sincronizadas a la palabra, cortes fluidos, paleta por video, prompts de assets y diseño sonoro. Úsala para planificar, construir, revisar y entregar ediciones en este estilo con cualquier modelo.
---

<!-- PLANTILLA: rellena cada {…} y cada «…» con lo que salió del análisis (todo con evidencia: vNN y segundo).
     Mantén la estructura: es la misma de la skill de Arthur Brooks, que ya funciona en Claude, ChatGPT y Gemini. -->

# Skill de edición · estilo {CREADOR}

> **Obligatorio:** `REGLAS_GENERALES.md` (32 reglas: pausas, no generar nada, Joseph, subtítulos, fluidez, prompts de 7 bloques, sonido, QA) se aplica a TODA edición en este estilo. Herramientas incluidas: plugin **Edit Studio** de Higgsfield (`plugins/edit-studio/`: movimientos, géneros, ediciones puntuales, QA) y método **Katana** (`docs/katana/`, `docs/KATANA_EDITSTUDIO.md`). Las reglas de abajo solo las concretan para este creador.

## 0. Qué hay en el paquete
| Carpeta / archivo | Qué es |
|---|---|
| `SKILL.md` | Reglas y flujo (este archivo) |
| `docs/RULEBOOK.md` | Los principios del estilo con ejemplos reales |
| `docs/EDIT_LOGIC.md` | Qué elemento poner según lo que se dice, sincronía, transiciones, ritmo, sonido |
| `docs/FORMATOS.md` | Los formatos del creador y cómo distinguirlos |
| `ANIMACIONES.md` + `library/` | {N_ANIM} animaciones con ID `VNN-ANN` y hoja de keyframes |
| `references/vNN/` | Los {N_VIDEOS} videos desglosados |
| `system/` | Render (Remotion) + pipeline; estilo en `system/styles/{estilo}/style.json` |
| `REGLAS_GENERALES.md` | Reglas obligatorias comunes a todas las skills |
| `plugins/edit-studio/` · `docs/katana/` | Plugin de edición de Higgsfield y método Katana |

## 1. Reglas de oro
1. «Cuándo va la cara y cuándo se muestra» — p. ej. *anuncia → cara; describe → se muestra* (evidencia: vNN 0:00–0:00).
2. «Sincronía palabra → elemento medida» (mediana de `offset_s` de los triggers).
3. «Proporción de cortes secos» (de `ENERGY_SUMMARY.json`) y transiciones firma.
4. El primer borrador está al 60–70 %: se revisa con tiempos exactos.
5. Nunca se renderiza el final sin vista previa aprobada.
6. Si el cliente describe cómo quiere algo, se hace así.
7. Nunca se genera nada con IA de pago: se escriben prompts (7 bloques), el humano genera y entrega un zip.

## 2. Flujo (con STOPs)
Igual que la skill de Arthur: transcripción y corte de silencios (30 ms) → formato y paleta → **plan por beats A/B/C**
(STOP 1) → assets con prompts (STOP 2) → vista previa (STOP 3) → borrador → revisiones → final.

## 3. Qué poner según lo que se dice
| Lo que se dice | Elemento | Escena (render) | Ref |
|---|---|---|---|
| «…» | «…» | `«tipo»` | VNN-ANN |

## 4. Subtítulos
- Palabras por bloque: «…» · fuentes: «…» · tamaño relativo de la clave: «…» · color de la clave: «…» · posición: «…»
- Animación de entrada: «…» · sincronía: 2 frames antes de la voz.

## 5. Fluidez y transiciones
| Formato | Transiciones permitidas | Separación mín. | Eventos visuales / 10 s |
|---|---|---|---|
| «…» | «…» | «…» s | «…» |

## 6. Diseño (tamaño · composición · texturas · formas · colores)
«paleta base, inversiones, texturas, tipografía en 3 voces…»

## 7. Sonido
«música (tipo, nivel bajo la voz), efectos por evento y su frecuencia medida en sfx_events.json»

## 8. Assets
Prompts en 7 bloques (función de cada referencia, contexto, mapa espacial, una acción, cámara, luz/textura, bloqueos);
producto/persona hero primero; lugares vacíos sin personas; generar el doble de lo que sale en pantalla.

## 9. Lo que hace ÚNICO a este creador
«las rarezas de `distinct` de cada edit_logic.json que se repiten en varios videos»
