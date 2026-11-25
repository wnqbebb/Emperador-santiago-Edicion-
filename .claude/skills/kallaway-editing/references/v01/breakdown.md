# v01 — «Claude does brain surgery?!» (88.6 s, 720×1280, 23.98 fps)

**Formato propuesto:** pantalla dividida de noticias (evidencia arriba / él abajo) con cortes a cara completa. labels.json dice "?"; lo justifico porque 31 de 51 escenas son split 50/50.

## Estructura del guion
1. **Gancho 0.0–4.05:** titular hablado + franja roja + 5 pruebas visuales.
2. **Promesa 4.05–7.42:** cara completa, palabra grande ("one of the wildest stories").
3. **Contexto 7.42–15.4:** objetivo de la cirugía (b-roll con círculo) y la startup (logo).
4. **Cómo 15.4–35.9:** lo que le dieron a Claude (19 tratamientos, brazo, aguja, cámara), la única instrucción, la ciencia.
5. **Resultado 35.9–58.6:** decisión, tratamiento, tres casos, veterinario humano, ejecución, cuidado.
6. **Significado 58.6–84.7:** hito, ChatGPT hace 4 años, predicción a 10 años (con recap visual).
7. **CTA 84.75–88.63.**

## Medidas (observed, cuadro 720×1280)
- **Costura:** y≈640 px = 50 %. Línea recta, sin borde ni sombra.
- **Subtítulo:** blanco, sans bold, ≈22 px de alto (1.7 %), centrado, y≈692 px (54 %), unos 50 px bajo la costura, sobre el fondo oscuro encima de su gorra. **1–3 palabras** por bloque (media ≈2.1; 334 palabras en ≈160 bloques).
- **Cara completa:** subtítulo baja a y≈62–65 % (pecho). Palabra grande ≈60–65 px, una sola palabra, con glow.
- **Círculo PiP:** diámetro ≈33 % del ancho, centro x≈24 %, y≈12 %.
- **Franja del gancho:** roja oscura, y 552–636 px (alto 84 px), x 33–695 px, esquinas redondeadas; blanco + amarillo-naranja, sans extendida ultra-bold mayúsculas; entra deslizándose desde la derecha (~1.5–2 s) y dura hasta 4.05 s.

## Ritmo
- 51 escenas → **1.74 s/escena**. La mitad superior cambia cada 0.5–2.5 s (mediana ≈1.3 s); máximo 4.8 s.
- `face_full_word` en 4.05, 51.89 y 85.96 (3 veces; separación ≈48 s y ≈34 s). `aroll_plain` (cara completa con subtítulo pequeño) 5 veces más: en total hay cara completa cada 7–16 s.
- **Todos los cambios son corte seco** (50 de 50). No hay slides, zooms de transición ni flashes.

## Paleta y texturas
Negro del set (#0B0B0E), blanco del texto, rojo oscuro de la franja (#8B1A1E), amarillo-naranja (#F5B942), cian/menta de la interfaz (#5ED3C0), naranja de las neuronas (#F08A3C). Texturas: ninguna salvo el fondo rugoso del logo (14.0 s).

## Sonido
No analizado (solo fotogramas): **desconocido**. Se intuye voz continua sin pausas; música y SFX no verificados.

## Técnicas destacables
- 0.0–4.05: cinco pruebas en 4 s bajo una franja fija.
- 1.75: flecha roja dibujada sobre el b-roll para dirigir la mirada.
- 4.05–7.42: palabra grande única con dos palabras en serif itálica (technology, wildest).
- 7.42–12.93: seis b-rolls a pantalla completa con su cara en círculo.
- 17.6–24.4: la interfaz cuenta hasta 19 y rotula brazo/aguja/cámara al nombrarlos.
- 37.83–40.67: clímax, neuronas de naranja a cian a pantalla completa.
- 76.8–84.7: recap de animaciones ya vistas durante la predicción.

## Reglas copiables
- Costura al 50 %; subtítulo de 1–3 palabras a 54 % de altura, nunca sobre la cara.
- Gancho: franja roja de 2 líneas encima de la costura, ≤4 s, con una prueba nueva cada 0.7–0.9 s.
- Cuando anuncia u opina → cara completa; cuando describe → evidencia arriba.
- Cada sustantivo concreto (mouse, 19, needle, camera, three cases) dispara su imagen en la misma palabra (±0.1 s).
- Momento cumbre → evidencia a pantalla completa con cara en círculo.
- Cortes secos siempre; el movimiento vive dentro del material.
- En el cierre, reutiliza las 3–4 mejores animaciones como recap.

Nota de categorías: los dos planos de archivo sin él (67.23–69.07) se etiquetan `full_graphic` por ser pantalla completa sin su cara, aunque son video y no gráfico.
