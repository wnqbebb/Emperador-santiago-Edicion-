# v05 — «The TeraFab is insane» (84,0 s, 720×1280, 23,976 fps)

**Formato (propuesto; labels.json dice «?»):** pantalla dividida 50/50 (evidencia arriba, él abajo) con punch-ins de cara + palabra grande, tramos de b-roll a pantalla completa con cara en círculo y un recap final en tarjeta. Justificación: 17 de 39 escenas son divididas (el layout más usado) y la costura es fija; 10 son a pantalla completa sin él o con círculo y 13 son cara completa.

## Estructura del guion
- **Hook 0–8.3 s:** «Elon is now creating the biggest building in human history… I don't think people realize just how insane this project actually is» (título + 4 clips + punch-in + montaje rápido).
- **Prueba de tamaño 8.3–18.4:** mapa de Manhattan, «3X BIGGER», «1700 football fields long», «2.5 MILES».
- **Giro 18.4–25.8:** «the wildest part isn't the size… it's the master plan».
- **Historia/causa 25.8–48:** fue a las empresas de chips, solo hay el 2 % de lo que necesita; lista Tesla/SpaceX/Grok/Optimus.
- **Consecuencia 48–68:** fábrica propia, «200 billion AI chips per year», centros de datos en órbita.
- **Recap 68.3–82.7:** «the master plan in summary is this» en 4 pasos. **Cierre 82.7–84:** «Never bet against Elon.» (sin CTA).

## Medidas (observed, fotogramas 720×1280)
- **Costura:** y≈645 px = 50,4 % del alto. Línea recta sin borde ni sombra.
- **Subtítulo pequeño:** sans bold blanca tipo Inter, ~28 px (2,2 % del alto), centrado, línea base y≈693 px (54 %), es decir ~48 px bajo la costura. 1–3 palabras (media ≈2), ~0,5 s cada uno. Sobre fondos claros lleva pastilla gris redondeada. En cara completa sin palabra grande baja a y≈62–66 %.
- **Palabra grande (face_full_word):** 1 palabra, ~62 px, y≈63 %, blanca con glow; la clave en serif itálica («realize», «insane», «companies», «master plan»). Cambio por corte en cada palabra (0,15–0,45 s).
- **Círculo de cara (pip):** diámetro ≈21 % del ancho, centro x≈12 %, y≈7 %; sin borde.
- **Título del hook:** NO es franja roja. Texto «THE TERAFAB / IS INSANE» sans extendida ultra pesada, blanco + «TERAFAB» naranja (#F5A94A aprox.), apoyado sobre la costura (y≈42–50 %); entra con slide desde la derecha (centrado en ≈1,0 s) y dura hasta 2,5 s.
- **Tarjeta del recap:** ≈90 % del ancho × 92 % del alto, esquinas redondeadas, margen negro.

## Ritmo (derived)
- 39 escenas → 2,15 s/escena; 63 cortes → 1 cada 1,3 s. Eventos por 10 s: 15, 13, 8, 9, 6, 9, 8, 6, 3.
- La mitad superior cambia cada 0,6–2,5 s (mediana ≈1,5 s); en listas baja a 0,4–0,8 s.
- `face_full_word`: 2.5, 4.3, 17.7, 25.8, 30.0, 68.3 (cada 8–13 s al principio; ninguno entre 32 y 68 s). En ese hueco usa `aroll_plain` (cara + subtítulo pequeño) cada 4–8 s: 39.6, 43.0, 48.1, 55.7, 59.1, 64.4.
- Todos los cambios de layout son **corte seco** (1 fotograma). Única excepción: destello rojo con glitch 6.26–6.72.

## Paleta y texturas
Negro/azul noche del set con prácticos cian y ámbar; texto blanco; acento naranja solo en el título; rojo-rosa (#D6336C) y verde en el mapa; turquesa/rosa en «3X»; renders blanco sobre negro. Sin grano ni papel. Glow blanco en textos grandes.

## Sonido
Desconocido (no se analizó el audio). Inferred: los cortes en cada nombre de la lista (36.8–39.6) y el slide del título sugieren golpes/whoosh, pero no está verificado.

## Técnicas destacables
1. **0.0–2.5** Hook con 4 clips arriba + título deslizante sobre la costura.
2. **5.3–8.3** Montaje de 6 planos en 3 s a pantalla completa con cara en círculo y destello rojo en «insane».
3. **8.3–13.3** Mapa con cursor de mano: rectángulo rojo del TeraFab sobre Central Park → «3X» → «3X BIGGER».
4. **13.3–17.7** Tipografía cinética por palabra sobre render («1700 *football fields* long», «2.5 MILES» en perspectiva).
5. **25.8–28.0** Punch-in de 9 palabras una a una con cambio de peso («chip» light) y de familia («*companies*»).
6. **36.8–39.6** Lista de 4 empresas = 4 planos a pantalla completa sin él; «Grok|» tecleado sobre blanco.
7. **61.9–64.4** Cifra clave «*200 billion* AI chips per year» con slide sobre 3 planos de fábrica.
8. **70.6–82.7** Recap en tarjeta redondeada sin él: 4 pasos, 9 planos, subtítulo en pastilla.

## Reglas copiables
- Costura al 50 %; subtítulo de 1–3 palabras ~48 px por debajo, nunca sobre la cara.
- Anuncia/opina → cara completa con palabra grande; describe → mitad superior con el objeto nombrado.
- La palabra clave del punch-in cambia de fuente (serif itálica), no de color.
- Cada sustantivo de una lista recibe su propio plano, cortado exactamente en la palabra.
- Las cifras se escriben arriba como titular (número en itálica o extendida + unidad en sans) y entran 0,1–0,25 s después de decirse.
- Tras un tramo muy rápido, un gráfico lento y explicativo (mapa) para bajar el pulso.
- El resumen final cambia de formato (tarjeta sin él) para que se note que es recap.
- Cerrar con sentencia a cámara, sin CTA.
