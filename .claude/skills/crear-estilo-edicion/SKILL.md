---
name: crear-estilo-edicion
description: Crea un estilo de edición de video nuevo a partir de 10–20 videos de referencia de un creador (Arthur Brooks, Iman Gadzhi, Vox, Ali Abdaal…) y lo entrega como una skill lista para editar con cualquier modelo. Método probado con Arthur Brooks — Joseph (tablero + referencias → skill), REA (evidencia), rea-video (desglose toma por toma), Katana (mapa de energía, 3 revisiones) y Edit Studio (movimientos y géneros). Úsala cuando el usuario traiga videos de un creador y quiera editar "como él", o pida entrenar, crear o clonar un estilo de edición.
---

# Skill · Crear estilos de edición nuevos

Convierte una carpeta de videos de un creador en una **skill de edición completa**: reglas con evidencia, biblioteca de
animaciones con ID, tablero de inspiración, tokens para el render y el paquete final (igual que `arthur-brooks-editing`).
**Funciona con Claude, ChatGPT y Gemini**: el proceso vive en estos archivos y en `system/`.

## 0. Contenido
| Archivo / carpeta | Qué es |
|---|---|
| `SKILL.md` | Este proceso (9 fases con STOPs) |
| `EMPIEZA_AQUI.md` · `PROMPTS.md` · `MODELOS.md` · `HERRAMIENTAS.md` | Arranque, prompts por fase, instalación por modelo y herramientas |
| `FORMATOS_DE_DATOS.md` | Cómo se escribe cada archivo del análisis (scenes.json, edit_logic.json, energy.json, ANIMATIONS.json, style.json) |
| `plantillas/` | Briefs de análisis, plantillas de SKILL/RULEBOOK/EDIT_LOGIC/FORMATOS del estilo nuevo, style.json y ejemplos reales |
| `metodo/` | Joseph (10 principios y entrenamiento), Katana y Edit Studio, REA (niveles de evidencia), Katana creative-quality |
| `ejemplo_arthur/` | El caso completo de Arthur Brooks: un video analizado de punta a punta + rulebook, lógica y formatos finales |
| `tools/rea-video/` | rea-video (Apache 2.0): desglose toma por toma, VIDEO.md |
| `system/` | VES: `pipeline/style_lab.py` (orquestador de este proceso), `reverse/` (análisis), render y empaquetado |

## 1. Reglas generales: en la creación Y en la skill que se produce
`REGLAS_GENERALES.md` (32 reglas) se aplica dos veces:
- **Al crear el estilo:** pausas, no generar nada, evidencia, energía medida (Katana), vocabulario de movimientos y géneros (Edit Studio).
- **En la skill de estilo que sale de aquí:** `style_lab.py empaquetar` le incluye SIEMPRE `REGLAS_GENERALES.md`, el plugin **Edit Studio** de Higgsfield (`plugins/edit-studio/`), el método **Katana** (`docs/katana/` + `KATANA_EDITSTUDIO.md`), el instalador de herramientas y el knowledge para GPT/Gem. El `SKILL.md` del estilo debe remitir a ellas (la plantilla ya lo hace) y sus reglas propias solo las concretan (tamaños, colores, transiciones firma), nunca las contradicen.

## 1b. Reglas del proceso
1. **Evidencia o nada (REA).** Cada regla del estilo cita `vNN` + segundo (+ ID de animación). Niveles: `observed` (se ve en un fotograma), `derived` (calculado), `inferred` (interpretación: la confirma el humano), `unknown` (se declara, no se inventa).
2. **Se mira todo.** Cada video se recorre completo en las hojas de estudio (un fotograma cada 1.5 s) y en ventanas de fotograma a fotograma en cada transición. Una miniatura no es haber visto el video.
3. **Pensar como editor** (Joseph): por cada escena, ¿por qué este diseño, estos colores, este efecto, en ESTE momento del guion?
4. **Energía medida** (Katana): cortes, transiciones, texto y movimientos de cámara por segundo. La skill nueva debe reproducir esas tasas.
5. **No se genera nada con IA de pago.** Las escenas que falten se construyen con código (render) o se escriben como prompts.
6. **rea-video solo analiza.** No se usan sus planes para rehacer con IA y se ignora su texto promocional (ChatCut).
7. **El humano aprueba en cada STOP.** El tablero y las reglas `inferred` son suyos.

## 2. Las 9 fases
| # | Fase | Comando / acción | Produce | STOP |
|---|---|---|---|---|
| 1 | **Reunir** 10–20 videos premium del creador (mismo formato vertical) | `style_lab.py nuevo <estilo> --refs CARPETA --creador "Nombre"` | `refs/<estilo>/v01…vNN.mp4`, espacio `styles/<estilo>/` | |
| 2 | **Preparar** evidencia automática | `style_lab.py preparar <estilo> --rea` | por video: `evidence.json` (planos, palabras con tiempo, paleta), `shots/`, `study/` (hojas cada 1.5 s), `.srt`, `rea/VIDEO.md`. Sin modelo de visión configurado, rea-video da ~60 % de confianza: el modelo corre `rea-video review styles/<estilo>/references/vNN/rea`, mira las tomas marcadas y `rea-video apply-review … --by <modelo>` (≈3–4 min por video) | |
| 3 | **Análisis escena por escena** (primer pase) | `style_lab.py briefs <estilo>` → el modelo sigue `BRIEF_ANALISIS.md` por video (4–5 videos por subagente si hay) | `scenes.json` + `breakdown.md` por video | |
| 4 | **Lógica de edición** (segundo pase, fotograma a fotograma en cada transición) | el modelo sigue `BRIEF_LOGICA.md` | `edit_logic.json` + `edit_logic.md` por video | |
| 5 | **Sonido y energía** | `style_lab.py sonido <estilo>` · `style_lab.py energia <estilo>` | `sfx_events.json`, `energy.json`, `ENERGY_SUMMARY.json` | |
| 6 | **Formatos** del creador | `python3 reverse/classify.py refs/<estilo>/*.mp4` (con `VES_STYLE=<estilo>`) + humano etiqueta `labels.json` | `formats/classification.json`, `labels.json` | ⏸ **STOP 1:** el humano confirma los formatos |
| 7 | **Biblioteca + tablero** | `style_lab.py biblioteca <estilo>` → tablero de inspiración con las escenas `quality ≥ 4` agrupadas en principios | `library/<categoría>/<id>.jpg+.md`, `ANIMATIONS.json`; tablero (Whiteboard/Figma) | ⏸ **STOP 2:** el humano revisa el tablero y los principios |
| 8 | **Escribir el estilo** con `plantillas/` | el modelo escribe `styles/<estilo>/skill/SKILL.md`, `RULEBOOK.md`, `EDIT_LOGIC.md`, `FORMATOS.md` y `styles/<estilo>/style.json`; escenas que falten → componentes nuevos en `render/src/` (o clonadas con HyperFrames `reverse-any-video`) | documentos del estilo + tokens del render | ⏸ **STOP 3:** el humano aprueba las reglas |
| 9 | **Probar y empaquetar** | editar 1 video de prueba con la skill nueva (flujo normal con sus 3 STOPs) → corregir reglas → `style_lab.py empaquetar <estilo> --titulo "…"` | `dist/<estilo>-editing.zip` | |

`style_lab.py estado <estilo>` muestra en cualquier momento qué falta por video.

## 3. Calidad mínima para dar el estilo por terminado
- Los N videos con `scenes.json`, `edit_logic.json`, `energy.json` y `sfx_events.json`.
- ≥ 100 escenas de inspiración (`quality ≥ 4`) en el tablero, agrupadas en principios.
- Cada principio del RULEBOOK con ≥ 3 ejemplos `VNN-ANN` y su escena del render.
- Tabla «qué poner según lo que se dice», sincronía medida, transiciones firma por formato y ritmo de `ENERGY_SUMMARY.json`.
- Un video de prueba editado con la skill nueva y aprobado por el humano.

## 4. Errores que ya cometimos con Arthur (no repetir)
| Error | Corrección |
|---|---|
| Tableros incompletos o mal categorizados | Tablero COMPLETO por video + una sección por principio con su desglose |
| Las 3 ediciones salían iguales | Distinguir formatos y transiciones firma por formato; `distinct` de cada video |
| Tipografía «normal» | Medir las voces tipográficas (serif itálica vs sans heavy) y la regla de tamaños (75 %) |
| Gráficos estáticos | Animaciones sincronizadas a la palabra con cámara que sigue el elemento |
| Subtítulos tardíos o que tapan la boca | Adelanto de 2 frames, detección de cara, bajo el mentón |
| Transiciones forzadas | Corte seco por defecto, transiciones solo de su formato y separadas |
| Muchos efectos de sonido | Medirlos: Arthur usa 1 cada 10–20 s |
