# 👑 Emperador Santiago · Edición de Videos

El editor personal de Santiago: edición automática en el navegador para clips verticales: subtítulos animados, cortes, zooms y gráficos de movimiento, dirigido por IA y entrenable en estilos propios.

- **Funciona sin internet**: transcripción (Whisper) y render corren en tu navegador. El modelo se descarga una vez y queda guardado.
- **Con internet / IA**: Claude Fable 5.2 por API, o **tus suscripciones** (Claude, ChatGPT, Gemini) vía MCP o sus CLIs oficiales.
- **Estilos de Santi**: el estilo firma **Imperial Santi** (negro y oro) más Impacto, Minimal Lujo, Neón y Documental. Cada estilo es un JSON (tipografía, ritmo, zooms, gráficos, color, notas). Se "entrena" con videos de referencia.

## Instalar y arrancar

```bash
npm run setup      # todo: paquetes, navegador de Playwright, rea-video (Python) y skills para Claude Code
npm run dev        # web en http://localhost:5173 + bridge IA en :8787
```

Requisitos: Node 22+, FFmpeg y Python 3.10+.

## Qué hay integrado

| Proyecto | Para qué lo usa el Emperador |
|---|---|
| [rea-video](https://github.com/JuneYaooo/rea-video) | Desarma videos de referencia toma por toma (cortes, subtítulos, sonido, look) → crea Estilos de Santi |
| [Remotion](https://github.com/remotion-dev/remotion) + [skills](https://github.com/remotion-dev/skills) | Render de máxima calidad · skills para Claude Code |
| [HyperFrames](https://github.com/heygen-com/hyperframes) | Render + proyecto HTML editable · generador de motion graphics |
| [GSAP](https://github.com/greensock/GSAP) | Animaciones de las composiciones HyperFrames |
| [three.js](https://github.com/mrdoob/three.js) | Corona dorada 3D de apertura (`intro3d`) |
| [pixelfx](https://github.com/patch-gg/pixelfx) | Efectos pixel art: monedas, confeti, fuegos artificiales, ¡POW!, rayo, resplandor |
| [awesome-opus5-5-videos](https://github.com/yihui-dev/awesome-opus5-5-videos) | Biblioteca de 683 ideas de motion graphics (`library/`) |
| [Playwright](https://playwright.dev) | Pruebas del editor y "horneado" de efectos a video transparente |
| [FFmpeg](https://github.com/FFmpeg/FFmpeg) | Audio, medición de ritmo, video con transparencia y volumen estándar (-14 LUFS) |
| **crear-estilo-edicion** (tu paquete) | VES: edición por STOPs, laboratorio de 9 fases, Reglas Generales, Joseph, Katana, Edit Studio, estilos Arthur Brooks |
| [anthropics/skills](https://github.com/anthropics/skills) | Skills para Claude Code: webapp-testing, frontend-design, mcp-builder, skill-creator |

Opcional: `bash scripts/instalar-skills.sh --lemo` instala los 99 estilos de película de
[lemo-opuscar](https://github.com/lemomo-ai/lemo-opuscar). Su licencia es **CC BY-NC 4.0 (no comercial)**.

## Método profesional VES y creación de estilos (crear-estilo-edicion)

La skill **crear-estilo-edicion** viene instalada en `.claude/skills/crear-estilo-edicion/` con todo su sistema (VES):
Reglas Generales (32), método Joseph, Katana, REA, rea-video, Edit Studio, estilos de Arthur Brooks y el laboratorio
de 9 fases. En el editor, pestaña **Laboratorio**:

- **Editar con método VES** — Preparar (Whisper, corte de silencios, paleta, captions bajo el mentón, `plan.html`) →
  ⏸ STOP 1 plan por beats (tú o tu IA escriben `edit_plan.json`) → ⏸ STOP 2 validar + storyboard + hoja de captions →
  borrador → ⏸ STOP 3 **tu aprobación**: aprobar y render final piden que escribas una frase de confirmación.
  Ninguna IA puede aprobar ni renderizar en final por ti.
- **Crear un estilo nuevo** — con 10–20 videos de un creador: reunir, preparar con rea-video, briefs para tu IA,
  sonido y energía, biblioteca + tablero, empaquetar la skill del estilo (`dist/<estilo>-editing.zip`).

Los estilos de VES también aparecen en los Estilos de Santi (`VES · …`) para el editor rápido.

```bash
npm run setup:ves      # Python (Whisper, Demucs, rembg…), Remotion de VES y Edit Studio
```

## Aprender un estilo de un video (rea-video)

En **Estilos de Santi → Aprender de un video**, sube una referencia. rea-video la desarma y, si tienes una IA conectada,
esa IA convierte el desglose en un estilo completo. También por terminal:

```bash
npm run learn -- referencia.mp4 --name "Estilo Viral" --ai claude-cli
```

El desglose completo queda en `data/analysis/<nombre>/` (`report.html` para verlo, `VIDEO.md` para la IA).

## Efectos y motion graphics

En la pestaña **Motion**: botones de efectos (corona 3D y pixelfx) que se insertan donde está el cursor, y el
**generador de motion graphics**: buscas una idea en la biblioteca o escribes la tuya, tu IA escribe la animación
para HyperFrames, se renderiza y la insertas como b-roll.

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
REA=1 npm test -- learn          # aprender un estilo con rea-video
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

Herramientas MCP: `santi_list_jobs`, `santi_get_brief`, `santi_submit_plan`, `santi_list_styles`, `santi_save_style`, `santi_analyze_reference`, `santi_motion_ideas`, `santi_motion_brief`, `santi_render_motion`.

En Claude Code no hace falta configurar nada: `.mcp.json` registra el servidor y `.claude/skills/emperador-santiago` le enseña a Claude el sistema.

## Entrenar un estilo

```bash
npm run learn -- referencia.mp4 --name "Mi estilo" --ai claude-cli
```

rea-video desarma la referencia; con `--ai` tu IA convierte el desglose en el estilo completo (sin `--ai` solo toma el ritmo medido). El estilo aparece al instante en la web y en el MCP. También puedes pedirle a tu IA, vía MCP, que analice referencias y guarde el estilo con `santi_save_style`.

Más detalle en [docs/ARQUITECTURA.md](docs/ARQUITECTURA.md).
