---
name: nick-saraev-editing
description: Edita reels verticales (25–55 s) en el estilo de Nick Saraev — lienzo oscuro o claro, título con caja azul, una VENTANA enmarcada con asas tipo Figma que muestra la herramienta (capturas, chats, cifras, listas), él en un recuadro redondeado abajo, subtítulo de 1–3 palabras que se enciende palabra a palabra y cierre «comment PALABRA». Incluye panel A/B/C, capturas web reales, prompts del material, borrador y render. Para herramientas, IA, software y tutoriales rápidos con cualquier modelo.
---
# Editar como Nick Saraev

Entrenada con 20 reels (≈340 escenas medidas).

## Idea central
**La herramienta es la protagonista; él es el narrador.** La pantalla es un lienzo de diseño: arriba la ventana con lo que nombra
(cambia cada 0.5–1.5 s), abajo él en un recuadro. La cara completa solo vuelve para el remate y el cierre.

## Lee primero
1. `REGLAS_GENERALES.md` · 2. `docs/RULEBOOK.md` · 3. `docs/EDIT_LOGIC.md` · 4. `docs/FORMATOS.md` · 5. `library/`

## Flujo (2 paradas)
```bash
python3 pipeline/ves.py new <p> --video CLIP.mp4 --style nick-saraev
python3 pipeline/ves.py all <p> --lang es
python3 pipeline/evidence.py shot <p> URL --id E01      # capturas REALES de la herramienta/página (crédito en CREDITOS.md)
# plan por beats: projects/<p>/beats.json (A/B/C con `ref` de la biblioteca)
VES_STYLE=nick-saraev python3 pipeline/beats.py panel <p> --out projects/<p>/out/panel
# ⏸ PARADA 1 — el humano elige; entregas ASSETS_<p>.md (grabaciones de pantalla que debe hacer + prompts)
VES_STYLE=nick-saraev python3 pipeline/beats.py apply <p> --picks plan.txt
python3 pipeline/ves.py render <p> --draft --force && python3 pipeline/ves.py sound <p> --draft
# ⏸ PARADA 2 — borrador. Con OK: approve → render → sound
```

## Escenas
`n_frame` (base: ventana + cara en recuadro; `face_box:false` = solo ventana; `title1/title2` en el gancho; `canvas` dark/light/white;
`top.kind` media/chat/slots/number/list) · `n_cta` (cierre «comment PALABRA») · `p_punch` (raro).

## Revisión (3 pasadas)
1. **Ventana viva**: ¿algo cambia dentro cada ≤1.5 s y cada nombre propio/cifra aparece en su palabra?
2. **Lienzo**: alterna claro-con-cara / oscuro-sin-cara cada 2–7 s; cara completa ≤15 % del video.
3. **Limpieza**: el subtítulo en el hueco (54 %) nunca sobre la cara; cierre con la palabra en caja.
