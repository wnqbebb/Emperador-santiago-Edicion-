# Empieza aquí · Crear estilos de edición

Con esta skill conviertes 10–20 videos de un creador en una skill de edición completa en su estilo, igual que la de Arthur Brooks.

## Instalar (una vez)
| Dónde | Qué haces |
|---|---|
| **Claude Code** (recomendado: ejecuta todo) | Copia esta carpeta a `.claude/skills/crear-estilo-edicion/` y, dentro de `system/`, ejecuta `bash instalar.sh` |
| **Claude.ai** | Sube el zip en Ajustes → Capacidades → Skills (el análisis de video necesita ejecutar código: mejor Claude Code) |
| **ChatGPT / Gemini** | Sube los archivos de `knowledge/` a un GPT, Proyecto o Gem y pega las instrucciones de `MODELOS.md`. Para ejecutar las fases usa Codex o Gemini CLI con `system/` |

## Primer mensaje
Copia el prompt 1 de `PROMPTS.md`, pon el nombre del creador y la carpeta con sus videos.

## Reglas generales
`REGLAS_GENERALES.md` se aplica al crear el estilo y va dentro de cada skill de estilo, junto con el plugin Edit Studio de Higgsfield y el método Katana.

## Qué recibes al final
`dist/<estilo>-editing.zip`: la skill del estilo nuevo (reglas con evidencia, biblioteca de animaciones con ID, referencias desglosadas, tokens del render, panel por beats y sistema). Se usa igual que la de Arthur.
