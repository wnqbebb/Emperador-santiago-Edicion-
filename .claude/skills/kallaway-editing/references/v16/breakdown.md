# v16 — «The Floating AI Data Center» (113,1 s, 720×1280, 30 fps)

**Formato propuesto** (labels.json dice «?»): *explicador de tecnología («cómo funciona») en split*. Presenta una empresa/invento y explica su mecanismo con metraje + diagramas propios. Justificación: frase «Here's how it works» (33,1 s), 3 diagramas de línea diseñados, analogías («lollipop», «bike pump», «battery») y guion en bucles de problema→solución; CTA de «Follow».

## Estructura del guion
1. **Hook 0–8,7 s**: hecho insólito («built a data center floating in the Pacific Ocean») → nombre (Panthalassa) → tesis («a whole new category»).
2. **Contexto 8,7–25,0 s**: qué necesita un centro de datos (electricidad + agua) → en tierra lo bloquean → el océano: no towns / no permits / no grids.
3. **Problema 1 25,0–33,1 s**: no hay enchufes → genera su propia energía.
4. **Cómo funciona 33,1–60,3 s**: lollipop → olas arriba / calma abajo → turbina → bike pump → refrigeración.
5. **Objeción 60,3–75,0 s**: ¿y sin olas? → funciona como batería (sol → viento → olas).
6. **Problema 2 75,0–89,3 s**: ¿cómo llevan la energía a tierra? No la llevan: no anchor / no fuel / no cable → satélite.
7. **Problema 3 89,3–102,2 s**: el océano lo destruye todo → la apuesta.
8. **Cierre 102,2–113,1 s**: fecha («later this year») → impacto para ti → «Follow for more…».

## Ritmo (derived)
- 57 escenas → **1,98 s/escena**; 97 cortes detectados (1 cada 1,17 s). Eventos por 10 s: 12, 12, 9, 7, 7, 8, 9, 8, 7, 9, 10, 2.
- La mitad superior cambia cada **~1,2 s** (mín. 0,5 s; máx. 3,8 s en los diagramas, que se mueven por dentro).
- `face_full_word`: 11 veces (4,7 / 11,5 / 18,3 / 33,1 / 43,0 / 50,0 / 64,3 / 75,0 / 89,3 / 96,9 / 105,3 s) → 1 cada ~10 s; la mitad dura ≤0,8 s (bisagras «which is why», «and that means»).
- Categorías: split_broll 23 · face_full_word 11 · split_graphic 8 · full_graphic 7 · aroll_plain 3 · split_screenrec 2 · hook_banner 1 · pip_broll 1 · title_cta 1.

## Medidas
- **Costura**: y≈639 px de 1280 (**49,9 %**; medido 637–641 según el clip). Sin borde.
- **Subtítulo**: sans bold blanca ~30 px, centrado, y≈680 px (53 %) tanto en split como sobre las tarjetas; y≈850–870 px con cara completa. 1–3 palabras (media ≈2,0), cambia cada ~0,5 s. **Se apaga** durante los rótulos «NO …».
- **Palabra grande**: ~110 px, y≈860 px (67 %); dorado ~#E0B24A («things», «works», «battery», «problem», «making», «robotics»); serif itálica («works», «like», «problem», «Panthalassa»).
- **Título del gancho**: **sin franja ni caja**; «THE FLOATING» blanco / «AI DATA CENTER» dorado ~#D9B45A, sans extendida ultra-bold con sombra, y≈520–630 px. Slide desde la derecha (0→~1,5 s), **dura 3,3 s**, sale por corte.
- **Tarjeta vertical**: x≈54–666, y≈103–1176 px (85 % × 84 %), radio ~24 px, fondo negro. **Tarjeta de diagrama**: x≈47–670, y≈283–994 px.
- **Círculo PiP**: ~250 px (35 % del ancho), centro ≈(150, 190) px, pisando la esquina de la tarjeta.
- **Entradas/salidas**: 57 de 58 transiciones son corte seco. La animación vive dentro de los gráficos (blur-in de rótulos, paneos de diagrama, render 3D).
- **Sonido**: no medido; desconocido.

## Paleta y texturas
Azules marinos del metraje · negro puro de las tarjetas · hueso + azul de línea (~#3F5FC4) con trama de puntos en los diagramas · rojo oscuro en rótulos «NO …» · dorado de énfasis. Halftone solo en diagramas.

## Técnicas destacables
1. **Título sin caja + 4 clips en 3,3 s** (0 / 0,93 / 1,57 / 2,23 s).
2. **Rótulo integrado en la imagen** «PANTHALASSA» (3,85 s) y sello «BLOCKED» con tinte rojo (19,6 s).
3. **Tarjeta sobre negro** para el modo explicación (8,73; 60,33; 99,03 s).
4. **Triple negación apilada** con subtítulo apagado (21,53 / 22,30 / 23,13 s y 79,93 / 81,20 / 81,97 s).
5. **PiP + render 3D largo** de 5,6 s para la metáfora del «lollipop» (33,97 s).
6. **Diagrama animado del mecanismo** en tarjeta cuadrada (46,73–49,97 s).
7. **Diagrama causal con paneo y zoom-out** sol→viento→olas (66,33–70,03 s) y ruta de satélite (85,57–89,33 s).
8. **Lista de daños a 0,75 s por clip** (90,63–96,87 s): naufragios, percebes, tormenta.

## Reglas copiables
- Explicador: alterna metraje real (prueba de que existe) con diagramas propios (para entender); nunca más de 2 diagramas seguidos.
- Abre cada problema con cara + palabra dorada («problem») y resuélvelo con evidencia.
- «No X, no Y, no Z» → tres franjas con rótulo, una por palabra, y apaga el subtítulo.
- Analogía → muéstrala literal 0,7–5,6 s (bomba, chupachups, batería como palabra dorada).
- Usa bisagras de ≤0,6 s a cara completa («which is why», «and that means», «think of it like»).
- Cambia de contenedor (split → tarjeta sobre negro) cuando cambias de modo (noticia → explicación).
- Cierra volviendo al objeto del gancho y un «Follow» hablado con la última palabra en dorado.
