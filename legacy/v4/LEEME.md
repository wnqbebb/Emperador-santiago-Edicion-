# Emperador Santiago V4

`index.html` contiene el editor listo para abrir en el navegador o publicar en un alojamiento estático. Los archivos de video se procesan en el dispositivo. No se necesitan cuentas, un servidor de procesamiento ni servicios externos.

## Código fuente

| Archivo | Contenido |
| --- | --- |
| `src/header.html` | Interfaz, estilos y animaciones |
| `src/app.js` | Montaje, recorte, reproductor, color y exportación |
| `src/projects.js` | Importación de ZIP y carpetas, cola, filtros y audio |
| `src/fast.js` | Exportación acelerada mediante WebCodecs |
| `src/mp4.js` y `src/webm.js` | Lectura de pistas MP4 y empaquetado de resultados |
| `src/jszip.js` | Biblioteca incluida para abrir ZIP |
| `src/build.py` | Generación del HTML autónomo |

Después de editar el código, ejecuta `python src/build.py` desde la carpeta principal del proyecto. El resultado queda en `src/Emperador_Santiago.html`. Puedes copiar ese archivo como `index.html` para publicar la versión nueva. La compilación usa la biblioteca estándar de Python 3 y la copia incluida de JSZip.

La exportación elige MP4 o WebM según los códecs disponibles en el navegador. La edición está orientada a Chrome o Edge recientes.
