# Método Joseph (Ultimate Editors) — cómo se entrena y se usa la skill Arthur Brooks

Fuente: video completo de Joseph «AI edit with only Claude» (21 min), en `research/joseph/`
(transcripción: `transcript.txt`; fotogramas: `sheets/`, `key/`). Esto manda sobre cualquier regla anterior que lo contradiga.

## A. Los 10 principios del estilo (en este orden de frecuencia)

| # | Principio | Receta exacta |
|---|---|---|
| 1 | **Subtítulos en pantalla** | Inter para el texto normal + **Playfair Display Italic** (bold) para la palabra especial. Línea de ≤ 5 palabras. Se elige la palabra (o 2) más importante → **grande y en negrita** (bold sans o bold serif) **al centro**. Las demás palabras van **pequeñas, en sans light, en los huecos arriba/abajo** de la palabra grande. **El texto pequeño ocupa el 75 % del ancho del texto grande.** Variante: palabra serif sobre caja azul («enhance»). |
| 2 | **B-roll + texto** | El guion se parte en segmentos; b-roll que muestra literalmente lo que dice. Encima: **textura de papel clara, bordes oscurecidos y bordes un poco desenfocados** (foco al centro). Texto encima con la lógica del principio 1, describiendo la escena. |
| 3 | **Pinturas** | Pintura que describe la idea + **textura de pintura + papel rugoso** + texto cinematográfico **alrededor del sujeto** + **slide de cámara rápido** para revelarla. La textura se mueve CON la pintura y a media fuerza (revisión 3). |
| 4 | **Línea + texto** | Fondo negro o blanco con papel. **Línea azul de acento que lleva al texto, el texto la interrumpe, y la línea continúa** hacia otro texto relacionado. **La cámara sigue la punta de la línea.** |
| 5 | **Línea + ilustraciones** | Mismo fondo y línea, pero lleva a ilustraciones: (a) línea horizontal con **punto blanco** que marca el objeto + texto + ilustración debajo; (b) texto → **zigzag** con **paneo de cámara** que revela objetos a ambos lados (progresión por fases); (c) la línea llega directo al sujeto. |
| 6 | **Escena centrada en texto** | Fondo **blanco o azul con papel MUY rugoso**, **comillas** alrededor del centro y el texto cinematográfico en medio. |
| 7 | **Ilustración central** | Ilustración de la idea en el centro, **textura pintada, rugosa y con ruido**, ocupa la mitad baja y **sangra hacia el medio**; bordes abstractos. Texto en el resto. Variantes: cerebro cenital, patrón circular de líneas finas, **perfil lateral con textura de tela**. |
| 8 | **Ilustración lateral + texto** | Personaje abstracto a un lado, texto al otro. Variante: **media luna con textura de tela** a la izquierda y texto limpio rotando alrededor. Para mostrar 2 elementos a la vez. |
| 9 | **Objeto + texto** | Un solo elemento de la historia (foto, objeto), fondo papel, texto alrededor, **revelado rugoso**. |
| 10 | **Gráficos / estadísticas** | **Fondo oscuro plano con textura**, **cuadrícula de líneas blancas finas que brillan**, **bola azul** que dibuja la línea y **la cámara la sigue**. Etiquetas de eje en versalitas pequeñas. |

Los 5 pilares de diseño de cada escena: **Tamaño · Composición · Texturas · Formas · Colores** (azul acento, negro, crema/papel, blanco).

## B. Cómo se entrena (lo que ya hicimos y lo que faltaba)
1. 20 videos de referencia → mirarlos como editor: por cada escena «¿por qué este diseño, estos colores, estos efectos, esta animación?».
2. Tablero de inspiración (~130 piezas) categorizado en los 10 principios, con desglose por principio: qué lo compone, fuentes, colores, tamaños y patrones.
3. Prompt de entrenamiento: transcripción palabra a palabra + desglose fotograma a fotograma de cada video para estudiar **(1) dónde van las animaciones respecto al guion, (2) cómo está compuesto el diseño, (3) la lógica de animación: cuánto duran y cómo se sienten**.
4. Resultado: la skill + **225 animaciones extraídas, cada una en su carpeta con el diseño de referencia y la hoja de keyframes** (ID tipo `V10-A02`). → nuestra `library/animations/`.

## C. Cómo se usa (flujo de una edición)
1. Prompt: usar la skill + **transcripción al milisegundo, cortar silencios dejando 30 ms**, + **documento de planificación**.
2. **Documento de plan por beats**: guion a la derecha con el clip, a la izquierda **3 diseños recomendados (A/B/C) sacados de la biblioteca de Arthur** con miniatura, categoría, descripción concreta del beat y referencia (`Ref V10-A02`), + nota «Visto en los reels» (qué patrón de Arthur es) + caja para notas propias. El humano elige uno por beat → «Copiar plan».
3. Reglas de planificación del humano: **cuando anuncia algo nuevo → cara (A-roll con captions); cuando lo describe → se muestra**. Abrir con A-roll para conectar. Se balancean las escenas para que fluya.
4. Claude construye: busca las referencias elegidas, hace la **lista de assets** y los consigue (pinturas de Wikipedia, stock, fotos), captions primero, luego escena por escena, render.
5. **El primer borrador está al 60–70 %**: revisiones concretas con tiempo (ej.: «el texto de la escena 1 no está bien», «corte brusco entre el gráfico y el siguiente plano», «textura de pintura demasiado fuerte y no se mueve con la pintura», «mal corte en 0:24», «la espiral debe durar más», «comillas en la escena final»).
6. Diseño sonoro basado en las 20 referencias: **música cinematográfica, clics para texto, highlighter para gráficos, whooshes para transiciones**.

Tiempos de Joseph: corte + plan 15 min · planificar 15 min · crear edición 60 min · revisiones 10 min · sonido 15 min.

## D. Reglas del cliente (revisión 24-nov)
- **Palabra clave de los subtítulos en el color de marca del video** (la grande: «Black Friday», «menos», «telas»…). Si el acento es muy oscuro para leerse sobre el A-roll, se aclara lo justo; el resto del caption en blanco.
- **También se permiten gráficos en color sólido** (sin textura) cuando la escena lo pide: bloques, números, fondos planos de marca.
- **Si el cliente describe cómo quiere algo, se construye así**, aunque no siga estas reglas al pie de la letra: las reglas guían, la descripción del cliente manda.


---

# Higgsfield Katana + Edit Studio dentro de la skill

## 0. Regla número uno: no se genera nada
**La skill nunca genera imágenes, video, voz ni música con herramientas de pago** (Higgsfield, Katana, edit-gen, Seedance,
Soul, etc.). Siempre:
1. Escribe los **prompts** de todo lo que falta (con la estructura de Katana de la sección 3).
2. Tú generas y entregas un **zip** con los nombres de archivo de la lista.
3. La skill lo ingiere (`assetpack.py --ingest`), lo recorta, le aplica el color de marca y lo usa.

Katana y edit-gen se usan **solo como método**: cómo analizan, planifican, escriben prompts y verifican. Sus pasos de
generación, sus créditos y su modo «autónomo sin preguntar» quedan **desactivados**. Prevalecen nuestras 3 pausas
(plan → assets → vista previa).

## 1. Qué es cada cosa
| | Qué es | Qué trae que nos sirve | Qué NO usamos |
|---|---|---|---|
| **Katana** (flujo de Higgsfield) | Rehace un video de referencia con tu sujeto: analiza cada fotograma, planifica, genera escenas nuevas y monta | Lectura fotograma a fotograma con mapa de energía; contrato de bloqueos y libertades; roles de toma; **prompts en 7 bloques con una función por referencia**; lugares vacíos reutilizables; 3 revisiones de movimiento; control de calidad (lógica cada 0.5 s, sin fotogramas repetidos) | La generación con Seedance/Soul, el gasto de créditos y el modo sin pausas |
| **Edit Studio** (plugin `edit-studio`) | Edición en código (Python + ffmpeg) con 3 skills: director, voz y generación | **Biblioteca de 268 movimientos** (`moves/*.yaml`: zoom, whip, crash, speed ramp, freeze, flash…); **15 géneros** con estructura y ritmo (fashion, ugc, product, explainer, viral…); presets de estilo por palabras; ediciones puntuales por voz («crash zoom en 0:07», «whip entre #4 y #5»); vista previa con clips numerados; versiones que no se repiten; medir un efecto de un clip de ejemplo; QA medido (cortes en el beat, LUFS) | `edit-gen` (de pago) y descargar de YouTube o TikTok |

Va incluido en `plugins/edit-studio/`. Las instrucciones de Katana (método) están en `docs/katana/`.

## 2. Reglas generales que adopta la skill (todas las ediciones)
1. **Plan en 5 líneas antes de trabajar** (Edit Studio): partes en orden, puntos de corte (tiempos o palabras citadas), duración, formato y estilo. Luego se ejecuta.
2. **Contrato de bloqueos y libertades** (Katana): `analysis/task-contract.json` con lo que NO puede cambiar (la prenda, la palabra del CTA, la canción…) y lo que es libre. Cada pedido tuyo es un bloqueo.
3. **Analizar la referencia entera** (Katana): todos los fotogramas, notas por segundo, cortes corregidos a mano, y un **mapa de energía**: cuántos cortes, flashes, sacudidas, movimientos de cámara y golpes por segundo. **La edición nueva repite esas tasas.** Si baja la energía, el video se siente plano.
4. **Roles de toma** (Katana): cada escena tiene una función: gancho, contexto, héroe, acción, detalle, contraste, revelación, clímax, pausa o remate. El concepto lleva planteamiento y remate.
5. **Ritmo por género** (Edit Studio): para moda se aplica `genres/fashion.md` (gancho tipo portada de revista, detalles de tela, un cambio de look por beat, flash de foto con congelado). Para UGC y producto, sus géneros. Se combinan con el formato Arthur, que manda.
6. **Movimientos con nombre** (Edit Studio): las transiciones y efectos se eligen de `moves/` (`find_move.py crash zoom`), respetando los permitidos y prohibidos de cada género y de cada formato Arthur.
7. **Prompts de assets en 7 bloques** (Katana, sección 3), con la referencia de identidad y ropa siempre primero.
8. **Lugares vacíos** (Katana): cada lugar que aparezca en varias tomas generadas tiene un «plate» propio **sin personas** (tipo `location`), que se reutiliza en todas sus tomas. Así el fondo no cambia entre tomas.
9. **La ropa del hero está bloqueada**: en todas las tomas lleva exactamente la prenda de tu foto. Nunca la del video de referencia ni una inventada.
10. **Duración a generar = el doble de lo que sale en pantalla** (mín. 4 s; Seedance: Σ por toma de clamp(2 × segundos en pantalla, 2, 4)). Así se elige el mejor tramo.
11. **Nunca se retocan caras con código**: ni pegar, ni deformar, ni «embellecer». Si una cara sale mal, se pide otra generación (prompt nuevo) o se usa otra toma.
12. **3 revisiones de movimiento** (Katana), antes de renderizar y sobre el borrador: (1) tiempo y ritmo; (2) movimiento en el espacio y continuidad entre cortes (dirección, escala); (3) detalle y pulido (energía, easing, tipografía, acentos de sonido).
13. **Control de calidad del material que entregas** (Katana): un fotograma cada 0.5 s de cada video generado. Se revisan manos, objetos que se funden, identidad, ropa y texto parásito, y se usa solo el tramo limpio.
14. **Ediciones puntuales por voz** (Edit Studio): «#5» (el número del clip en la vista previa), «0:07» o «donde dice …» + qué hacer («crash zoom», «whip», «quita», «más fuerte»).
15. **Versiones que no se repiten** (Edit Studio): una segunda versión evita las transiciones, movimientos y tomas de la anterior.
16. **Sonido de bibliotecas reales** (Katana/Edit Studio): música y efectos grabados (Mixkit, YouTube Audio Library, CC0). Nunca sintetizados por código.

## 3. Prompts de assets en 7 bloques (Katana)
Cada prompt de imagen o video incluye solo los bloques que aclaran la toma:

| # | Bloque | Qué escribir | Ejemplo |
|---|---|---|---|
| 1 | **Función de cada referencia** | Qué controla cada imagen adjunta, en orden | `@image1` = A01 (diseño exacto de la blusa) · `@image2` = A02 (identidad de la modelo) · `@image3` = L01 (lugar vacío) |
| 2 | **Contexto** (opcional) | Qué pasó antes y su huella; estado inicial → estado final | «acaba de abrir la caja; la blusa sale doblada → la sostiene frente al espejo» |
| 3 | **Mapa espacial** | Primer plano, plano medio y fondo; posiciones; dirección del movimiento | «ella a la izquierda en plano medio, ventana al fondo a la derecha» |
| 4 | **Una sola acción clara** | Un cambio de estado por toma | «gira ¼ hacia la ventana» |
| 5 | **Cámara** | Encuadre y ángulo; si se mueve: un movimiento, su dosis y su límite | «push-in lento del 5 %, termina antes de cortar la cabeza» |
| 6 | **Luz y textura** | La gramática visual elegida + luz motivada | «luz dorada de ventana, satén con brillo real, grano fino» |
| 7 | **Bloqueos finales** | Identidad, la ropa de tu foto, sin texto, continuidad | «lleva exactamente la blusa de @image1 en toda la toma; sin texto ni logos» |

Más la ficha técnica: formato (más cercano soportado) y resolución, duración a generar, negativo, nombre de archivo y zip.
`pipeline/assetpack.py` ya añade solo los bloques 1 y 7, la función de cada referencia y la duración a generar.

## 4. El plus, en concreto
| Antes | Ahora |
|---|---|
| Prompts sueltos: la blusa podía cambiar de color entre tomas | Cada referencia controla una sola cosa y la ropa está bloqueada en todas las tomas |
| Fondos distintos en cada toma generada | Un lugar vacío reutilizable por cada sitio |
| La energía se elegía a ojo | Se mide la de la referencia (cortes, flashes y movimientos por segundo) y se iguala |
| Transiciones de una lista corta | 268 movimientos con nombre, filtrados por género |
| Revisión general | 3 revisiones de movimiento + control cada 0.5 s del material generado |
| «Cámbialo» | Ediciones puntuales con #clip, tiempo o palabra |


---

---
name: ves-train-style
description: Crear un estilo de edición nuevo en VES haciendo ingeniería inversa de videos de referencia (método REA de evidencia). Úsalo cuando el usuario traiga 10-20 videos de un creador/estilo y quiera que el sistema lo replique.
---

# Entrenar un estilo nuevo (ingeniería inversa con evidencia)

Inspirado en el flujo "carpeta de referencias + tablero Figma → skill", pero con la
disciplina de REA: **cada regla del estilo debe citar evidencia**.

## Niveles de evidencia (de REA)
- `observed`: medido por herramienta (cortes, paleta, duración de planos, texto dicho).
- `derived`: calculado de observaciones (ASL, cortes/min, cuota de animación).
- `inferred`: interpretación (tipo de escena, por qué está ahí). Requiere confirmación humana.
- `unknown`: lo que no se puede saber (curva exacta, fuente exacta) — se declara, no se inventa.

## Pasos
1. Carpeta `refs/` con 10–20 videos del estilo (descargados por el usuario).
2. Por cada uno: `python3 reverse/breakdown.py refs/X.mp4 --style-id <nuevo> --transcribe`
3. Abre cada `board.html` y `cards.md`. Para cada plano rellena ASSETS / EFFECTS / ANIMATION / ¿por qué aquí?
   Mira los `shots/NNN.jpg` (5 keyframes) para medir duración de entradas (frames entre keyframes).
4. Agrupa los planos en tipos de escena (máx ~10 "principios" del estilo). Mapea cada uno a un tipo
   de `schemas/scenes.json`. Si no existe → propón un componente nuevo en `render/src/scenes.tsx` (cambio de sistema).
5. Escribe `styles/<nuevo>/style.json` (copia uno existente) y `rulebook.md`, citando ids de plano como evidencia:
   `"enter_ms": 600  // derivado: refs/A planos 3,7,12 (18 frames @30fps)`.
6. Valida con un clip real: `ves.py all` → plan → `validate` → `preview`. Compara stills lado a lado con los keyframes de referencia.
7. Itera hasta que un humano no distinga. Recién entonces el estilo es "estable" y sirve para los 3 modelos.

## Dónde entra REA (rea-agents) de verdad
REA analiza binarios, apps JS/Electron y **sitios web**, no archivos de video. Úsalo para:
- Extraer curvas y duraciones EXACTAS de animaciones web que quieras copiar (landing pages SaaS,
  portfolios motion, players de Lottie): `capture_browser_scenario` / exportar scripts del sitio y leer
  los `cubic-bezier`, `duration`, keyframes CSS/GSAP/Lottie JSON → pásalos al `style.json`.
- Inspeccionar plantillas de apps de edición de escritorio que uses (si son JS/Electron) para entender
  sus presets. Solo software que tengas derecho a analizar.


---

# Creative planning, reference discovery, sound and motion reviews

Read `analysis/task-contract.json`: its `explicit_locks` and `creative_freedoms` govern the work. This standard adds no intake questions, consent steps, purchases or paid exploratory renders. Infer unresolved creative choices from the task, supplied media and inspected references; record the decision and continue.

Learn the reference's visual grammar—rhythm, shot scale, motion, texture, typography and musical arc—and use it to author a new result for the user's subject. Story, scenes, camera angle, text, duration, frame count and shot order may change within the user's locks. A source observation is evidence, not automatically an output lock.

## Find and actually inspect references

If a primary video is supplied, inspect it fully. Supplementary examples can inform unlocked choices; they cannot replace locked source properties. If none is supplied, search current relevant popular TikTok videos, Instagram Reels and YouTube Shorts using the requested subject, mood, format and uploaded material. Use a real search/browser capability, never invent a stock-search or download tool. [TikTok Creative Center](https://ads.tiktok.com/creative/creativeCenter/trends?LanguageId=1) provides a starting point for current videos and music; ordinary YouTube Shorts search can supply another.

Shortlist up to three promising accessible clips. Inspect their actual complete playback or decoded frame sequence; inspect audible music when playback supports it. A title, thumbnail, snippet, view count or preview cover is not evidence of watching the clip. Record observed popularity signals with their retrieval date; do not label a result trending without evidence. Relevance and observable craft matter more than a large view count. Select a primary autonomously, state that selection briefly, and run the full every-frame/every-second analysis before paid work. Optimize inspection in batches, never by skipping subtle textures, transitions or intervals.

Use `analysis/references.json` to record each source URL/media ID, source role, viewing coverage, access method, retrieved date, observable popularity evidence and selection rationale. Always account for:

- Montage: actual cut rhythm, shot scale, subject/camera movement, transitions and effect timing.
- Music: actual track/segment, pulse, vocal or instrumental structure, edit points, ending and silence.
- Typography: actual letterforms, weights, tracking, placement, animation and occlusion at readable resolution.

The primary video can supply all three. Record absent properties explicitly. Add music or text only when it serves the creative plan; absence is neither a requirement to add something nor a prohibition. Inspect additional font specimens or audio references when they materially inform an unlocked choice.

If a specific user-designated clip cannot be accessed, try authorized available routes before reporting the limitation. If no clip was designated, select another accessible candidate. Never ask the user to upload a replacement, pretend a hidden preview was inspected, or silently claim a substitute is the requested source.

## Creative brief and assets before production

Keep source observations in `analysis/breakdown.json` and authored output decisions in `plan/creative-plan.json`. Write the brief before pricing/generating missing assets. It contains:

- `output_target`: chosen dimensions, aspect, frame rate, duration/frame count and audio interval, with applicable user locks. Derive unlocked values from the task; do not import a fixed format, song, font set or shot count from a preset.
- The central tension/theme and a concise logline. Use a story with setup/payoff where narrative helps; otherwise use a visual motif and its progression. Do not force a plot or fighting/chase template onto a product, lyric edit or abstract montage.
- Output shot roles, intended action/camera angle/scale, rhythm and text role. Plan purposeful visual rhymes and contrast where useful; no quota of rhymes, transitions or effect changes is required.
- `source_evidence`: observed mechanisms each decision draws on, applicable locks, and reasons for deliberate departures. New output shots need not map to source shots.
- A shot-role-to-asset map: existing material to reuse, missing images/footage/graphics/audio, selected production route and required on-screen duration. Include a stable `location_id` for every distinct environment in newly generated scenes, its required location plate (Soul Cinema for a photoreal look, a stylised flare plate otherwise), served shot IDs, provenance and dependent video jobs. Generate only assets actually used by the plan.

Prefer suitable existing footage and whole-plate editing, then source-frame plus supplied-identity image preparation where needed, and Seedance 2.5 when genuinely new motion is needed. A supported Genjutsu motion transfer or verified preset is optional when a shot's role needs a specific source performance or camera path; it is not the default engine for all creative work. A still plus code can suffice for a planned hold, pan or graphic treatment. Do not force every shot to move or require character sheets, alternate takes or extra preset passes. Location assets follow the required location-plate stage below, including single-shot scenes. The user's hero appears in every relevant subject shot, including back views, silhouettes, hands and occlusion, always in the clothing from the user's own image(s) unless the user explicitly asks for a different outfit; never put the reference performer's outfit on the hero or invent a new one. This does not require revealing a face hidden by the planned composition.

The finite live-priced plan and existing account/task authority in `budget.md` still apply. Creative freedom does not authorize unlimited generation or invented provider contracts.

## Required location assets

Every distinct location used by newly generated scenes has one separately generated, inspected location plate. The plate is generated with Soul Cinema (`soul_cinematic`) only when the planned look is photoreal; when the look is stylised (anime, manga, cartoon, illustration, any drawn or painted look) the plate is a `gpt_image_2_6_flare` still (quality high, 2k) with the style owner (the accepted keyframe or style frame) as `@image1` and the location evidence (source frame or location photo) as `@image2`, environment only, and its plan line carries `"location_plate": true`. Reuse that same asset across all shots in the location; no per-shot duplicates or alternate-location shopping. The plate contains the location only, with no people or hero. Every plate, from either model, is inspected for people before acceptance: Soul Cinema drew a person into 6 of 8 measured plates despite "no people" in the prompt (2/2 in the stage 8 test, 4/6 in the 2026-10-13 power-suit run, even from performer-free source crops) and ignored the cartoon style entirely (stills test stage 8, 2026-10-13); a plate with a person is rejected and regenerated within the line's attempts (a `soul_cinematic` plate line registers `takes: 2` with a `take_reason`, so the people check has two takes plus one re-roll; `faces.py detect <plate>` is the free first filter: a detection is a reject, no detection is not acceptance). It establishes geometry, materials and stable landmarks; the shot plan still specifies camera, action and lighting unless the user locks those to the source. A single scene needs this stage too. Existing suitable identity references remain reusable and need no Soul ID training.

For a photoreal plate use the live Soul Cinema image contract (`quality` `1.5k` or `2k`, at most one image input). A supplied location/reference frame may guide the generation; it cannot replace the required plate result for a newly generated scene. An existing inspected plate with recorded provenance may be reused for the same location. Every newly generated location, including one needed by a still or a selected Genjutsu motion transfer, uses the plate model of its look (Soul Cinema or the stylised flare plate) rather than another image model. Retained footage, including footage restyled by a verified Genjutsu preset, keeps its own location and needs no location asset.

Pass the actual completed location asset separately to Seedance as `role: "image"`, in addition to the scene's identity/start-frame references. Assign actual `@imageN` indexes and ownership explicitly: hero identity, location geometry/materials, and any composition/style reference. Do not rely only on a location name, a prompt description or scenery baked into an identity image. Split jobs if verified reference limits prevent the necessary combination; do not discard the location reference.

Include location generation and dependent video jobs in the finite plan and cap before spending. Record model, source input/provenance, actual completed asset ID, reused location ID and served shots. A video waiting for its location keeps a `"<result of LINE>"` placeholder until the location job completes. If the required model cannot run, use an already-authorized route that does not need new location generation or deliver the explicit gap, without questions or a substitute location model.

## Recorded music and stock SFX

Use the source's actual soundtrack when it serves the task: keep it by default when it fits; when a different musical arc is needed, identify a suitable TikTok track or use a stock/audio-library recording with the right mood, instrumentation, tempo and development. [YouTube Audio Library](https://support.google.com/youtube/answer/3376882?hl=en-uk) is one documented source of recorded music and sound effects. Use available permitted files or library operations; a discovery URL alone is not an audio asset.

New SFX must be actual stock recordings selected for the visible event and the chosen acoustic character. Preserve suitable effects already baked into source audio. Record provenance, actual file/media ID, segment in/out, timeline placement, gain and any attribution associated with the chosen asset. Audition the actual selected segment when possible; label audio as measured rather than heard when playback is unavailable. Do not silently purchase, subscribe, bypass access controls or request consent. If one source is unavailable, try another suitable accessible recording under existing authority; keep source audio where appropriate or report the unresolved audio element precisely.

Do not synthesize a melody, drum loop, bassline, whoosh, impact or substitute song from oscillators, noise, procedural beats or text-to-audio merely because it is convenient. Code is for cutting, aligning, mixing, fades, dynamics and muxing existing recordings. It is not the music or SFX source. The compositor accepts a prepared, timeline-aligned recorded SFX bed through `--sfx-file` or `audio.sfx_src`; legacy procedural `audio.beat` and the `sfx` synthesis command are disabled.

Keep music, SFX and lyric text separate from generated footage. Preserve supplied lyrics and their wording. Preserve visible lyric pixels when the lyric text is locked; otherwise align supplied words or a checked transcription of user-supplied audio/video to the selected segment and render them in the final text pass. Do not send whole lyrics into scene-generation prompts. Do not add lyric captions merely because a song has vocals; they need a role in the task or creative plan. Do not retrieve full protected lyrics from an online-only song that the user did not supply. Continue permitted visual/audio work if a particular text element is unavailable, without inventing words or entering a question flow.

## Typography and deliberate effects

Plan text as part of the message before generating footage, then apply it deterministically in final assembly. Author new wording and hierarchy within user locks; supplied lyrics remain intact. Choose a typeface for the message, language, visual grammar and actual glyph coverage. Verify it loads, then tune width, weight, slant, spacing, placement and animation. For locked source text, the source's own text pixels or outlines give the most direct match. Never request font files or present a typography picker.

Effects carry the reference's energy (`analysis/energy.json`). Keep the source's effects and their rates: the same kinds of flashes, shakes, punch-ins, zooms, whips and glitches at a similar rate per second and intensity, placed on the new action and beats, and add more where the new scene needs them. Never drop the source's energy: in past remixes camera movement fell to about a third of the reference and the edits felt flat. Seeded randomness may drive texture variation inside a chosen effect.

Whole-plate editing, global grades, camera transforms and separate graphics are permitted. Code must not swap, paste, redraw, warp or retouch facial/head pixels, hair or anatomy to create or repair likeness. A tracked decorative graphic remains a separate graphic, never a disguised face repair. Underlying identity corrections need a supported authorized model, subject to the same finite plan.

## Three motion reviews

Keep `analysis/motion-reviews.json` with three separately recorded passes, concrete frame/cut evidence, defects, corrections and remaining deviations. Complete all three on the motion plan before generation. Recheck them on representative/current composition previews before the final render and on the rendered sequence before delivery; reuse observations that still apply. These are internal reviews, not three paid takes, three variants or user approval rounds.

1. Timing and rhythm: inspect entrances, pauses, speed changes, beat/vocal anchors and transition start/peak/end frames. Compare against the authored musical and dramatic arc while respecting locks.
2. Spatial motion and continuity: inspect trajectories, camera movement, subject scale, acceleration, overlap, framing and direction across cuts. Include every relevant body/occluded shot. Assess newly authored motion against its shot role rather than requiring source choreography.
3. Distinctive detail and polish: the reference's energy is carried (`energy.json` rates and events), check easing, texture/cadence, typography motion, transitions and sound accents at full size. Each added decision must serve this specific scene and its chosen references.

Do not always choose the third or most unusual idea. Keep the strongest coherent solution, including intentional stillness or unchanged motion. New choreography is allowed within locks. Record a valid unchanged decision rather than manufacturing three changes to satisfy three passes.
