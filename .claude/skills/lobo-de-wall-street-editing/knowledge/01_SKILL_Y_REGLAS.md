---
name: lobo-de-wall-street-editing
description: Edita reels verticales (20–70 s) en el estilo de Jordan Belfort, el Lobo de Wall Street — él a cámara (celular casual o estudio con micrófono), subtítulo blanco bold sobre el pecho, frase clave AMARILLA que se escribe letra a letra, objetos 3D o cifras gigantes sobre la cabeza, lista numerada amarilla en itálica, fotos insertadas bajo el subtítulo, clips de película y cierre con tarjeta de perfil «Follow → Following». Incluye panel A/B/C, prompts del material, borrador y render. Para ventas, dinero y marca personal con cualquier modelo (Claude, ChatGPT, Gemini).
---
# Editar como el Lobo de Wall Street

Entrenada con 20 reels (392 escenas medidas; v02, v03 y v04 son anuncios de su producto «Tone» y quedan FUERA del estilo).

## Idea central
**Habla directo, y cada promesa se vuelve visible.** El A-roll manda; encima, solo lo que vende la frase: la pregunta del cliente
arriba, el remate en amarillo, la cifra sobre su cabeza, la foto de lo que nombra, la escena de la película que lo confirma.

## Dos looks (elige uno por video)
| Look | Cuándo | Rasgos |
|---|---|---|
| **A · casual** (celular, sofá, coche) | respuestas, historias | subtítulo blanco solo, tarjeta de comentario, fotos insertadas, clip de película con él abajo a la izquierda, sin amarillo |
| **B · estudio** (micrófono, ventanal) | reglas, listas, objeciones | subtítulo de dos niveles con AMARILLO, objetos 3D sobre la cabeza, lista numerada, clips sin recuadro, gráfico 3D sobre negro |

## Lee primero
1. `REGLAS_GENERALES.md` · 2. `docs/RULEBOOK.md` · 3. `docs/EDIT_LOGIC.md` · 4. `docs/FORMATOS.md` · 5. `library/` (392 ejemplos)

## Flujo (2 paradas)
```bash
python3 pipeline/ves.py new <p> --video CLIP.mp4 --style lobo-de-wall-street
python3 pipeline/ves.py all <p> --lang es
# plan por beats: projects/<p>/beats.json (A/B/C con `ref` de la biblioteca) y en edit_plan.json captions.special_words = las palabras del remate (van en amarillo)
VES_STYLE=lobo-de-wall-street python3 pipeline/beats.py panel <p> --out projects/<p>/out/panel
# ⏸ PARADA 1 — el humano elige; entregas ASSETS_<p>.md con prompts (fotos, objetos 3D en PNG sin fondo) y la lista de clips de película que debe conseguir
VES_STYLE=lobo-de-wall-street python3 pipeline/beats.py apply <p> --picks plan.txt
python3 pipeline/ves.py captions <p> && python3 pipeline/ves.py render <p> --draft --force && python3 pipeline/ves.py sound <p> --draft
# ⏸ PARADA 2 — borrador. Con OK: approve → render → sound
```

## Escenas (no inventes otras)
`l_comment` gancho · `l_icon` objeto/cifra sobre la cabeza · `l_list` número de lista · `l_insert` foto bajo el subtítulo ·
`l_movie` clip de película · `p_punch` salto de encuadre · `l_full` gráfico sobre negro · `l_follow` tarjeta de perfil.

## Material
Clips de película o archivo: los consigue el humano (derechos a su cargo); tú indicas qué escena y en qué segundo. Objetos 3D: prompt
para el humano (PNG sin fondo) o iconos del humano. Nunca generas con IA de pago.

## Revisión (3 pasadas)
1. **Venta**: ¿el amarillo cae solo en el remate/objeción/beneficio (≤1 cada 8–10 s)? Si todo es amarillo, nada lo es.
2. **Prueba**: ¿cada cosa concreta que nombra se ve (foto, objeto, clip) en la misma palabra?
3. **Limpieza**: subtítulo nunca sobre ojos ni boca; tarjetas arriba no tapan la cara; cortes secos, sin transiciones decorativas.


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
