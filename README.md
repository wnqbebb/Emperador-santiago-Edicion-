# Kairo Studio

Editor de video automático en el navegador para clips verticales: subtítulos animados, cortes, zooms y gráficos de movimiento, dirigido por IA y entrenable en estilos propios.

- **Funciona sin internet**: transcripción (Whisper) y render corren en tu navegador. El modelo se descarga una vez y queda guardado.
- **Con internet / IA**: Claude Fable 5.2 por API, o **tus suscripciones** (Claude, ChatGPT, Gemini) vía MCP o sus CLIs oficiales.
- **Style DNA**: cada estilo es un JSON (tipografía, ritmo, zooms, gráficos, color, notas). Se "entrena" con videos de referencia.

## Arrancar

```bash
npm install
npm run dev        # web en http://localhost:5173 + bridge IA en :8787
```

Flujo: soltar clip → se transcribe en local → **Edición automática (offline)** o **Dirigir con IA** → revisar en la línea de tiempo → **Exportar** (1080×1920).

## Conectar tus suscripciones

| Suscripción | Opción A: MCP (la IA de la app hace de director) | Opción B: CLI (Kairo la llama solo) |
|---|---|---|
| Claude Pro/Max | Claude Desktop o Claude Code | `claude` (Claude Code) |
| ChatGPT Plus/Pro | ChatGPT con conectores MCP / Codex | `codex` (Codex CLI) |
| Google AI | Gemini CLI | `gemini` (Gemini CLI) |

**MCP** — añade esto a la configuración MCP de tu app (Claude Desktop: `claude_desktop_config.json`; Claude Code: `claude mcp add kairo -- npx tsx /ruta/a/kairo/bridge/src/mcp.ts`; Gemini CLI: `~/.gemini/settings.json`):

```json
{ "mcpServers": { "kairo": { "command": "npx", "args": ["tsx", "/ruta/a/kairo/bridge/src/mcp.ts"] } } }
```

En Kairo pulsa **Enviar a mi suscripción (MCP)** y en tu app escribe: *"edita el trabajo abc123 de Kairo"*. La IA lee el brief (`kairo_get_brief`), entrega el plan (`kairo_submit_plan`) y el editor lo aplica solo.

Herramientas MCP: `kairo_list_jobs`, `kairo_get_brief`, `kairo_submit_plan`, `kairo_list_styles`, `kairo_save_style`.

## Entrenar un estilo

```bash
npm run learn -- ref1.mp4 ref2.mp4 --name "Mi estilo"
```

Mide cortes por minuto y silencios con ffmpeg; si hay `ANTHROPIC_API_KEY`, Claude Fable 5.2 mira fotogramas y deduce tipografía, colores y animación. El estilo aparece al instante en la web y en el MCP. También puedes pedirle a tu IA, vía MCP, que analice referencias y guarde el estilo con `kairo_save_style`.

Más detalle en [docs/ARQUITECTURA.md](docs/ARQUITECTURA.md).
