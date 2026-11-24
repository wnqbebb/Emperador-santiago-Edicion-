# Arquitectura de Kairo Studio

```
┌──────────────────────── Navegador (offline) ────────────────────────┐
│  Clip ──► decodeAudio16k ──► Whisper (Web Worker, WebGPU/WASM)      │
│                                  │ palabras con tiempos             │
│                                  ▼                                  │
│   Style DNA ──► autoPlan (local)  o  Plan de la IA  ──► Plan (EDL)  │
│                                  │                                  │
│                                  ▼                                  │
│   render.ts: video + zoom + color + subtítulos + motion ──► <canvas>│
│                                  │                                  │
│                         MediaRecorder ──► MP4/WebM 1080×1920        │
└──────────────────────────────────┬──────────────────────────────────┘
                                   │ http://localhost:8787 (opcional)
┌──────────────────────── Bridge local (Node) ────────────────────────┐
│  /api/plan ─► Claude API (claude-fable-5-2, salida estructurada)    │
│            ─► CLIs con tu suscripción: claude · codex · gemini      │
│            ─► OpenAI / Gemini por clave (opcional)                  │
│  /api/jobs ◄─► servidor MCP ◄─► Claude Desktop / ChatGPT / Gemini   │
│  data/styles, data/jobs (todo en tu disco)                          │
└─────────────────────────────────────────────────────────────────────┘
```

## El contrato: el Plan (EDL)

Toda IA produce lo mismo (`bridge/src/schema.ts`), y el motor solo sabe renderizar eso:

- `segments`: rangos del original que se conservan (lo demás se corta)
- `emphasis`: palabras a resaltar
- `zooms`: punch-ins `{at, dur, scale}`
- `motion`: `title`, `lowerThird` (`"Nombre|Rol"`), `emojiPop`, `highlightBox`, `counter`, `progress`

Separar "quién decide" (IA o reglas locales) de "quién dibuja" (el canvas) es lo que permite cambiar de modelo sin tocar el editor y trabajar sin internet.

## Sobre "entrenar" la IA en un estilo

No es fine-tuning (ni Claude, ni ChatGPT, ni Gemini permiten entrenar sus modelos desde una suscripción). Es mejor y más barato: el **Style DNA** captura el estilo como parámetros medibles + notas, y se inyecta en cada brief. Para afinarlo:
1. `npm run learn` con 3–10 videos del estilo que quieres.
2. Ajusta el JSON en `data/styles/` (o pídeselo a tu IA vía MCP).
3. Guarda planes buenos como ejemplos (siguiente paso del roadmap: few-shot automático).

## Sobre las suscripciones

Las suscripciones de consumo (Claude Pro, ChatGPT Plus, Gemini) no traen clave de API. Las formas legítimas de usarlas son las dos que implementa Kairo: (1) que la app oficial use Kairo como herramienta MCP, o (2) llamar a su CLI oficial, que inicia sesión con tu plan. Para automatización masiva o un producto con usuarios, usa claves de API.

## REA (Reverse Engineer Anything) en este proyecto

[REA](https://github.com/morluto/rea) es un servidor MCP para entender cómo funcionan apps (binarios, Electron, JS, webs). Úsalo como herramienta de **investigación** para el roadmap, no como fuente de código:

```bash
npx rea-agents setup   # registra REA en tu agente (Claude Code, etc.)
```

Preguntas útiles a tu agente con REA conectado:
- "Analiza cómo una app de subtítulos web sincroniza el texto con el audio y resume la técnica."
- "Inspecciona este bundle JS de mi propia app/una app open source de edición y explícame su pipeline de render."

Ten en cuenta los términos de uso de cada servicio: estudiar técnicas está bien; copiar código, marca o assets de productos como Submagic o Captions no. Kairo tiene diseño, estilos y nombre propios.

## Roadmap

1. Waveform y edición manual de segmentos (arrastrar bordes) en la timeline.
2. Exportación exacta cuadro a cuadro con WebCodecs + mp4-muxer (más rápida que tiempo real).
3. B-roll y SFX automáticos (biblioteca local + generación opcional).
4. Few-shot: guardar planes aprobados por estilo y añadirlos al brief.
5. Reencuadre automático de caras (MediaPipe) para clips horizontales.
6. Proyectos en IndexedDB y app de escritorio (Tauri) para empaquetarlo todo.
