# Nailong FM

Reproductor personal de música en HTML, CSS y JavaScript.

Catálogo: 52 canciones, 41 álbumes y sencillos; 52 audios proporcionados por el usuario e incluidos en la publicación. MONET y Dientes De Fierro se conservan. PERFuMITO NUEVO usa la versión de estudio.

Se verificaron los archivos por decodificación completa y SHA-256, sin recomprimirlos. Las carátulas de catálogo se sirven a 1200×1200 y MONET conserva su imagen original.

Las letras se consultan en LRCLIB mediante referencias por versión y ajustes temporales. Algunas referencias aún requieren una revisión auditiva fina; no se afirma precisión editorial de todas las frases.

Los archivos agregados desde Personalizar se guardan solo en el dispositivo actual. Para compartir más canciones por enlace deben incorporarse a esta publicación y declararse en media.json.

Spotify es la opción principal. Los enlaces de Spotify y Apple Music abren canciones o búsquedas; no conectan cuentas.

Esta exportación contiene los recursos en una única carpeta y conserva los audios sin recomprimir.

Sincronización por frase: 36 marcas revisadas en 16 canciones, asociadas a la marca y huella del texto original. Labios Compartidos usa el cierre recortado del MP3 proporcionado. La caché distingue los cambios de referencia, tiempos y audio local. Los controles manuales se conservan.

Reproducción móvil: usa una ruta HTMLAudio nativa para segundo plano y decks separados para Crossfade/AutoMix con la pantalla activa. Al ocultarse la página devuelve la posición al reproductor nativo. Se respetan las pausas del sistema. El bloqueo físico y las restricciones de cada teléfono requieren comprobación en ese dispositivo.

En Personalizar → Reproducción puedes activar la siguiente canción automática y elegir Sin mezcla, Crossfade o AutoMix suave. La transición se ajusta de 0 a 12 segundos. AutoMix acorta silencios detectados; no sincroniza BPM. Las preferencias, volumen y silencio se guardan en este dispositivo. Los MP3 conservan su calidad original; no se convierten a lossless.

Mi lista permite agregar canciones o una selección de álbum, ordenar arrastrando desde los puntos o con flechas, quitar entradas y reproducir en el orden elegido. Se conserva en este navegador, evita duplicados y se detiene al terminar. Quitar una entrada no borra el audio del catálogo.

Sin conexión: descarga una canción, Mi lista o el catálogo con verificación de bytes y SHA-256. Conserva audio, carátula y letra disponible en CacheStorage; soporta rangos de audio y mantiene las descargas al actualizar la interfaz. Guardadas permite elegirlas sin internet. Cancelar conserva descargas completas; quitar descargas no borra la lista. El navegador puede liberar el almacenamiento.

Métricas: Umami Cloud Hobby, en la cuenta del propietario. Visitas y eventos anónimos de canciones y funciones. No conecta cuentas musicales ni identifica a una persona. Un aviso breve informa del uso de estadísticas; se conservan las preferencias previas de desactivación y se respetan DNT/GPC. No hay grabación de sesiones. Las pruebas locales no se envían; eventos sin internet se conservan hasta 24 horas para el próximo acceso conectado.

Revisión 20261109-4: las canciones guardadas conservan el Blob completo para reproducción nativa; la mezcla móvil usa su URL HTTP con rangos, servida por la caché offline. El cambio de motor espera metadatos completos, conserva la posición y se cancela al buscar, pausar o cambiar canción. Una duración temporal de tres segundos no sustituye al audio nativo ni reduce la barra. Elegir una mezcla activa la siguiente canción; desmarcarla vuelve al motor nativo. Se conservan SHA-256 y los tiempos de letra.

Acceso directo: Personalizar incluye instalación nativa cuando el navegador la ofrece y una guía para Safari/Chrome. El manifiesto tiene ámbito, modo independiente e iconos PNG de 192/512 px; iPhone tiene apple-touch-icon de 180 px. Safari no permite activar la instalación desde JavaScript. El almacenamiento de la app de inicio de iOS puede ser independiente: abrir el icono con internet y comprobar Guardadas, descargando dentro de la app si hace falta. No se instala nada en el sistema sin la confirmación de la persona.

Validación de esta revisión: 83 pruebas automáticas aprobadas. En navegador Chromium con formato y agente móvil: recarga sin internet, Crossfade de MONET a otro audio guardado, avance al segundo 100, AutoMix y avance al 120, y vuelta al motor nativo conservando posición. Esta emulación no sustituye la comprobación final en Safari físico.
