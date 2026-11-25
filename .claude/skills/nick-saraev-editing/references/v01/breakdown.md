# v01 — "Set A Trap For AI Copycats" (BLA) · 32.66 s · 1080×1920 30 fps

**Formato (labels.json = "?") → propuesta: `tool_demo_frame`** — demo de herramienta en ventana enmarcada + cara en recuadro, cierre a cámara con CTA de palabra. Justificación: 21 de 33 s son ventana arriba (con o sin cara), solo los últimos 3.7 s son cara completa. [der]

## Estructura del guion
Hook (0–4.4: promesa + título) → nombre de la herramienta (4.6–6.1, pantalla limpia) → qué protege (lista, 6.1–8.5) → cómo se usa (8.6–12.4) → mecanismo (12.5–21.6: señuelos + agentes + contador) → beneficio (21.7–25.8) → gratis/compatibilidad (25.9–28.9) → CTA "comment Trap" (28.9–32.66).

## Ritmo [der]
15 escenas / 32.4 s → 2.2 s por escena. Contenido de la ventana cambia cada ~1.8 s (16 cambios en 29 s: 0, 4.5, 6.1, 8.5, 10.6, 12.3, 13.1, 14.1, 16.5, 21.7, 22.8, 25.0, 25.8, 26.5, 27.3, 28.0). Cara completa solo 1 vez, al final (28.98). Recuadro de cara presente 0–4.4, 8.5–12.25, 21.7–25.85 (se quita cuando hay que leer código).

## Geometría medida (y en % del alto, 1920 px) [obs, medido en píxel]
- Título: línea 1 y 13.9–17.3 % (sans black blanca); línea 2 en caja y 19.4–22.8 %. Escudos a x≈10 % y 90 %.
- Ventana en hook: x 9.8–89.1 %, y 26.8–49.9 % (79 × 23 %).
- Ventana base (frame_split): x 8.5–91.1 %, y 13.2–50.7 % (82.6 × 37.5 %).
- Ventana sola (window_only): y 13.2–66 % (82.6 × ~53 %); con tarjeta contador: ventana 13.2–52.4 % + tarjeta 54–66 %.
- Subtítulo: frame_split y 51.9–56.3 % (centro ≈54 %); sin cara y≈73 % (71.7–74.9 %); cara completa y≈75 % (73.3–76.1 %).
- Recuadro de cara: x 9.8–89.6 % (80 % ancho), top y=69.8 %, se corta en el borde inferior (30 % visible).
- Borde azul ventana/cara: ~5 px (≈0.46 % del ancho).

## Paleta [obs]
Lienzo #0C0C0C–#141414 (moda #080808–#101010) · borde/asas azul #1383E1–#1087EB · caja del título azul marino #0E4070 aprox. · palabra clave azul ≈#1E8BFF · resaltado de código ámbar · fondo de cámara final #B5A0A5.

## Captions [obs]
Sans bold blanca (tipo Inter Bold), 1–3 palabras que se acumulan palabra a palabra; la palabra nueva entra gris y se blanquea en ~2 frames. Destacadas: azul en la misma sans ('protect', 'free', 'simple', 'same'); serif itálica azul ('trap', 'decoy code', 'Claude Code', 'Codex'); serif itálica blanca ('useful'). ~1 destacada cada 2–3 s.

## Texturas [obs]
Cuadrícula fina gris + arcos y reglas tipo plano CAD ('R18', '45°', marcas 10/15/20). Sin grano. Capturas limpias sin grado.

## Técnicas destacables
1. 0.13–0.67 s: título write-on por palabra + caja de selección que se abre; recuadro de cara "dibujado" con cursor como en Figma.
2. 0–4.4 s: el contador TOKENS BURNED ya corre durante el hook (resultado antes de la explicación).
3. 4.40 s: corte a lienzo vacío 1–2 frames y logo + 'BLA' gris→blanco en la palabra 'BLA' (5.0).
4. 6.1–7.7 s: lista de 3 tarjetas que se encienden en su palabra (app / website / video game).
5. 8.53 y 21.73 s: ventana entra al ~70 % y crece arrastrada por el asa con cursor (≈0.35–0.4 s).
6. 16.6–20.5 s: agentes como cursores con nombre (Gemini, Claude, ChatGPT, Kimi) + contador exponencial que se congela en 'useful'.
7. 25.0 s: tarjeta '100%' pop dentro de la ventana en 'any'.
8. 30.3–30.6 s: CTA 'comment' itálica script + palabra en caja de selección con degradado.

## Sonido
[der] Pausa a 4.4 s mide −48 dB → no hay música de fondo audible. [desconocido] SFX: picos de −28 dB en pausas 5.3 s (aparece 'BLA') y 21.6 s (corte) podrían ser whoosh/pop o respiración; no verificable.

## Reglas copiables
- Ventana arriba con borde azul 5 px + asas; cara abajo en recuadro del mismo marco (top 69.8 %), subtítulo entre ambos a y≈54 %.
- Quita la cara cuando hay que leer código; el subtítulo baja a y≈73 %.
- Para anunciar el nombre de la herramienta: lienzo vacío + logo + nombre gris→blanco.
- Listas = tarjetas que se encienden en su palabra.
- Ventanas nuevas entran escalando desde ~70 % como si se arrastrara el asa (cursor visible).
- Cifra que crece (contador) para hacer sentir la consecuencia; congélala en la palabra final.
- Cierre a cámara completa, 'comment' en itálica + PALABRA en caja de selección.
