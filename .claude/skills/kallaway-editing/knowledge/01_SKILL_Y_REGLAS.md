---
name: kallaway-editing
description: Edita reels verticales (30–90 s) en el estilo de Kallaway — pantalla dividida con la PRUEBA arriba y la cara abajo, subtítulo pequeño blanco en el centro de la pantalla, franja del gancho, cortes secos en la palabra, una palabra gigante con la cara completa cada 12–31 s. Incluye buscar la noticia en internet, capturar la evidencia, dar los prompts del material que falta, panel A/B/C por beats, borrador, revisión y render. Úsala para noticias, consejos con prueba y explicaciones de producto, con cualquier modelo (Claude, ChatGPT, Gemini).
---
# Editar como Kallaway

Entrenada con 20 reels (830 escenas medidas, 399 de calidad ≥4). Todo lo de abajo es **medido**; lo que no se pudo medir dice «desconocido».

## Idea central
**Cada cosa que dice se ve en el mismo instante.** La pantalla está partida: arriba la evidencia (lo que prueba la frase), abajo quien habla.
Si no hay prueba que mostrar, vuelve la cara a pantalla completa con UNA palabra gigante. Nada decora: todo demuestra.

## Lee primero (en este orden)
1. `REGLAS_GENERALES.md` — obligatorias (nada de IA de pago: prompts; previa antes de render; subtítulos nunca sobre la cara; comprimir).
2. `docs/RULEBOOK.md` — medidas exactas de cada pieza.
3. `docs/EDIT_LOGIC.md` — qué palabra dispara qué imagen.
4. `docs/FORMATOS.md` — las 11 categorías con cuándo usar cada una.
5. `library/ANIMATIONS.json` + hojas de fotogramas — 399 ejemplos reales para copiar.

## Flujo (2 paradas)
```bash
python3 pipeline/ves.py new <p> --video CLIP.mp4 --style kallaway
python3 pipeline/ves.py all <p> --lang es            # transcribe, corta silencios, subtítulos
# 1) INVESTIGA (solo si es noticia): busca en la web 2–3 fuentes por afirmación; cada cifra del guion debe verse en una captura
python3 pipeline/evidence.py shot <p> URL --id E01   # captura real 1080×940 para la mitad superior (--full = pantalla completa, --tall = para scroll)
# 2) PLAN POR BEATS: escribe projects/<p>/beats.json (3 opciones A/B/C por beat, con `ref` de la biblioteca)
VES_STYLE=kallaway python3 pipeline/beats.py panel <p> --out projects/<p>/out/panel
# ⏸ PARADA 1 — el humano elige en el panel. Entrega también ASSETS_<p>.md: prompts de TODO el material que falta
VES_STYLE=kallaway python3 pipeline/beats.py apply <p> --picks plan.txt
python3 pipeline/kal.py face <p> && python3 pipeline/kal.py check <p>
python3 pipeline/ves.py render <p> --draft --force && python3 pipeline/ves.py sound <p> --draft
# ⏸ PARADA 2 — el humano ve el BORRADOR y devuelve el zip de assets. Solo con su OK:
python3 pipeline/ves.py approve <p> && python3 pipeline/ves.py render <p> && python3 pipeline/ves.py sound <p>
```

## Las 4 escenas (no inventes otras)
| Escena | Qué es | Cuándo |
|---|---|---|
| `k_split` | Evidencia arriba, cara abajo. `top.kind`: `media` (captura/foto/video con resaltado amarillo, etiquetas, flecha), `chat`, `slots`, `number`, `list` | Base: 70–85 % del video |
| `k_pip` | Material a pantalla completa + cara en círculo arriba a la izquierda | El material merece verse grande (demo, foto, artículo) |
| `k_hook` | Franja del gancho encima de la costura, entra desde la derecha | Solo 0–4 s |
| `k_word` | Cara a pantalla completa, punch-in, subtítulo = 1 palabra gigante | Opinión, remate, promesa, CTA. Cada 12–31 s |

## De dónde sale el material (orden de preferencia)
1. **Captura real** de la fuente (`evidence.py`) — titular, tuit, página del producto, documento. Con crédito en `CREDITOS.md`.
2. **Grabación de pantalla** del producto en uso (la pide al humano si hace falta una cuenta).
3. **Material del humano** (sus fotos, su producto).
4. **Gráfico en código** (`chat`, `slots`, `number`, `list`): sólidos, sin IA.
5. **Stock** (`pipeline/stock_api.py`, clave en `PIXABAY_API_KEY`).
6. **Generado**: nunca lo generas tú. Escribes el prompt en `ASSETS_<p>.md` y el humano lo devuelve en `<p>.zip`.

## Revisión antes de entregar (3 pasadas)
1. **Prueba**: ¿cada sustantivo, cifra y nombre propio tiene su imagen en la misma palabra (±0.03 s)?
2. **Ritmo**: arriba cambia algo cada ≤2.5 s; ningún `k_word` a menos de 10 s del anterior; franja 2.2–4.1 s.
3. **Limpieza**: subtítulo nunca sobre ojos ni boca; nada importante bajo la interfaz de la app; sin transiciones decorativas.


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
