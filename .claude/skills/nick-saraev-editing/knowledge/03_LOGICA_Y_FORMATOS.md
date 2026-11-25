# EDIT_LOGIC · qué palabra dispara qué en la ventana

| Dice… | En la ventana… |
|---|---|
| El nombre de la herramienta | Fondo blanco + logo/nombre («It's called …»), tecleado o con caja azul que crece |
| «Puedes / hace / te deja…» (una acción) | Grabación de pantalla de esa acción, con cursor o resaltado |
| Una cifra (estrellas, precio, %) | Contador rodante (odómetro) o cifra gigante en tarjeta |
| «Gratis», «free», valor | Palabra en serif itálica con degradado, a veces a cámara |
| Lista («5 plugins») | Tarjeta «Number N» sobre blanco cada 7–10 s |
| Comparación / alternativa a X | Logos de la competencia tachados en rojo #E0342F |
| Un riesgo o fallo | Contador rojo que sube |
| El remate | Cara a pantalla completa 1–2 s |
| «Comenta …» | `n_cta` con la palabra en caja |

Reglas: cada sustantivo concreto tiene imagen en su palabra; nada de cara completa entre dos demostraciones; la ventana nunca se queda quieta más de 1.5 s.


---

# FORMATOS

| Categoría | Escena |
|---|---|
| `hook_title` | `n_frame` con title1/title2 |
| `frame_split` | `n_frame` |
| `window_only` | `n_frame` face_box:false |
| `window_zoom` | `n_frame` top.kind media con cuts/labels/highlight |
| `card_graphic` | `n_frame` top.kind number/list/slots |
| `face_full` / `face_full_word` | sin escena (A-roll) |
| `full_screen_capture` | `n_frame` face_box:false con media a sangre (pendiente de componente propio) |
| `transition` | corte entre `n_frame` con distinto canvas |
| `title_cta` | `n_cta` |
