---
name: {estilo}-editing
description: Edita videos verticales cortos en el estilo de {CREADOR}: plan por beats con 3 diseños A/B/C sacados de {N_ANIM} animaciones reales del creador, subtítulos con su regla, sus principios de diseño, animaciones sincronizadas a la palabra, cortes fluidos, paleta por video, prompts de assets y diseño sonoro. Úsala para planificar, construir, revisar y entregar ediciones en este estilo con cualquier modelo.
---

<!-- PLANTILLA: rellena cada {…} y cada «…» con lo que salió del análisis (todo con evidencia: vNN y segundo).
     Mantén la estructura: es la misma de la skill de Arthur Brooks, que ya funciona en Claude, ChatGPT y Gemini. -->

# Skill de edición · estilo {CREADOR}

> **Obligatorio:** `REGLAS_GENERALES.md` (32 reglas: pausas, no generar nada, Joseph, subtítulos, fluidez, prompts de 7 bloques, sonido, QA) se aplica a TODA edición en este estilo. Herramientas incluidas: plugin **Edit Studio** de Higgsfield (`plugins/edit-studio/`: movimientos, géneros, ediciones puntuales, QA) y método **Katana** (`docs/katana/`, `docs/KATANA_EDITSTUDIO.md`). Las reglas de abajo solo las concretan para este creador.

## 0. Qué hay en el paquete
| Carpeta / archivo | Qué es |
|---|---|
| `SKILL.md` | Reglas y flujo (este archivo) |
| `docs/RULEBOOK.md` | Los principios del estilo con ejemplos reales |
| `docs/EDIT_LOGIC.md` | Qué elemento poner según lo que se dice, sincronía, transiciones, ritmo, sonido |
| `docs/FORMATOS.md` | Los formatos del creador y cómo distinguirlos |
| `ANIMACIONES.md` + `library/` | {N_ANIM} animaciones con ID `VNN-ANN` y hoja de keyframes |
| `references/vNN/` | Los {N_VIDEOS} videos desglosados |
| `system/` | Render (Remotion) + pipeline; estilo en `system/styles/{estilo}/style.json` |
| `REGLAS_GENERALES.md` | Reglas obligatorias comunes a todas las skills |
| `plugins/edit-studio/` · `docs/katana/` | Plugin de edición de Higgsfield y método Katana |

## 1. Reglas de oro
1. «Cuándo va la cara y cuándo se muestra» — p. ej. *anuncia → cara; describe → se muestra* (evidencia: vNN 0:00–0:00).
2. «Sincronía palabra → elemento medida» (mediana de `offset_s` de los triggers).
3. «Proporción de cortes secos» (de `ENERGY_SUMMARY.json`) y transiciones firma.
4. El primer borrador está al 60–70 %: se revisa con tiempos exactos.
5. Nunca se renderiza el final sin vista previa aprobada.
6. Si el cliente describe cómo quiere algo, se hace así.
7. Nunca se genera nada con IA de pago: se escriben prompts (7 bloques), el humano genera y entrega un zip.

## 2. Flujo (con STOPs)
Igual que la skill de Arthur: transcripción y corte de silencios (30 ms) → formato y paleta → **plan por beats A/B/C**
(STOP 1) → assets con prompts (STOP 2) → vista previa (STOP 3) → borrador → revisiones → final.

## 3. Qué poner según lo que se dice
| Lo que se dice | Elemento | Escena (render) | Ref |
|---|---|---|---|
| «…» | «…» | `«tipo»` | VNN-ANN |

## 4. Subtítulos
- Palabras por bloque: «…» · fuentes: «…» · tamaño relativo de la clave: «…» · color de la clave: «…» · posición: «…»
- Animación de entrada: «…» · sincronía: 2 frames antes de la voz.

## 5. Fluidez y transiciones
| Formato | Transiciones permitidas | Separación mín. | Eventos visuales / 10 s |
|---|---|---|---|
| «…» | «…» | «…» s | «…» |

## 6. Diseño (tamaño · composición · texturas · formas · colores)
«paleta base, inversiones, texturas, tipografía en 3 voces…»

## 7. Sonido
«música (tipo, nivel bajo la voz), efectos por evento y su frecuencia medida en sfx_events.json»

## 8. Assets
Prompts en 7 bloques (función de cada referencia, contexto, mapa espacial, una acción, cámara, luz/textura, bloqueos);
producto/persona hero primero; lugares vacíos sin personas; generar el doble de lo que sale en pantalla.

## 9. Lo que hace ÚNICO a este creador
«las rarezas de `distinct` de cada edit_logic.json que se repiten en varios videos»
