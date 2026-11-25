# RULEBOOK · Pedro Buerbaum (medido en 20 reels, lienzo 1080×1920)

## Cámara
- Plano único. En 12 de 20 videos no hay ningún corte de cámara; donde hay dos cámaras, cortes secos cada 5.5–7.7 s.
- **El zoom nunca para**: deriva lenta entre 0.92× y 1.10× que cambia de sentido cada 4–15 s (≈0.3–1 %/s).
- **Apertura**: asentamiento de 1.11–1.19× a 1.00× en 3–4 fotogramas, con desenfoque.
- **Golpe de zoom** (`p_punch`): +4–14 % en 0.08–0.6 s con easing, a veces 2–3 fotogramas de blur. Uno cada 11–19 s.

## Subtítulo
- Sans fina/regular, blanco cálido #F8F2F0, sin caja ni contorno, sombra muy suave. 44–54 px (2.3–2.8 % del alto).
- 1–3 palabras en una línea, sustitución seca cada 0.4–0.8 s. Centro a **54–56 % del alto**, sobre el pecho.
- Énfasis = la misma fuente en **bold ≈1.35×** (la referencia no usa color; aquí además va en arena por regla del usuario).
- No repite la palabra que ya está en grande. Desaparece en las pausas.
- En panel dividido sube a ≈41 % (justo bajo el panel). En tarjeta, ≈66–70 %.
- Primer plano muy cerrado: el subtítulo baja bajo el mentón. **Nunca sobre ojos ni boca.**

## Palabra grande (`p_word`)
- Sans bold apretada, 6–7 % del alto (≈125 px), **arena #EBB07B**; lo aún no dicho en #A9815D. En el tercio superior (15–19 %), DETRÁS de la cabeza.
- Entra con desenfoque + fundido 0.15–0.3 s, se llena de izquierda a derecha con la voz, sale igual en ≈0.2 s. Dura 1.1–5 s (media 2.7 s).
- Variantes: serif itálica (conceptos, citas), contador de cifra (0.6–0.9 s), logos monocromos, palabras en relevo.
- Si no hay aire sobre la cabeza, va DELANTE bajo el mentón y sustituye al subtítulo (lo decide `matte.py`).

## Panel dividido (`p_split`)
- Negro #000 de 0 a 33–36.5 % del alto, borde difuminado 25–60 px, sin radio. Él abajo, reencuadrado a ≈0.70–0.75.
- Entra con zoom-blur de 3–4 fotogramas, sale con desenfoque de 5–6. Gráfico de línea de 2–6 px; un cambio cada ≈3 s.
- Tarjeta-foto: proporción 2:3, radio ≈8 % de su ancho, borde blanco 4–6 px.

## Tarjeta (`p_card`)
- 84 % del ancho × 56 % del alto (≈5:6), centrada, radio 32–90 px según formato, fondo negro puro, sin borde ni sombra. No se mueve.
- Rótulo serif itálico montado sobre el borde superior.

## Ritmo y reparto (495 escenas)
cara con subtítulo 154 · palabra grande 110 · pizarra real 67 · tarjeta 49 · golpe de zoom 41 · cierre 21 · panel dividido 17 · gancho 15 · b-roll 11 · gráfico completo 10.
Energía media por segundo: cámara 0.10 · texto 0.065 · corte seco 0.04 · transición 0.04 (cuatro veces más calmado que un reel de cortes rápidos).

## Sonido (medido en 6 reels + niveles en los 20)
- Casi sin efectos: 5 de 6 videos tienen 0–2. Solo un golpe grave en la apertura y otro al entrar al panel dividido.
- Música: cama muy baja o ninguna (pausas a −30/−47 dB con voz a −16 dB). Whoosh en los golpes de zoom: desconocido.
- Cierre sin llamado a la acción en la referencia: termina en la última frase, corte seco o fundido de 0.4 s.

## Colores
Negro #000000 · blanco cálido #F8F2F0 · arena #EBB07B · arena apagada #A9815D · gris de cifra #D5D5D5. Stock siempre en blanco y negro.
