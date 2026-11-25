# v03 — "Reverse Engineer Any Viral Video" (rea-video) · 37.61 s

**Formato (labels.json = "?") → propuesta: `tool_demo_frame`** — igual familia que v01: ventana con marco azul + asas, alternando lienzo claro con cara y fondo oscuro desenfocado sin cara; cierre a cámara. Justificación: 34 de 37.6 s son ventana; la alternancia claro/oscuro es regular (~2.5–5 s). [der]

## Estructura del guion
Hook (0–4.4) → qué es (repo, 4.5–7.0) → comparación con REA (7.2–10.1) → pasos: link → despiece → clasificación (10.4–16.0) → qué extrae: captions, cortes, música, SFX (16.1–21.6) → prompt por plano (21.8–25.2) → plan de remake (25.2–29.6) → remake lado a lado (29.6–34.1) → CTA 'comment Video' (34.3–37.61).

## Ritmo [der]
16 escenas / 37.6 s → 2.3 s por escena. Alternancia de lienzo claro(cara)/oscuro(sin cara) en 4.44, 7.04, 10.13, 16.03, 21.64, 25.14, 29.6 → bloques de 2.5–6 s. Contenido de la ventana cambia cada ~1.5 s (≈24 cambios). Cara completa solo al final (34.33). Cada bloque nuevo = ventana que se redibuja con cursor (8 veces).

## Geometría [obs, píxel 1080×1920]
- Título: línea 1 y≈13.5–16.5 %; línea 2 en resaltado azul claro y≈18.5–21.5 %; iconos a x≈5 % y ≈92 %, y≈24 %.
- Ventana hook: x 9.8–89.1 %, y 26.8–50.7 % (79 × 24 %).
- Ventana frame_split: x 8.5–91.1 %, y 13.2–50.7 % (82.6 × 37.5 %) — idéntica a v01.
- Ventana sola: x 8.4–91.1 %, y 13.2–66.3 % (83 × 53 %) — idéntica a v01.
- Subtítulo: y≈54 % con cara, y≈73 % sin cara, y≈72 % en cara completa.
- Recuadro de cara: x 9.8–89.6 %, top y=69.8 %, cortado abajo.
- Caja CTA: x 27.6–72.1 %.

## Paleta [obs]
Lienzo claro #D6D6CF–#E5E5DE · fondo oscuro desenfocado #0D0804–#494949 (cálido) · borde/asas azul #1B88EB · resaltado de título azul claro #A8C8E8 · texto del título #101010 · palabra clave azul · etiqueta rosa 'AI video' · caja CTA azul #1D85DC.

## Captions [obs]
Sans bold 1–3 palabras acumuladas, gris→color. Negra sobre claro, blanca sobre oscuro. Azul en la misma sans: 'reverse engineer', 'viral', 'free', 'videos', 'link', 'filmed', 'AI generated', 'code', 'prompt', 'elements', 'pacing'. Serif itálica azul: 'remake', 'plan'. ~1 destacada cada 2.5 s.

## Texturas [obs]
Cuadrícula + arcos CAD en lienzo claro; en los bloques sin cara el fondo es imagen desenfocada y oscura (no cuadrícula) [inf: copia desenfocada del contenido]. Sin grano.

## Técnicas destacables
1. 0.13–0.67: título write-on; línea 2 como texto seleccionado (resaltado azul claro que se extiende).
2. 4.44, 7.04, 10.13, 16.03, 21.64, 25.14, 29.6: la ventana nace al ~55–60 % y crece ~0.35–0.45 s con un cursor arrastrando una esquina (cada vez una esquina distinta).
3. 9.53: re-dibujo de la ventana dentro del mismo bloque al cambiar de sección (About).
4. 12.1–12.6: el reel 'explota' en 11 tarjetas que forman la rejilla.
5. 14.25/14.75/15.5: tarjetas Filmed / AI video / Code se encienden en su palabra.
6. 22.75–24.0: prompt write-on + botón 'Copied'.
7. 27.75/28.25/29.25: filas Film / Generate / Code en su palabra.
8. 29.6–34.1: Original vs Remake lado a lado con cortes sincronizados.

## Sonido
[der] Pausa a 4.4 s mide −15 dB (más alto que la voz, mediana −18.8) justo en el corte claro→oscuro → [inf] SFX tipo whoosh/swoosh en las transiciones de bloque; también −22 dB en 21.6 (otro corte) y −17.6 dB en 32.9–33.0 (posible audio del propio demo o SFX). Música de fondo: no se detecta (−42 dB en 22.6) [der].

## Reglas copiables
- Alterna: lienzo claro + cara para explicar/anunciar; fondo oscuro desenfocado sin cara para enseñar detalle.
- Cada bloque nuevo redibuja la ventana con cursor (crece desde ~60 %, 0.4 s).
- La geometría no cambia nunca: 13.2–50.7 % con cara, 13.2–66.3 % sin cara.
- Despiece visual para 'break down'; tarjetas que se encienden para clasificaciones.
- Antes/después lado a lado para el clímax.
- CTA: 'comment' itálica + palabra en caja de selección azul.
