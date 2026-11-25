# v08 — Zero / 0security (agentes IA que hackean tu app) · 34.5 s · 1080×1920 · 30 fps

**Formato (propuesto, labels.json = "?")**: *tool-demo explainer* (mismo molde que v06): título + ventana + cara en lienzo claro, secciones de demo en negro sin cara, CTA de palabra clave.

**Estructura**: hook (0–4.9) → prueba de autoridad 30+ en Linux (4.9–7.9) → nombre + YC (7.9–11.9) → contraste método viejo (npm audit) (11.9–14.7) → equipo de 3 agentes y cada uno trabajando (14.7–25.8) → informe + fix (25.8–30.3) → CTA "comment Hack" (30.3–34.5).

**Ritmo**: 16 escenas / 34.5 s = 2.2 s por escena (derivado). Ventana cambia algo cada ~0.5–1 s. Cara completa solo en el CTA.

## Geometría (medida en 2.0 / 6.5 / 9.0 / 16.5, % del alto)
- Título: línea 1 sans semibold negra y≈14 %; caja azul #0080F8 con serif itálica blanca y 19–24 %; iconos de app naranja a ambos lados.
- Ventana frame_split: x 8.7–91.3 % (82.6 %), y 26.9–50.8 % con título; y 13.3–50.8 % sin título.
- Ventana window_only: y 13.3–66.4 %.
- Subtítulo: 54 % (split), 73 % (negro), 63 % (cara completa); CTA 74–79 %.
- Recuadro de cara: x 10.2–89.7 %, top y 71.5 %, sangra abajo.

## Colores
- Lienzo claro gris #D0D0D0–#E0E0D8 con **cuadrícula fina** y trazos técnicos (arcos, cotas) — aquí sí hay cuadrícula.
- Lienzo oscuro negro con **mancha cálida desenfocada** (#301008, bokeh naranja-marrón) en la mitad inferior.
- Borde ventana/cara azul (~#4F87D4 / #1052AF con glow en negro). Caja título #0080F8. Acento azul en palabras. CTA degradado naranja/dorado.

## Tipografía y captions
- Sans semibold (tipo SF Pro) 1–3 palabras, gris→color. Destacados: cifras/adjetivos en azul sans (free, 30, open-source, team, live, real, report); conceptos en serif itálica azul (hacker, hackers, proof).
- A 18.75 el caption se lee "backers" en serif: posible errata o forma de la "h" (desconocido).

## Entradas/salidas
- Cortes secos para cambiar de lienzo (4.85, 7.75, 11.87, 25.82, 30.23).
- Ventana nueva en claro: rectángulo blanco/gris translúcido que gana opacidad (~0.25 s).
- Scroll con **motion blur** vertical (5.4) y **contador tipo tragaperras** (5.75–6.0).
- Typewriter del logo (14.75) y **iconos que vuelan a la barra de pestañas** (18.9–19.25, shared-element).
- Glitch RGB en "AI" del título y en la máscara de hacker (4.0) y en la landing (28.5).

## Sonido (derivado de RMS)
- Huecos −32/−39 dBFS (algo más altos que v06/v07, pero sin lecho constante claro); sin picos en cortes → sin SFX evidentes; música: desconocido/no detectada.

## Técnicas destacables
1. 0.75 glitch en "AI Hacks" del título.
2. 4.0 máscara de Guy Fawkes glitch para "like a real hacker".
3. 5.75–6.75 cifra "30+" que rueda, crece, brilla en azul y se subraya su línea.
4. 12.5–13.5 avalancha de npm audit como contraste del "método viejo".
5. 14.75 logo tecleado y 3 agentes que se encienden.
6. 18.9 iconos que vuelan a pestañas → cada agente en su pestaña (19.25 / 20.75 / 22.0).
7. 20.75 inyección SQL tecleada en vivo → "200 OK every customer returned".
8. 32.0 "Hack" con degradado naranja y glow.

## Reglas copiables
- Dato de autoridad = número enorme aislado en negro con glow.
- Para "equipo de N" mostrar N tarjetas que se encienden y luego una pestaña por cada una.
- Contraste antes/después: primero el método viejo ruidoso, luego el nuevo limpio.
- El color del glow del CTA sigue el color dominante del video (naranja aquí, cian en v06).
