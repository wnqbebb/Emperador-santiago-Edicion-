# v06 — Founder Skill (Claude prueba tu idea con 100 clientes IA) · 45.5 s · 720×1280 · 30 fps

**Formato (propuesto, labels.json = "?")**: *tool-demo explainer* — ventana de producto arriba + cara en recuadro, alternando con ventana sola sobre negro; cierre CTA de palabra clave. Justificación: 13 de 21 escenas muestran la herramienta en ventana.

**Estructura**: hook con título (0–4.4) → remate a cámara (4.4–5.8) → qué es (repo GitHub, 5.8–11.8) → proceso en 6 pasos (junta → competencia → 100 compradores → resultados → reconstruir oferta → plan) (11.8–41.7) → CTA "comment Founder" (41.7–45.5).

**Ritmo**: 21 escenas / 45.5 s = 2.2 s por escena (derivado). El contenido de la ventana cambia cada ~0.5–1.5 s (resaltado, contador, pin, tarjeta) (observado en hojas 4 fps). Cara completa solo 2 veces (4.4–5.8 y 41.7–45.5).

## Geometría (medida en fotogramas 2.0 / 14.0 / 19.0, % del alto salvo indicado)
- Título: línea 1 sans semibold NEGRA a y≈13.8 % (~3 % alto); línea 2 serif itálica blanca en caja azul #0080F8, y 16.4–22 %, ~45 % ancho; iconos pixel-art a los lados (y 17–24 %).
- Ventana en frame_split: x 9–91 % (82 % ancho), y 25.6–50.8 % con título; sin título sube a y 13.1 % (mapa: 13.1–50.6 %).
- Ventana en window_only (negro): x 8–92 %, y 13–66.5 % (~53 % alto).
- Subtítulo: frame_split y≈54 %; window_only justo bajo la ventana y≈73 % (o ≈49 % si la ventana es baja); cara completa y≈73 %.
- Recuadro de cara: x 10.3–89.7 % (79 % ancho), top y≈70.9–71.1 %, sangra por abajo; borde ~1 % ancho, radio ~2 %.

## Colores
- Lienzo claro #E4E8EE (#D8E6EF en esquinas) con **sombra de hojas de palmera** (no hay cuadrícula visible). Lienzo oscuro #000000–#050508 con resplandor azul marino tenue. Lienzo gris oscuro degradado en la escena del repo (5.8–11.8).
- Borde de ventana: azul claro #4F87D4 (claro) / #1052AF + glow (oscuro). Borde cara #4F78D3. Caja título #0080F8. Acento azul de palabras ≈#1E88FF (aprox.).
- Captions: negro #101010 sobre claro, blanco sobre oscuro/cara.

## Tipografía y captions
- Sans semibold (tipo SF Pro/Inter Semibold) para todo; serif itálica (tipo Playfair/Instrument Serif Italic) para palabras clave: Founder Skill, startup team, board, competitors, doubts, change, rebuild, again.
- 1–3 palabras acumulativas; cada palabra entra **gris (~40 %) y pasa a color pleno en ~2 fr**. Cifras ("100", "11", "free", "bought", "profitable") en azul sans.

## Entradas/salidas
- Cortes secos entre bloques (todos los cambios de lienzo son corte). Ventana sobre lienzo claro entra como **rectángulo gris translúcido que se llena** (fade + blur, ~0.25 s). Documento final: blur→nítido + leve escala (~0.3 s). Cambios internos con **blur gaussiano** (8.75, 10.75). Tarjeta de Owen: pop de escala ~30→100 % (0.3 s).

## Sonido (derivado de RMS)
- Huecos entre frases caen a −40/−49 dBFS → **no se detecta música audible**; sin picos en los cortes → SFX de whoosh no evidentes. Desconocido si hay clicks bajo la voz.

## Técnicas destacables
1. 0.0–0.5 título que se escribe por palabra mientras la caja azul crece con "100".
2. 1.75–4.25 rejilla de 100 compradores que se tiñe de azul con contador (dato vivo).
3. 7.6 / 9.0–10.5 resaltado tipo selección de texto en el README sincronizado con cada rol.
4. 15.9 / 16.75 / 17.75 retrato que se enciende y recibe nota al decir el nombre.
5. 26.75 zoom-out de una tarjeta a 100 tarjetas ("every single one").
6. 30.5 tarjeta emergente con la objeción y resaltado de "A loyalty card".
7. 40.75 veredicto que pasa a verde "Profitable".
8. 43.2 CTA "comment" serif + "Founder" degradado cian con glow.

## Reglas copiables
- Alterna lienzo claro (con cara) cuando ANUNCIA un paso y negro (sin cara) cuando DESCRIBE el resultado.
- Cada sustantivo enumerado = un resaltado o elemento nuevo dentro de la ventana (≤1 s de diferencia).
- Cifras en azul sans; conceptos en serif itálica; nunca más de 1 destacado por bloque.
- La cara solo a pantalla completa en el remate del hook y en el CTA.
- Ventana siempre centrada, 82 % de ancho; caption pegado bajo ella.
