# Trazabilidad SHA-256 — 2026-10-22

Permite demostrar con qué se calificó: cada archivo cargado guarda su huella y cada resultado guarda la huella de la configuración y de los datos usados. Ante un reclamo se puede comprobar que los archivos y claves son los mismos con los que se calculó.

Se portó desde la rama `feat/calificacion-pj` (ver más abajo qué se cambió respecto a ella).

## Qué se guarda

| Dónde | Qué |
|---|---|
| Cada archivo de identificadores, respuestas y claves | `sha256` y `fileSize` de los bytes originales (en claves, además la huella del archivo de identificación) |
| Cada resultado calculado | `configSha256`: proceso, valores, plantilla (con su orden), claves del área y correcciones de DNI. `dataSha256`: padrón y hojas de respuestas tal como se cargaron |

Con las mismas entradas las huellas son idénticas, sin importar el orden de carga. Cambiar una letra de la clave, un peso, un valor, un blanco de una hoja o confirmar una corrección de DNI las cambia. La clave de otra área no altera la huella de esta.

## Dónde se ve

- Pestaña Resultados, "Detalles técnicos del cálculo": ambas huellas en bloques de 8.
- Excel de resumen: dos filas con las huellas.
- Listas de archivos cargados: inicio del SHA-256, completo al pasar el cursor.
- Se guardan con el proceso en el historial y en el backup.

## Cómo comprobar un archivo

El SHA-256 de un archivo cargado es el mismo que da `shasum -a 256 archivo.dat` (macOS/Linux) o `Get-FileHash archivo.dat` (Windows).

## Diferencias respecto a la rama `feat/calificacion-pj`

- **Hash de los bytes, no del texto.** Esa rama hasheaba el texto ya decodificado. Los archivos de ScanTools traen un byte `0x1A` al final que se descarta al leer el texto: con ese método el hash no coincide con `sha256sum` (comprobado con los 12 archivos reales del simulacro de Ollachea: los 12 habrían dado otro valor; con bytes coinciden los 12).
- **Nunca un hash falso.** Si no se pueden leer los bytes se guarda vacío; esa rama devolvía el hash de un contenido vacío, que parece válido.
- **Huella de configuración propia de admisión** (valores, plantilla, claves por área, correcciones de DNI), sin excepciones de pregunta ni nota mínima del Poder Judicial.
- **Además, huella de datos** (padrón y hojas), que esa rama no tenía.
- El SHA-256 en JavaScript puro se tomó de esa rama y se verificó contra `crypto` de Node: vectores oficiales, longitudes alrededor de los límites de bloque (55/56/63/64) y 200 contenidos aleatorios. Se mantiene en JavaScript puro porque `crypto.subtle` no existe fuera de contextos seguros (por ejemplo una IP de red local sin HTTPS).

## Backend

- `convocatorias/0013`: `sha256`, `file_size` en las tres fuentes e `identification_sha256` en claves.
- `resultados/0009`: `config_sha256` y `data_sha256` en el área calificada.
- Validación: huella en hexadecimal minúscula de 64 caracteres o vacía; los valores inválidos se rechazan en las fuentes y se descartan (no se guardan como huella) en los resultados. Los clientes anteriores, que no las envían, siguen funcionando.
- **Aviso de fusión:** `feat/calificacion-pj` tiene sus propias migraciones `0012` y `0008` con campos del mismo nombre (`sha256`, `file_size`, `config_sha256`). Si esa rama se fusionara entera, esas migraciones chocarían con estas.

## Pruebas

- Frontend: 22 nuevas (SHA-256, huellas, hash por archivo en identificadores/respuestas/claves, panel y Excel).
- Backend: 12 nuevas (fuentes, resultados e historial, backup).
- Suites: 319 de frontend y 85 de backend; `vite build` correcto.

## Límites

- El padrón no guarda la huella del archivo Excel (no tiene tabla de fuentes); su contenido sí queda cubierto por `dataSha256`.
- Los PDF aún no muestran las huellas.
- Los resultados guardados antes de hoy no tienen huellas: se muestra "No disponible".
