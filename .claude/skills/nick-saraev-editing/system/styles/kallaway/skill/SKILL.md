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
