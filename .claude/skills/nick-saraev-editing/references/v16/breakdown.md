# v16 — "ChatGPT: hasta $500 en créditos API gratis cada mes" (32.2 s, 1080×1920, 30 fps)

**Formato** (labels.json = "?"; propuesta): *tutorial-noticia de herramienta* — cara + ventana de captura con título arriba (hook), bloques de prueba documental en lienzo oscuro y demo de clics, cierre "comment PALABRA". [inferred]

**Estructura del guion:** hook-promesa con cifra (0–3.3) → cara "here's how" (3.3–5.3) → prueba + cifras $100/$200/$500 (5.6–12.2) → usos (12.3–18) → "sin pagar" (18–19.5) → urgencia "caducan" (19.7–23) → cómo se reclama, demo de clics (23.2–27.9) → CTA "comment ChatGPT" (27.9–32).

**Ritmo [derived]:** 19 escenas / 32.2 s = 1.7 s por escena. 10 cortes detectados (18.6/min), pero el contenido de la ventana cambia ~25 veces en 24 s de ventana → **un cambio interno cada ≈1.0 s**. Vuelve a cara completa 2 veces (3.43–5.53 y 28.0–fin) = 26 % del video.

## Geometría [observed, % del alto 1920 / ancho 1080]
| elemento | medida |
|---|---|
| Título L1 "Free API Credits" | sans bold negra, centro y≈13 % (solo 0–3.4 s) |
| Título L2 caja azul | x 7–93 %, y 17.3–24.6 % (#0A88F8), serif itálica bold blanca |
| Ventana (con título) | x 10–90 %, y 25.6–50.7 % (≈25 % alto) |
| Ventana (frame_split sin título) | x 10–90 %, y 12.4–49.8 % (≈37 %) |
| Subtítulo frame_split | centro y≈54–55 % (entre ventana y cara) |
| Recuadro cara | x 5–95 %, y 67.3 %→100 % (sangra abajo), borde #5878D8 ~6 px + glow |
| Lienzo oscuro: cifra grande | y≈13–25 %, ventana y 34.2–66.4 %, subtítulo y 72–76 % |
| Lienzo oscuro: ventana grande (billing) | x 8.7–91.5 %, y 11.6–67.1 % (≈56 %) |
| Cara completa: subtítulo | y≈72 % (sobre el micro, bajo la boca) |
| CTA | "comment" y≈70 %, "“Chatgpt”" y≈73 %, orbe azul x≈93 % y≈62 % |

## Colores [observed, muestreo de píxel]
- Lienzo claro #E3EDF2 (azul-gris) con **sombra de hojas de palmera** difusa; lienzo oscuro radial #3A3A3A→#141414 (viñeta). **Sin cuadrícula visible en este video.**
- Borde de ventana #1D67BF ≈2 px (asas pequeñas en esquinas); borde del recuadro de cara #5878D8 con glow; caja de título #0A88F8.
- Palabra clave en subtítulo #2898F8; cifra grande degradado blanco→#68B8F8 con glow; texto de alerta rojo ~#E03A3A dentro de la captura.

## Subtítulos
1–3 palabras, **acumulativos** (la frase crece palabra a palabra y se vacía al cambiar de sentido); cada palabra nueva entra gris translúcido → blanco en ~2 fr. Sans semibold/bold (tipo Inter/SF), blanca con sombra en oscuro, negra en lienzo claro. Destacados: cifras y adjetivos clave en **sans azul** ("free", "$100", "anything", "expire", "done"); marcas y palabras de matiz en **serif itálica azul** ("ChatGPT", "OpenAI", "plan", "simple").

## Técnicas destacables
1. 0.0–0.5 título write-on letra a letra con blur; sale 3.13–3.40 retrayéndose a la derecha.
2. 7.13–7.47 **whip-scroll con motion-blur dentro de la ventana** como transición entre dos páginas.
3. 7.6 / 8.33 / 9.6–9.8 **cifra gigante con odómetro** ($100→$200→$300→$400→$500) anclada a la fila resaltada de la tabla.
4. 13.67 / 14.33 / ~15.0 **spotlight por tarjeta**: velo gris sobre la UI y solo la tarjeta nombrada queda blanca.
5. 15.6 / 16.73 ventanas sin chrome sobre **fondo = blur de la propia imagen**.
6. 22.5 texto de la captura se pinta de **rojo** en "expire".
7. 24.8–26.5 demo de clics real (cursor, modal fade+scale, highlight, clic).
8. 29.8–30.27 CTA: "comment" serif itálica + palabra con degradado + orbe azul con halo.

## Sonido [inferred]
Lecho continuo bajo en los huecos de voz (−33 a −44 dB RMS; nunca silencio < −40 dB 0.1 s) → música/ambiente muy bajo. Huecos más altos (−28 dB en 8.5, −26 dB en 13.9) coinciden con el odómetro y el spotlight → posibles whoosh/tick. Tipo exacto de música/SFX: desconocido.

## Reglas copiables
- Hook = título 2 líneas (sans + serif itálica en caja azul) + captura real + cara en recuadro, todo en el primer fotograma.
- Alterna **lienzo claro (cara+ventana)** para frases de contexto y **lienzo oscuro (solo ventana)** para pruebas/datos/demo.
- Cada sustantivo dicho debe tener su píxel: resaltado, spotlight, cifra o clic, ≤0.3 s de la palabra.
- Cifras dichas → número gigante con odómetro + resaltado de la fila de origen.
- Cara completa solo para "here's how" y el CTA.
- Subtítulo 1–3 palabras acumulativo, azul para datos, serif itálica para nombres.
