# 👑 Emperador Santiago · Edición de Videos

El editor personal de Santiago: edición automática en el navegador para clips verticales: subtítulos animados, cortes, zooms y gráficos de movimiento, dirigido por IA y entrenable en estilos propios.

- **Funciona sin internet**: transcripción (Whisper) y render corren en tu navegador. El modelo se descarga una vez y queda guardado.
- **Con internet / IA**: Claude Fable 5.2 por API, o **tus suscripciones** (Claude, ChatGPT, Gemini) vía MCP o sus CLIs oficiales.
- **Estilos de Santi**: el estilo firma **Imperial Santi** (negro y oro) más Impacto, Minimal Lujo, Neón y Documental. Cada estilo es un JSON (tipografía, ritmo, zooms, gráficos, color, notas). Se "entrena" con videos de referencia.

## Arrancar

```bash
npm install
npm run dev        # web en http://localhost:5173 + bridge IA en :8787
```

Flujo: soltar clip → se transcribe en local → **Edición automática (offline)** o **Dirigir con IA** → revisar en la línea de tiempo → **Exportar** (1080×1920).

## Tres motores de exportación

| Motor | Para qué | Cómo |
|---|---|---|
| **Navegador** | Rápido, sin internet ni bridge | Exportar → Navegador (graba en tiempo real) |
| **Remotion** | Calidad máxima, cuadro a cuadro, H.264 1080×1920 | Exportar → Remotion · Studio: `npm run remotion:studio` |
| **HyperFrames** | MP4 + proyecto HTML/GSAP editable | Exportar → HyperFrames · el proyecto queda en `data/renders/<id>/hyperframes` |

Los tres leen el mismo **plan de edición** (`shared/`), así que se ven igual. El proyecto HyperFrames se puede seguir editando con `npx hyperframes preview <carpeta>` o en la app de escritorio de HyperFrames.

Licencias: HyperFrames es Apache 2.0. Remotion es gratis para personas y empresas de hasta 3 empleados; más grandes necesitan licencia de empresa (remotion.dev/license).

## Pruebas con Playwright

```bash
npm test                         # editor: marca, edición automática, exportación, MCP
npx playwright test styles       # galería: una captura por estilo en qa/estilos/
RENDER=1 npm test -- render      # renders completos con HyperFrames y Remotion
npm run test:ui                  # modo visual
```

## Conectar tus suscripciones

| Suscripción | Opción A: MCP (la IA de la app hace de director) | Opción B: CLI (Santi la llama solo) |
|---|---|---|
| Claude Pro/Max | Claude Desktop o Claude Code | `claude` (Claude Code) |
| ChatGPT Plus/Pro | ChatGPT con conectores MCP / Codex | `codex` (Codex CLI) |
| Google AI | Gemini CLI | `gemini` (Gemini CLI) |

**MCP** — añade esto a la configuración MCP de tu app (Claude Desktop: `claude_desktop_config.json`; Claude Code: `claude mcp add santi -- npx tsx /ruta/a/santi/bridge/src/mcp.ts`; Gemini CLI: `~/.gemini/settings.json`):

```json
{ "mcpServers": { "santi": { "command": "npx", "args": ["tsx", "/ruta/a/santi/bridge/src/mcp.ts"] } } }
```

En Santi pulsa **Enviar a mi suscripción (MCP)** y en tu app escribe: *"edita el trabajo abc123 de Santi"*. La IA lee el brief (`santi_get_brief`), entrega el plan (`santi_submit_plan`) y el editor lo aplica solo.

Herramientas MCP: `santi_list_jobs`, `santi_get_brief`, `santi_submit_plan`, `santi_list_styles`, `santi_save_style`.

## Entrenar un estilo

```bash
npm run learn -- ref1.mp4 ref2.mp4 --name "Mi estilo"
```

Mide cortes por minuto y silencios con ffmpeg; si hay `ANTHROPIC_API_KEY`, Claude Fable 5.2 mira fotogramas y deduce tipografía, colores y animación. El estilo aparece al instante en la web y en el MCP. También puedes pedirle a tu IA, vía MCP, que analice referencias y guarde el estilo con `santi_save_style`.

Más detalle en [docs/ARQUITECTURA.md](docs/ARQUITECTURA.md).
