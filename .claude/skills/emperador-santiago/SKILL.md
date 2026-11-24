---
name: emperador-santiago
description: Editar videos de Santiago con su sistema "Emperador Santiago · Edición de Videos": planes de edición (cortes, subtítulos, zooms, gráficos, efectos pixelfx, corona 3D, b-roll), Estilos de Santi, aprender estilos de videos de referencia con rea-video, motion graphics con HyperFrames y renders con Remotion o HyperFrames. Úsala cuando Santiago pida editar un clip, crear o ajustar un estilo, analizar un video de referencia o generar un motion graphic.
---

# Emperador Santiago · Edición de Videos

El sistema vive en este repositorio. Todo gira alrededor de un **plan de edición** (`bridge/src/schema.ts` → `PlanSchema`):
segmentos que se conservan, palabras resaltadas, zooms y gráficos (`title`, `lowerThird`, `emojiPop`, `highlightBox`,
`counter`, `progress`, `pixelfx`, `intro3d`, `broll`). El editor web, Remotion y HyperFrames renderizan el mismo plan.

## Herramientas MCP (servidor `santi`, ver `.mcp.json`)

| Para | Herramienta |
|---|---|
| Editar un clip que Santiago envió desde el editor | `santi_list_jobs` → `santi_get_brief` → `santi_submit_plan` |
| Aprender un estilo de un video de referencia | `santi_analyze_reference` (rea-video) → leer el resumen → `santi_save_style` |
| Ver / crear estilos | `santi_list_styles`, `santi_save_style` |
| Motion graphic nuevo | `santi_motion_ideas` (inspiración) → `santi_motion_brief` → escribir el HTML → `santi_render_motion` |

## Reglas de la marca

- Estilo firma: **Imperial Santi** (`styles/imperial.json`): negro y oro (#E9B949), Oswald en mayúsculas, ritmo alto.
- Español, tono de autoridad y ambición. Cierre con rótulo `Emperador Santiago|Sígueme para más` cuando encaje.
- Efectos especiales con moderación: máximo uno cada 6 s; `intro3d` solo como apertura.

## Comandos

```bash
npm run dev                                   # editor (5173) + bridge (8787)
npm run learn -- ref.mp4 --name "X" --ai claude-cli   # estilo desde un video con rea-video
npm test                                      # Playwright
RENDER=1 npm test -- render                   # renders completos
```

Para trabajo profundo con cada motor, usa las skills instaladas: `remotion-best-practices`, `hyperframes`,
`rea-video`, `pixelfx`, `webapp-testing`.
