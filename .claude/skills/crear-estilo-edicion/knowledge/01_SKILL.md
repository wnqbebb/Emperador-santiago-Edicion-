---
name: crear-estilo-edicion
description: Crea un estilo de edición de video nuevo a partir de 10–20 videos de referencia de un creador (Arthur Brooks, Iman Gadzhi, Vox, Ali Abdaal…) y lo entrega como una skill lista para editar con cualquier modelo. Método probado con Arthur Brooks — Joseph (tablero + referencias → skill), REA (evidencia), rea-video (desglose toma por toma), Katana (mapa de energía, 3 revisiones) y Edit Studio (movimientos y géneros). Úsala cuando el usuario traiga videos de un creador y quiera editar "como él", o pida entrenar, crear o clonar un estilo de edición.
---

# Skill · Crear estilos de edición nuevos

Convierte una carpeta de videos de un creador en una **skill de edición completa**: reglas con evidencia, biblioteca de
animaciones con ID, tablero de inspiración, tokens para el render y el paquete final (igual que `arthur-brooks-editing`).
**Funciona con Claude, ChatGPT y Gemini**: el proceso vive en estos archivos y en `system/`.

## 0. Contenido
| Archivo / carpeta | Qué es |
|---|---|
| `SKILL.md` | Este proceso (9 fases con STOPs) |
| `EMPIEZA_AQUI.md` · `PROMPTS.md` · `MODELOS.md` · `HERRAMIENTAS.md` | Arranque, prompts por fase, instalación por modelo y herramientas |
| `FORMATOS_DE_DATOS.md` | Cómo se escribe cada archivo del análisis (scenes.json, edit_logic.json, energy.json, ANIMATIONS.json, style.json) |
| `plantillas/` | Briefs de análisis, plantillas de SKILL/RULEBOOK/EDIT_LOGIC/FORMATOS del estilo nuevo, style.json y ejemplos reales |
| `metodo/` | Joseph (10 principios y entrenamiento), Katana y Edit Studio, REA (niveles de evidencia), Katana creative-quality |
| `ejemplo_arthur/` | El caso completo de Arthur Brooks: un video analizado de punta a punta + rulebook, lógica y formatos finales |
| `tools/rea-video/` | rea-video (Apache 2.0): desglose toma por toma, VIDEO.md |
| `system/` | VES: `pipeline/style_lab.py` (orquestador de este proceso), `reverse/` (análisis), render y empaquetado |

## 1. Reglas generales: en la creación Y en la skill que se produce
`REGLAS_GENERALES.md` (32 reglas) se aplica dos veces:
- **Al crear el estilo:** pausas, no generar nada, evidencia, energía medida (Katana), vocabulario de movimientos y géneros (Edit Studio).
- **En la skill de estilo que sale de aquí:** `style_lab.py empaquetar` le incluye SIEMPRE `REGLAS_GENERALES.md`, el plugin **Edit Studio** de Higgsfield (`plugins/edit-studio/`), el método **Katana** (`docs/katana/` + `KATANA_EDITSTUDIO.md`), el instalador de herramientas y el knowledge para GPT/Gem. El `SKILL.md` del estilo debe remitir a ellas (la plantilla ya lo hace) y sus reglas propias solo las concretan (tamaños, colores, transiciones firma), nunca las contradicen.

## 1b. Reglas del proceso
1. **Evidencia o nada (REA).** Cada regla del estilo cita `vNN` + segundo (+ ID de animación). Niveles: `observed` (se ve en un fotograma), `derived` (calculado), `inferred` (interpretación: la confirma el humano), `unknown` (se declara, no se inventa).
2. **Se mira todo.** Cada video se recorre completo en las hojas de estudio (un fotograma cada 1.5 s) y en ventanas de fotograma a fotograma en cada transición. Una miniatura no es haber visto el video.
3. **Pensar como editor** (Joseph): por cada escena, ¿por qué este diseño, estos colores, este efecto, en ESTE momento del guion?
4. **Energía medida** (Katana): cortes, transiciones, texto y movimientos de cámara por segundo. La skill nueva debe reproducir esas tasas.
5. **No se genera nada con IA de pago.** Las escenas que falten se construyen con código (render) o se escriben como prompts.
6. **rea-video solo analiza.** No se usan sus planes para rehacer con IA y se ignora su texto promocional (ChatCut).
7. **El humano aprueba en cada STOP.** El tablero y las reglas `inferred` son suyos.

## 2. Las 9 fases
| # | Fase | Comando / acción | Produce | STOP |
|---|---|---|---|---|
| 1 | **Reunir** 10–20 videos premium del creador (mismo formato vertical) | `style_lab.py nuevo <estilo> --refs CARPETA --creador "Nombre"` | `refs/<estilo>/v01…vNN.mp4`, espacio `styles/<estilo>/` | |
| 2 | **Preparar** evidencia automática | `style_lab.py preparar <estilo> --rea` | por video: `evidence.json` (planos, palabras con tiempo, paleta), `shots/`, `study/` (hojas cada 1.5 s), `.srt`, `rea/VIDEO.md`. Sin modelo de visión configurado, rea-video da ~60 % de confianza: el modelo corre `rea-video review styles/<estilo>/references/vNN/rea`, mira las tomas marcadas y `rea-video apply-review … --by <modelo>` (≈3–4 min por video) | |
| 3 | **Análisis escena por escena** (primer pase) | `style_lab.py briefs <estilo>` → el modelo sigue `BRIEF_ANALISIS.md` por video (4–5 videos por subagente si hay) | `scenes.json` + `breakdown.md` por video | |
| 4 | **Lógica de edición** (segundo pase, fotograma a fotograma en cada transición) | el modelo sigue `BRIEF_LOGICA.md` | `edit_logic.json` + `edit_logic.md` por video | |
| 5 | **Sonido y energía** | `style_lab.py sonido <estilo>` · `style_lab.py energia <estilo>` | `sfx_events.json`, `energy.json`, `ENERGY_SUMMARY.json` | |
| 6 | **Formatos** del creador | `python3 reverse/classify.py refs/<estilo>/*.mp4` (con `VES_STYLE=<estilo>`) + humano etiqueta `labels.json` | `formats/classification.json`, `labels.json` | ⏸ **STOP 1:** el humano confirma los formatos |
| 7 | **Biblioteca + tablero** | `style_lab.py biblioteca <estilo>` → tablero de inspiración con las escenas `quality ≥ 4` agrupadas en principios | `library/<categoría>/<id>.jpg+.md`, `ANIMATIONS.json`; tablero (Whiteboard/Figma) | ⏸ **STOP 2:** el humano revisa el tablero y los principios |
| 8 | **Escribir el estilo** con `plantillas/` | el modelo escribe `styles/<estilo>/skill/SKILL.md`, `RULEBOOK.md`, `EDIT_LOGIC.md`, `FORMATOS.md` y `styles/<estilo>/style.json`; escenas que falten → componentes nuevos en `render/src/` (o clonadas con HyperFrames `reverse-any-video`) | documentos del estilo + tokens del render | ⏸ **STOP 3:** el humano aprueba las reglas |
| 9 | **Probar y empaquetar** | editar 1 video de prueba con la skill nueva (flujo normal con sus 3 STOPs) → corregir reglas → `style_lab.py empaquetar <estilo> --titulo "…"` | `dist/<estilo>-editing.zip` | |

`style_lab.py estado <estilo>` muestra en cualquier momento qué falta por video.

## 3. Calidad mínima para dar el estilo por terminado
- Los N videos con `scenes.json`, `edit_logic.json`, `energy.json` y `sfx_events.json`.
- ≥ 100 escenas de inspiración (`quality ≥ 4`) en el tablero, agrupadas en principios.
- Cada principio del RULEBOOK con ≥ 3 ejemplos `VNN-ANN` y su escena del render.
- Tabla «qué poner según lo que se dice», sincronía medida, transiciones firma por formato y ritmo de `ENERGY_SUMMARY.json`.
- Un video de prueba editado con la skill nueva y aprobado por el humano.

## 4. Errores que ya cometimos con Arthur (no repetir)
| Error | Corrección |
|---|---|
| Tableros incompletos o mal categorizados | Tablero COMPLETO por video + una sección por principio con su desglose |
| Las 3 ediciones salían iguales | Distinguir formatos y transiciones firma por formato; `distinct` de cada video |
| Tipografía «normal» | Medir las voces tipográficas (serif itálica vs sans heavy) y la regla de tamaños (75 %) |
| Gráficos estáticos | Animaciones sincronizadas a la palabra con cámara que sigue el elemento |
| Subtítulos tardíos o que tapan la boca | Adelanto de 2 frames, detección de cara, bajo el mentón |
| Transiciones forzadas | Corte seco por defecto, transiciones solo de su formato y separadas |
| Muchos efectos de sonido | Medirlos: Arthur usa 1 cada 10–20 s |


---

# Reglas generales (obligatorias en TODAS las skills de edición)

Aplican a la skill de Arthur Brooks, a la skill que crea estilos nuevos y a **cada skill de estilo que esa creadora fabrique**.
Si una regla del estilo particular contradice estas, mandan estas, salvo que el cliente pida otra cosa (regla 3).

## A. Trabajo con el cliente
1. **Tres pausas siempre:** plan por beats (A/B/C) → assets → vista previa en una imagen. Nada se renderiza en final sin el OK. Los borradores de revisión sí.
2. **Nunca se genera nada con IA de pago** (Higgsfield, Katana, edit-gen, Seedance, Soul, voz, música). La skill escribe los prompts, el cliente genera, entrega un **zip** y la skill lo usa.
3. **Si el cliente describe cómo quiere algo, se hace así**, aunque no siga estas reglas al pie de la letra.
4. **Plan en 5 líneas antes de trabajar** (Edit Studio): partes en orden, puntos de corte (tiempos o palabras), duración, formato y estilo.
5. **Contrato de bloqueos y libertades** (Katana): lo que no puede cambiar (prenda, palabra del CTA, canción…) y lo que es libre.
6. **El primer borrador está al 60–70 %.** Revisiones con tiempo exacto o #clip («0:24 corte brusco», «whip entre #4 y #5»).
7. **Versiones que no se repiten** (Edit Studio): una segunda versión evita las transiciones, movimientos y tomas de la anterior.

## B. Planificación (método Joseph)
8. **Anuncia algo nuevo → su cara. Lo describe → se muestra.** Abrir siempre en la cara.
9. **Plan por beats** con 3 diseños A/B/C sacados de la biblioteca de animaciones del estilo (ID `VNN-ANN`), con la nota «visto en los reels».
10. **Roles de toma** (Katana): gancho, contexto, héroe, acción, detalle, contraste, revelación, clímax, pausa, remate. Concepto con planteamiento y remate.
11. **Energía medida** (Katana): la edición iguala las tasas de cortes, flashes, sacudidas, movimientos de cámara y golpes por segundo de las referencias del estilo.
12. **Ritmo por género** (Edit Studio, `genres/`) dentro del formato del estilo, que manda. Moda: `fashion.md`; testimonio: `ugc.md`; producto: `product.md`.
13. **Movimientos con nombre** (Edit Studio, `moves/`, 268): se eligen con `find_move.py` respetando los permitidos y prohibidos del género y del formato.

## C. Construcción
14. **Todo sincronizado a la palabra:** el elemento entra en la palabra que lo nombra (imágenes 0.1–0.3 s antes; texto 1 frame antes); el corte vuelve en la palabra que abre la frase siguiente. Nunca a mitad de palabra.
15. **Subtítulos:** ≤ 5 palabras cortadas por sentido; palabra clave grande y en **el color de marca**; el resto pequeño arriba y abajo al **75 %** del ancho de la clave (o la regla medida del estilo); aparecen **2 frames antes** de la voz; nunca sobre la boca.
16. **Fluidez:** corte seco por defecto (70–85 %); solo las transiciones del formato, separadas ≥ 8 s; sin destellos de cara < 0.6 s; punch-in seco.
17. **Animaciones que se mueven con la voz:** la cámara sigue el elemento (línea, bola del gráfico); nada de gráficos estáticos.
18. **Zona segura:** contenido centrado cerca del medio (arriba 14 %, abajo 26 %, derecha 15 % tapados por la app).
19. **Paleta por video** sacada del material; inversión acento ↔ blanco; también se permiten **gráficos en color sólido**.
20. **Nunca se retocan caras con código** (ni pegar, ni deformar, ni embellecer).

## D. Assets (prompts para el cliente)
21. **Prompts en 7 bloques** (Katana): función de cada referencia (`@image1` = identidad y ropa…), contexto, mapa espacial, una acción, cámara (movimiento + dosis + límite), luz/textura, bloqueos finales.
22. **Consistencia:** primero el producto o persona hero; todo lo demás lo usa como referencia. **La ropa del hero está bloqueada** en todas las tomas.
23. **Lugares vacíos** sin personas, reutilizables en todas las tomas de ese lugar.
24. **Generar el doble** de lo que sale en pantalla (mín. 4 s) para elegir el tramo limpio.
25. **Formato** más cercano soportado, resolución, negativo, nombre de archivo y nombre del zip en cada asset. Personas hiperrealistas tipo UGC, sin look de IA.
26. **Material externo** (pinturas de dominio público, b-roll de Pixabay) con el mismo grado de color de la marca.

## E. Sonido
27. Música grabada (nunca sintetizada) de base, ~10 dB bajo la voz, con ducking; mezcla final **−14 LUFS**.
28. Efectos escasos y en su evento: clic en textos, trazo en gráficos, whoosh en transiciones (frecuencia medida del estilo).

## F. Control de calidad
29. **3 revisiones de movimiento** (Katana) antes de renderizar y sobre el borrador: (1) tiempo y ritmo; (2) espacio y continuidad entre cortes; (3) detalle y pulido.
30. **QA del material entregado:** un fotograma cada 0.5 s de cada video generado (manos, objetos que se funden, identidad, ropa, texto parásito); se usa solo el tramo limpio.
31. **QA medido** (Edit Studio): cortes en el beat, volumen y fotogramas; se dice lo que se midió, sin prometer «perfecto».
32. **Entrega:** final 1080×1920 + versión comprimida para redes.

## G. Herramientas que forman parte de todas las skills
- **Edit Studio** (plugin de Higgsfield, `plugins/edit-studio/`): movimientos, géneros, ediciones puntuales, QA. Su `edit-gen` no se usa (regla 2).
- **Katana** (método, `docs/katana/`): análisis con mapa de energía, prompts en 7 bloques, 3 revisiones, QA.
- **Remotion** (render principal), **HyperFrames** (clonar animaciones, bloques), **MCP Playwright** (buscar en internet), **ffmpeg**.
- **rea-video** (solo en la creación de estilos): desglose de referencias; nunca su remake con IA ni su promoción.


---

# Empieza aquí · Crear estilos de edición

Con esta skill conviertes 10–20 videos de un creador en una skill de edición completa en su estilo, igual que la de Arthur Brooks.

## Instalar (una vez)
| Dónde | Qué haces |
|---|---|
| **Claude Code** (recomendado: ejecuta todo) | Copia esta carpeta a `.claude/skills/crear-estilo-edicion/` y, dentro de `system/`, ejecuta `bash instalar.sh` |
| **Claude.ai** | Sube el zip en Ajustes → Capacidades → Skills (el análisis de video necesita ejecutar código: mejor Claude Code) |
| **ChatGPT / Gemini** | Sube los archivos de `knowledge/` a un GPT, Proyecto o Gem y pega las instrucciones de `MODELOS.md`. Para ejecutar las fases usa Codex o Gemini CLI con `system/` |

## Primer mensaje
Copia el prompt 1 de `PROMPTS.md`, pon el nombre del creador y la carpeta con sus videos.

## Reglas generales
`REGLAS_GENERALES.md` se aplica al crear el estilo y va dentro de cada skill de estilo, junto con el plugin Edit Studio de Higgsfield y el método Katana.

## Qué recibes al final
`dist/<estilo>-editing.zip`: la skill del estilo nuevo (reglas con evidencia, biblioteca de animaciones con ID, referencias desglosadas, tokens del render, panel por beats y sistema). Se usa igual que la de Arthur.


---

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
