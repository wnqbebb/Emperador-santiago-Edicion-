# Prompts por fase

## 1. Arrancar un estilo nuevo
```
Usa la skill crear-estilo-edicion. Quiero un estilo nuevo a partir de los videos de <CREADOR> que están en <CARPETA>
(son <N> videos, los más premium). Nombre del estilo: <estilo-en-minúsculas>.
Haz las fases 1 y 2 (reunir y preparar, con rea-video) y dime cuántos planos y palabras salieron por video.
```

## 2. Análisis (fases 3 y 4)
```
Analiza los videos con BRIEF_ANALISIS.md y luego BRIEF_LOGICA.md, video por video (o en paralelo de a 4–5 videos).
Quiero una transcripción palabra a palabra y un desglose fotograma a fotograma de cada video para estudiar tres cosas:
1) dónde van las animaciones respecto al guion, 2) cómo está compuesto el diseño y qué elementos lo forman,
3) la lógica de la animación: cuánto dura y cómo se siente. Cada afirmación con su evidencia (video y segundo).
```

## 3. Sonido, energía y formatos (fases 5 y 6)
```
Mide el sonido y la energía de los videos y propón los formatos del creador con sus señales.
Dame la tabla de formatos para que yo confirme cuál es cada video.
```

## 4. Biblioteca y tablero (fase 7)
```
Construye la biblioteca de animaciones con IDs y un tablero de inspiración con las escenas de calidad 4–5,
agrupadas en los principios del estilo, con el desglose de cada principio: qué lo compone, fuentes, colores,
tamaños, patrones y por qué funciona.
```

## 5. Escribir el estilo (fase 8)
```
Con las plantillas, escribe SKILL.md, RULEBOOK.md, EDIT_LOGIC.md, FORMATOS.md y style.json del estilo.
Cada regla con evidencia (vNN, segundo, ID). Si falta una escena en el render, constrúyela como componente nuevo.
```

## 6. Probar y empaquetar (fase 9)
```
Edita este clip <video.mp4> con la skill nueva siguiendo su flujo con sus 3 pausas. Después de mis revisiones,
corrige las reglas que fallaron y empaqueta la skill del estilo.
```


---

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
