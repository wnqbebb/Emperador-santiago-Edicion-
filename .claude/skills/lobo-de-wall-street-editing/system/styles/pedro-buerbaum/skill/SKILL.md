---
name: pedro-buerbaum-editing
description: Edita reels verticales (30–140 s) en el estilo de Pedro Buerbaum — busto parlante minimal y elegante en plano único cuyo zoom nunca para, subtítulo fino y pequeño en el centro, palabra grande color arena detrás de la cabeza, golpes de zoom en la palabra con carga, un bloque de gráfico de línea fina sobre negro y video en tarjeta redondeada. Incluye panel A/B/C por beats, prompts del material que falta, borrador, revisión y render. Úsala para contenido de negocios, ventas y marca personal con cualquier modelo (Claude, ChatGPT, Gemini).
---
# Editar como Pedro Buerbaum

Entrenada con 20 reels (495 escenas medidas). Todo lo de abajo es **medido**; lo que no se pudo medir dice «desconocido».

## Idea central
**Menos es más caro.** Una sola toma, casi sin cortes. La atención se sostiene con tres cosas sutiles: el zoom que nunca se detiene,
un golpe de zoom cuando la frase pesa, y UNA palabra grande que aparece detrás de él. El gráfico es la excepción, no la regla.

## Lee primero (en este orden)
1. `REGLAS_GENERALES.md` — obligatorias (nada de IA de pago: prompts; previa antes de render; subtítulos nunca sobre la cara; comprimir).
2. `docs/RULEBOOK.md` — medidas exactas de cada pieza.
3. `docs/EDIT_LOGIC.md` — qué palabra dispara qué cambio.
4. `docs/FORMATOS.md` — las 10 categorías y los 4 formatos de video.
5. `library/ANIMATIONS.json` + hojas de fotogramas — 495 ejemplos reales.

## Flujo (2 paradas)
```bash
python3 pipeline/ves.py new <p> --video CLIP.mp4 --style pedro-buerbaum
python3 pipeline/ves.py all <p> --lang es
# PLAN POR BEATS: escribe projects/<p>/beats.json (3 opciones A/B/C por beat, con `ref` de la biblioteca)
VES_STYLE=pedro-buerbaum python3 pipeline/beats.py panel <p> --out projects/<p>/out/panel
# ⏸ PARADA 1 — el humano elige en el panel. Entrega también ASSETS_<p>.md con los prompts del material que falte
VES_STYLE=pedro-buerbaum python3 pipeline/beats.py apply <p> --picks plan.txt
python3 pipeline/matte.py <p>        # recorta a la persona para que la palabra quede DETRÁS de la cabeza (o delante si no hay aire)
python3 pipeline/ves.py render <p> --draft --force && python3 pipeline/ves.py sound <p> --draft
# ⏸ PARADA 2 — el humano ve el BORRADOR. Solo con su OK:
python3 pipeline/ves.py approve <p> && python3 pipeline/ves.py render <p> && python3 pipeline/ves.py sound <p>
```

## Las 5 escenas (no inventes otras)
| Escena | Qué es | Cuánto |
|---|---|---|
| (sin escena) | Él a cámara con subtítulo fino; el zoom deriva solo | 30–45 % del video |
| `p_punch` | Golpe de zoom +6–14 % en 0.2–0.6 s | uno cada 11–19 s |
| `p_word` | Palabra/cifra grande color arena detrás de la cabeza (serif itálica para conceptos, contador para cifras) | cada 5–15 s, 1–5 s |
| `p_split` | Panel negro arriba con gráfico de línea (`flow`, `number`, `cards`, `strike`), él abajo | UN bloque, ≈18–20 % |
| `p_full` | Gráfico sobre negro con cuadrícula, sin él | raro, 2–5 s |
| `p_card` | Video en tarjeta redondeada sobre negro, rótulo serif | un tramo o todo el video |

## Material
Casi todo se dibuja en código (palabras, flujos, cifras, tarjetas). Fotos para las tarjetas: del humano, o stock en BLANCO Y NEGRO
(`pipeline/stock_api.py`), o generadas por el humano con el prompt que escribes en `ASSETS_<p>.md`. Tú nunca generas con IA de pago.

## Revisión antes de entregar (3 pasadas)
1. **Calma**: ¿hay tramos de 10–25 s solo con cara y subtítulo? Debe haberlos. Si todo se mueve, sobra.
2. **Peso**: cada `p_punch` y cada `p_word` cae en la palabra con más carga del beat, no en una cualquiera.
3. **Limpieza**: subtítulo nunca sobre ojos ni boca; palabra grande no repite el subtítulo; sin transiciones decorativas; sin efectos de sonido salvo en la entrada del bloque gráfico.
