# EDIT_LOGIC · qué palabra dispara qué cambio

| Dice… | Pasa… | Escena |
|---|---|---|
| La primera frase | Asentamiento de zoom desenfocado; si hay cifra o promesa, va en grande | apertura + `p_word` |
| Conector de bloque («Luego», «Ahora», «Y aquí», «Pero») | Golpe de zoom | `p_punch` |
| La palabra con más carga de la frase | Golpe de zoom, o esa palabra en grande | `p_punch` · `p_word` |
| Un concepto con nombre («deep work», «la tercera») | El concepto en grande (serif itálica si es cita o idea) | `p_word` serif |
| Una cifra | Contador que sube en 0.6–0.9 s | `p_word` count · `p_full` number |
| «Paso 1… paso 2…» / un proceso | El bloque de gráfico: un nodo por paso, entra con la palabra | `p_split` flow |
| Varias cosas concretas seguidas | Tarjetas de foto, una por palabra | `p_split` cards |
| Lo que la gente cree y es falso | La frase entre comillas se tacha | `p_full` strike |
| Una historia o anécdota | El video se encoge a tarjeta | `p_card` |
| Explicación larga sin giro | NADA: cara, subtítulo y zoom lento (10–25 s) | — |
| Cierre | Última frase a cámara; si el humano quiere CTA, tarjeta con rótulo | `p_card` |

## Reglas
- La palabra grande entra 0.1–0.3 s DESPUÉS de empezar a decirse (no antes).
- Nunca dos recursos a la vez: o golpe de zoom, o palabra, o gráfico.
- Un solo bloque de gráfico por video. Si dudas entre mostrar y no mostrar, no muestres.
