# EDIT_LOGIC · qué palabra dispara qué

| Dice… | Pasa… | Escena |
|---|---|---|
| Responde a alguien («me preguntaron…») | Tarjeta del comentario arriba hasta el primer corte | `l_comment` |
| El remate, la objeción, el beneficio real | Frase en amarillo que se escribe | `captions.special_words` |
| Un objeto concreto (dinero, reloj, contrato) | Ese objeto 3D sobre la cabeza | `l_icon` media |
| Una cifra o un tiempo («60 segundos», «10 veces») | Cifra gigante sobre/detrás de la cabeza | `l_icon` text |
| «Número uno / dos…» | Número amarillo + título | `l_list` |
| Una cosa que se puede fotografiar (look A) | Foto bajo el subtítulo | `l_insert` |
| Algo «como en la película» / una emoción del cliente | Clip de película 1–2 s | `l_movie` |
| Empieza una regla nueva / el remate | Salto de encuadre por corte | `p_punch` (in_s/out_s 0.03) |
| Un proceso (producto → tú → empresa) | Gráfico sobre negro | `l_full` |
| «Sígueme» | Tarjeta de perfil con clic | `l_follow` |

Reglas: nunca dos elementos a la vez; amarillo ≤1 cada 8 s; el elemento entra en la palabra (o 0.1 s antes), nunca después.
