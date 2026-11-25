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
