# EDIT_LOGIC · qué palabra dispara qué imagen

| Dice… | Se ve… | Escena |
|---|---|---|
| El gancho (primera frase) | La prueba más rara o fuerte + franja con el titular | `k_split` + `k_hook` |
| Un nombre propio, empresa o producto | Su logo, su página o su foto | `k_split` media |
| «Según…», «publicaron», «el estudio» | Captura del titular/artículo con la frase resaltada en amarillo que barre | `k_split` media + `highlight` |
| Una cifra | La cifra en la fuente (resaltada) o cifra gigante amarilla | media + `highlight` · `number` |
| Una comparación (antes/después, A vs B) | Dos cifras enfrentadas; la primera se apaga cuando entra la segunda | `number` + `vs` |
| Una lista («primero… segundo…») | Número grande 0.4–0.8 s y luego un plano por elemento | `number` → media |
| Varias cosas seguidas («la costura, el botón, la tela») | Un corte por palabra, dentro de la misma escena | media con `cuts` |
| Lo que dice o pregunta otra persona | Chat/tuit/comentario apareciendo burbuja a burbuja | `chat` |
| Un proceso o «cómo se usa» | Grabación de pantalla del producto; si es largo, a pantalla completa con la cara en círculo | `k_pip` |
| Señala una parte de la imagen | Etiqueta con borde negro + flecha amarilla | `labels` + `arrow` |
| Opinión, remate, promesa («te digo cuáles») | Cara completa + palabra gigante | `k_word` |
| Llamado a la acción | Cara completa y después la palabra para comentar en grande | `k_word` → `number` |
| Cierre | Resumen de lo visto (las mismas piezas juntas) | `slots` · `list` |

## Fórmula de una demostración (4 golpes)
1. Qué es (logo o página) → 2. Qué le pides (prompt/acción) → 3. Qué devuelve (resultado) → 4. Por qué importa (cifra o cara + palabra).

## Reglas de corte
- El cambio cae en el INICIO de la palabra que nombra la cosa (no antes, no después).
- Anuncia → cara. Describe → se muestra. Nunca más de 4 s seguidos sin algo nuevo arriba.
- Si no tienes prueba real de una afirmación, no la ilustres con relleno: usa `k_word` o un gráfico en código.


---

# FORMATOS · las 11 categorías de la biblioteca

| Categoría | Escena del sistema | Uso |
|---|---|---|
| `hook_banner` | `k_split` + `k_hook` | Primeros 2–4 s |
| `split_headline` | `k_split` media (captura) | Titular, artículo, documento |
| `split_social` | `k_split` media o `chat` | Tuit, post, comentarios |
| `split_screenrec` | `k_split` media (video) | Producto o app en uso |
| `split_broll` | `k_split` media | Video o foto real |
| `split_graphic` | `k_split` `slots`/`number`/`list` | Dato, diagrama, lista |
| `face_full_word` | `k_word` | Opinión/remate con palabra gigante |
| `pip_broll` | `k_pip` | Material a pantalla completa con cara en círculo |
| `full_graphic` | `k_pip` con `pip:false` | Gráfico o captura sin cara |
| `aroll_plain` | (sin escena) | Respiro: cara con subtítulo pequeño |
| `title_cta` | `k_word` → `number`/`slots` | Cierre y llamado a la acción |

Variante NO incluida: los videos 3 y 4 son clips de podcast (otro formato). No se usan como referencia de este estilo.
