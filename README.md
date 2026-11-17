# Nailong FM

Reproductor personal en HTML, CSS y JavaScript. Sitio: https://alannloezaa.github.io/nailong-fm/

## Catálogo

67 canciones con audio y 47 álbumes o sencillos. Se retiraron las ocho canciones solicitadas el 16 de noviembre de 2026, sus MP3 y las carátulas que no comparte otra canción. MONET y Dientes De Fierro se conservan. Se agregaron 23 archivos del usuario. Te Quiero usa la versión de estudio y se retiró un minuto de casi silencio al final mediante copia de paquetes MP3, sin recomprimir. También se incluyó Si no te tengo a ti, de Hombres G.

## Reproducción

En laptop se ofrecen Crossfade y AutoMix suave, con 1 a 12 segundos ajustables. AutoMix acorta silencios acotados y no sincroniza BPM. En iPhone, iPad y Android se conserva HTMLAudio nativo y se ofrece un fundido fijo de salida y entrada de unos 3 segundos en total (1.5 + 1.5), sin superposición. Se usan copias AAC-LC a 192 kbps, con margen contra saturación y la misma línea de tiempo, conservando los MP3. No es una integración con Spotify o Apple Music ni audio lossless. El ajuste móvil se aplica al comenzar una canción.

Aleatorio tiene un botón visible junto a los controles superiores y una opción en Personalizar. Reparte artistas, no repite canciones dentro de la vuelta y mantiene el orden para precarga, Siguiente y Anterior. Funciona en el catálogo y en Mi lista. La lista se detiene al terminar; el catálogo puede volver al inicio. Las preferencias se conservan en este dispositivo.

Las letras tienen controles manual, mixto y automático y ajustes asociados a la versión de audio. Se revisaron 21 letras nuevas con anclas de voz y se agregó una letra más por coincidencia de versión y duración. Estas letras se compararon con anclas de palabras sobre el audio aportado y se incluyeron copias sincronizadas locales para evitar que una edición remota cambie los tiempos. Cuesta Abajo tiene audio pero no una letra sincronizada verificada. No se promete precisión editorial de cada frase. Spotify es el enlace principal; Apple Music es secundario. Son enlaces externos y no conectan cuentas.

## Sin conexión

Se puede guardar una canción, Mi lista o el catálogo; se verifican bytes y SHA-256 del MP3 y de su copia con efecto. Actualizar una descarga agrega el efecto conservando el MP3. Las descargas anteriores continúan funcionando sin el efecto hasta actualizarlas. Un fallo en la copia con efecto conserva el audio original y permite reintentar. Quitar una descarga elimina ambas versiones. Se guardan audio, letra disponible y carátula. La actualización mantiene las canciones conservadas y elimina de la caché e IndexedDB las ocho retiradas, sin borrar carátulas compartidas ni las listas restantes. La caché usa rangos de audio para Safari. El navegador puede liberar almacenamiento si falta espacio.

## Acceso directo y apariencia

El icono amarillo de Nailong tiene audífonos lavanda y un vinilo. Personalizar ofrece instalación cuando el navegador la permite o las instrucciones de pantalla de inicio. iPhone requiere confirmar desde Safari; el almacenamiento de la app puede estar separado. Revisa Guardadas al abrir el nuevo icono con internet.

Se conservan los temas oscuro y claro, colores pastel, tono de carátula, fondo, tamaño de texto, lista táctil y panel lateral.

## Estadísticas y validación

Umami registra eventos anónimos con un aviso breve; se respetan DNT/GPC y preferencias previas. No identifica a una persona ni conecta Spotify.

100 pruebas automáticas. Revisión de solapamiento real de dos elementos en Crossfade de laptop; MONET guardado con copia AAC, avance a 100 segundos y siguiente canción sin internet; descargas anteriores conservadas y Te Quiero de estudio. Tamaños de teléfono/tablet en Chromium. La emulación no certifica Safari físico ni las políticas de segundo plano de cada teléfono.
