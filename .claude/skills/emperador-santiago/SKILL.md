---
name: emperador-santiago
description: Editar videos de Santiago con su sistema "Emperador Santiago · Edición de Videos": editor rápido (planes con cortes, subtítulos, zooms, gráficos, pixelfx, corona 3D, b-roll), método profesional VES con sus 3 STOPs (estilos Arthur Brooks y los que se creen), laboratorio de 9 fases para crear estilos nuevos a partir de videos de un creador (skill crear-estilo-edicion), rea-video, Edit Studio, Katana, motion graphics con HyperFrames y renders con Remotion o HyperFrames. Úsala siempre que Santiago pida editar un clip, crear, entrenar o clonar un estilo, analizar referencias o hacer un motion graphic.
---

# Emperador Santiago · Edición de Videos

## Reglas que mandan sobre todo
Lee y aplica `.claude/skills/crear-estilo-edicion/REGLAS_GENERALES.md` (32 reglas). Las más importantes:
- **Tres pausas**: plan por beats (A/B/C) → assets → vista previa. Nada se renderiza en final sin el OK de Santiago.
  **Aprobar y el render/sonido final solo los hace Santiago** (pestaña Laboratorio, con frase de confirmación). Nunca intentes saltarlo.
- **Nada se genera con IA de pago** (Higgsfield, edit-gen, Seedance, voz, música): escribes los prompts, Santiago genera y entrega un zip.
- Si Santiago describe cómo quiere algo, se hace así.
- Sincronía a la palabra, subtítulos ≤ 5 palabras (clave en color de marca, 2 frames antes de la voz, nunca sobre la boca),
  corte seco por defecto, transiciones separadas ≥ 8 s, zona segura (arriba 14 %, abajo 26 %, derecha 15 %), −14 LUFS.

## Qué herramienta usar

| Santiago pide… | Usa |
|---|---|
| Unir varios clips y quitar silencios / muletillas | **Unión de clips y recortes de silencio**: `santi_unir_clips` (carpeta o lista en orden; se ordena por nombre) o `npm run unir -- carpeta/` |
| "Edita este clip con la plantilla X" | Flujo de plantillas: `plantillas/plantillas.json` + `bridge/src/flujo.ts` (Crear video en el editor). Plantillas Arthur = skill `.claude/skills/arthur-brooks-editing` (SKILL.md, CONTRATO.md, ANIMACIONES.md). Plantillas Kallaway = skill `.claude/skills/kallaway-editing` (pantalla dividida con la prueba arriba; planificador `bridge/src/beats_kal.ts`; capturas reales con `evidence.py`, `kal.py face/check`). Cada skill trae su propio motor en `system/`. Plantillas Skylight = skill `.claude/skills/skylight` (motor propio HyperFrames: `bridge/src/skylight.ts` llama a `scripts/pc.mjs`; proyectos en `data/skylight/`; imágenes libres de Wikimedia con créditos). Plantillas Nick Saraev y Lobo de Wall Street = skills `.claude/skills/nick-saraev-editing` y `lobo-de-wall-street-editing` (motor VES propio, formato por escenas como Kallaway: el planificador general `bridge/src/beats_kal.ts` lee de cada skill sus escenas permitidas, límites, biblioteca y ejemplo; para sumar otra skill de este formato basta añadirla a `SCENE_SKILLS` y a `plantillas.json`). Plantillas Reels Instagram = skill `.claude/skills/instagram-editing` (sin Premiere: motor `bridge/src/reels.ts`, base FFmpeg + capa `emperador/overlay.html` cuadro a cuadro + sonido del kit; proyectos en `data/reels/`). **Plugins comunes a todos los motores** (`bridge/src/plugins.ts`): Katana entra en el plan de cualquier estilo (contrato de bloqueos, rol de cada beat, energía objetivo, 3 revisiones) junto con el género de Edit Studio que toca (estructura, ritmo, movimientos permitidos/prohibidos); al terminar, la **Revisión Katana** mide el MP4 (cambios por segundo, tramos quietos, gancho, pausas, LUFS) y la caja **Efectos (Edit Studio)** aplica efectos con nombre en un momento exacto («crash zoom en 0:07») sobre el video final y deja una versión nueva. En el tablero y la revisión, la caja **Pedir prompts** (`POST /api/flujo/:id/prompts`, base `sugerencia` o `pedido`) escribe prompts de assets en 7 bloques |
| Un reel rápido con subtítulos animados y efectos | Editor rápido: `santi_list_jobs` → `santi_get_brief` → `santi_submit_plan` (estilos `imperial`, `impacto`, …) |
| Una edición premium tipo Arthur Brooks / documental / podcast | **VES**: sigue `.claude/skills/crear-estilo-edicion/system/AGENTS.md` con `santi_ves_overview`, `santi_ves_run`, `santi_ves_read`, `santi_ves_write`, `santi_ves_project` |
| Crear / entrenar / clonar el estilo de un creador (10–20 videos) | Skill **crear-estilo-edicion** (`SKILL.md`, 9 fases con STOPs). Comandos con `santi_ves_run` script `lab` |
| Entender un solo video de referencia | `santi_analyze_reference` (rea-video) → `santi_save_style` |
| Un motion graphic | `santi_motion_ideas` → `santi_motion_brief` → escribir HTML → `santi_render_motion` |
| Nombrar movimientos, géneros, medir un efecto | Skills `edit-director` (268 movimientos, 15 géneros) y método Katana (`crear-estilo-edicion/metodo/`) |

## Dónde está cada cosa
- Editor web + bridge: `web/`, `bridge/` (`npm run dev`). Plan del editor rápido: `bridge/src/schema.ts`.
- VES: `.claude/skills/crear-estilo-edicion/system/` (Python en `tools/.venv`, Remotion propio en `system/render`).
  Estilos VES: `system/styles/*/style.json` (también aparecen como `ves-<id>` en los Estilos de Santi).
- Método: `crear-estilo-edicion/metodo/` (Joseph, Katana, REA niveles de evidencia), `core/` (psicología, técnicas del editor).
- Estilos propios de Santi: `styles/*.json` (firma: `imperial`).

## Comandos
```bash
npm run dev                                         # editor (5173) + bridge (8787)
tools/.venv/bin/python .claude/skills/crear-estilo-edicion/system/pipeline/ves.py all <p> --lang es
tools/.venv/bin/python .claude/skills/crear-estilo-edicion/system/pipeline/style_lab.py estado <estilo>
npm run learn -- ref.mp4 --name "X" --ai claude-cli  # estilo rápido desde 1 video (rea-video)
npm test                                            # Playwright
```
