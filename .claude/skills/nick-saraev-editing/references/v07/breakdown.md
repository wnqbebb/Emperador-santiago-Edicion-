# v07 — AI drama ads con Claude + Higgsfield · 39.0 s · 1080×1920 · 30 fps

**Formato (propuesto, labels.json = "?")**: *tool-demo explainer con oportunidad de dinero* — hook de "están contratando" + proceso paso a paso de la herramienta + callback a la oferta + CTA. 10 de 19 escenas muestran UI/ventana; 4 son imagen generada a sangre.

**Estructura**: hook titular + clips + oferta $5,000 (0–4.6) → giro "here's how" (4.6–6.8) → paso 1 conectar (6.8–9.6) → producto + prompt (9.6–15.1) → guion → personaje → consistencia → storyboard → planos → voz → anuncio final (15.1–30.3) → callback: aplicar / pitch (30.3–35.4) → CTA "comment DRAMA" (35.4–39.0).

**Ritmo**: 19 escenas / 39 s = 2.05 s por escena (derivado). Algo cambia dentro de la ventana cada ~0.5–1 s; ráfaga de planos a 0.35 s (26.0–26.75). Cara completa solo en el CTA (35.4–39.0).

## Geometría (medida en 2.0 / 5.5 / 19.0 / 24.5 / 37.8, % del alto)
- Título: línea 1 sans black condensada MAYÚSCULAS negra y 15.8–17.3 %; línea 2 MAYÚSCULAS lima en caja negra #101010 y 19.5–23.4 %. **No hay serif itálica ni iconos** en este título (difiere del patrón general).
- Ventana frame_split: x 8.5–91.5 % (83 %), y 24.5–50.8 % (con título) / 18–51 % (con barra de pestañas a y≈15.5 %).
- Ventana sola: y 29–55 %; documento vertical x 25–75 %, y 12–52 %.
- Subtítulo: 54 % (split), 73 % (sin cara), 57 % (imagen a sangre).
- Recuadro de cara: x 9–91 %, top y≈69.5 %, sangra abajo.
- CTA: "comment" y≈74 %; caja lima y 77–84 %.

## Colores
- Lienzo **verde lima #C8F810** con cuadrícula fina oscura (~10 %) y trazos de construcción (arcos, cotas). Lienzo oscuro #101010 en la sección Higgsfield/voz/anuncio.
- Borde de ventana y cara: línea fina blanca/negra con **asas blancas redondeadas** (esquinas + centros de lado) tipo selección de Figma — no hay borde azul.
- Cajas de palabra clave: **magenta #F82874** con texto blanco MAYÚSCULAS. Caja del CTA lima #D0F810 con texto negro.

## Tipografía y captions
- Sans bold geométrica (tipo General Sans/Satoshi Bold) minúscula, negra en lima, blanca sobre oscuro; 1–3 palabras acumulativas, palabra nueva gris→color.
- 1 palabra clave por bloque en caja magenta MAYÚSCULAS (DRAMA, $5000, CLAUDE, HIGGSFIELD, CONNECTOR, PRODUCT, SCRIPT, CHARACTER, SAME, STORYBOARD, APPROVE, SHOT, VOICEOVER, AD, CHAT, APPLY, PITCH) — ~17 destacados en 39 s.
- Sobre la foto del producto las palabras van en etiquetas blancas individuales.
- CTA: "comment" en letra manuscrita/script (no serif).

## Entradas/salidas
- Cortes secos entre bloques. Recuadro de cara entra deslizando desde abajo (~2 fr, con tinte cian 1 fr a 6.85). Tarjeta de oferta entra desde la izquierda (2.5). Documento entra con leve escala (15.3). Iconos/imagenes pop en huecos. Marco magenta de selección que se dibuja sobre el elemento nombrado.

## Sonido (derivado de RMS)
- Huecos −40/−47 dBFS: sin música audible; sin picos en los cortes → no hay SFX evidentes. Clicks de cursor: desconocido.

## Técnicas destacables
1. 0.0–0.75 titular que se escribe y caja negra que aparece vacía antes del texto.
2. 2.5–3.5 tarjeta de empleo con contador que rueda hasta $5,000.
3. 7.6 / 8.2 iconos que caen en huecos punteados "STEP 1 · CONNECT".
4. 15.0–30.0 barra de pestañas SCRIPT→CHARACTER→STORYBOARD→SHOTS→VOICE→AD como indicador de progreso.
5. 22.0→22.5 match-cut del recuadro de detección de cara (consistencia).
6. 26.0–26.75 ráfaga de 3 planos generados a 0.35 s.
7. 31.6–34.0 callback a la oferta del hook (APPLY → APPLIED, abanico).
8. 37.25 caja lima con asas que aparece vacía y luego "DRAMA".

## Reglas copiables
- El color de lienzo es el de la marca del producto (lata lima = lienzo lima).
- Cada palabra clave = caja magenta; el mismo término se marca en la UI con un marco de selección magenta.
- Pestañas de progreso arriba cuando el proceso tiene ≥5 pasos.
- Cambiar a negro cuando cambia de herramienta; volver a lima con cara para anunciar el siguiente paso.
- Cerrar con callback al hook antes del CTA.
