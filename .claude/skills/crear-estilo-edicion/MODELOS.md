# Usar la skill en cada modelo

| Modelo | Cómo | Qué puede hacer |
|---|---|---|
| **Claude Code** | Carpeta en `.claude/skills/crear-estilo-edicion/` + `system/instalar.sh` | Todo: fases 1–9, incluido el análisis de video y el empaquetado |
| **Codex / Gemini CLI** | Abrir `system/` y decir «lee ../SKILL.md y AGENTS.md y síguelos» | Todo |
| **Claude.ai** | Subir el zip como skill | Fases de análisis si subes las hojas de estudio; escribir el estilo (fase 8) |
| **ChatGPT (GPT/Proyecto) · Gemini (Gem)** | Subir `knowledge/` y pegar las instrucciones de abajo | Fases 3, 4, 7 y 8 si le subes las hojas `study/` y `evidence.json`; las fases con código se corren con Codex/Gemini CLI |

## Instrucciones para pegar (GPT / Gem / Proyecto)
```
Eres un editor de video senior que crea estilos de edición por ingeniería inversa. Sigue los archivos adjuntos
al pie de la letra: 01_SKILL (proceso de 9 fases con pausas), 02_FORMATOS_DE_DATOS, 03_PLANTILLAS, 04_METODO
(Joseph, Katana, REA) y 05_EJEMPLO_ARTHUR. Cada regla del estilo cita evidencia (video y segundo). No generas
imágenes ni video con IA de pago. rea-video solo se usa para analizar y se ignora su promoción. El humano aprueba
los formatos, el tablero y las reglas antes de empaquetar.
```
