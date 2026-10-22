# Alineación de respuestas y espacios en blanco — 2026-10-22

## Objetivo

Corregir dos defectos que hacían que las respuestas de algunas hojas se guardaran o leyeran desplazadas, con puntajes incorrectos. Se detectaron calificando un simulacro real (IES Antonio Raimondi, 179 hojas, plantilla Sociales).

## Síntomas observados

Al comparar los `.dat` originales con lo guardado en la base, 26 de 179 hojas diferían y 25 cambiaban de puntaje:

- 5 hojas perdían los blancos del inicio. Ejemplo: una hoja con 11 blancos iniciales pasaba de 188 a 88 puntos.
- 21 hojas con la columna tipo sin marcar perdían la pregunta 60.
- En una hoja, la autodetección dejaba las respuestas corridas una posición (10 aciertos en lugar de 15).

## Causas

1. **Backend recortaba espacios.** El `CharField` de DRF usa `trim_whitespace=True` por defecto. En las respuestas cada espacio es una pregunta en blanco, así que al guardar se corrían todas las posiciones.
2. **El parser confundía "tipo sin marcar" con "no hay columna tipo".** Si la columna tipo no era P-T, asumía que las respuestas empezaban una posición antes y absorbía el espacio como respuesta 1, dejando fuera la pregunta 60. Además, la autodetección elegía el offset por cantidad de marcas; si la última respuesta era un blanco, había empate y ganaba el offset menor, que era el equivocado.

Ambos defectos se compensaban parcialmente: el servidor borraba el espacio sobrante que había añadido el parser, por lo que en la base solo se veía la pregunta 60 perdida.

## Cambios

### Frontend

- `frontend/src/utils/parsers.js`
  - El offset de respuestas se decide por la columna tipo: letra P-T → la columna existe; letra A-E o `*` → no existe; espacio → ambiguo.
  - Un espacio se resuelve con la disposición del archivo completo (`inferResponseLayout`); sin esa información se asume que la columna existe.
  - Se eliminó la selección por conteo de marcas.
  - `parseResponseLine`, `parseLinkedResponseLine` y `parseAnswerKeyResponseLine` aceptan `options.layoutHint`.
  - `readLinesFromFile` acepta `prepare(lines)` y pasa su resultado como tercer argumento al parser.
  - `detectResponseAnswersOffset` reutiliza `extractLineRemainder` en lugar de duplicar la lectura de la cabecera.
- `frontend/src/composables/useResponses.js` y `useAnswerKeys.js` calculan la disposición del archivo una vez y la pasan a cada línea.

### Backend

- `backend/convocatorias/serializers.py`: `answers` de identificadores, respuestas y claves, y `rawLine`, con `trim_whitespace=False`.
- `backend/resultados/serializers.py`: `answers_raw` y `correct_answers_raw` con `trim_whitespace=False`.

## Pruebas

- Frontend: 12 pruebas nuevas en `parsers.test.js`, incluida una prueba aleatoria de 500 hojas (blancos al inicio, en medio y al final, marcas múltiples, tipo en blanco).
- Backend: 5 pruebas nuevas en `AnswerWhitespacePreservationTests`.
- Las pruebas nuevas fallan con el código anterior y pasan con el actual.
- Suites completas: 200 pruebas de frontend, 54 de backend y `vite build` correctos.
- Verificación con datos reales: las 179 hojas y la clave de 60 respuestas salen idénticas al archivo tras el parser y tras guardar en la base.

## Operación

- Las respuestas ya guardadas con el código anterior pueden estar corridas. Hay que **volver a cargar los archivos de respuestas** de los procesos afectados.
- Los reportes del simulacro se calcularon leyendo los `.dat` por posición fija, por lo que no estaban afectados.

## Padrón: fecha de nacimiento en DD/MM/YYYY

Al probar con el Excel del colegio (formato SIAGIE), el padrón no se guardaba en la base: el backend respondía 400 en las 281 filas porque `fecha_nacimiento` llegaba como `13/01/2014` y la API solo acepta `YYYY-MM-DD`. El padrón quedaba solo en memoria del navegador.

- `frontend/src/composables/useArchives.js`: nuevo `normalizeBirthDate`, usado por `mapArchiveRowToSchema`. Convierte DD/MM/YYYY y DD-MM-YYYY a ISO, conserva ISO y descarta valores imposibles o desconocidos. Un dato opcional inválido ya no impide guardar todo el padrón.
- 5 pruebas nuevas en `useArchives.test.js`.

## Auditoría de integridad al cargar respuestas

Para que un fallo similar no pase desapercibido:

- `auditParsedResponses` (`parsers.js`) revisa cada archivo cargado y avisa si mezcla disposiciones de columna tipo, si una hoja trae caracteres distintos de A-E, `*` o espacio, o si tiene más de 60 respuestas.
- `findStoredAnswerMismatches` compara lo cargado con lo que devuelve la API después de guardar. Los blancos finales no cuentan como diferencia porque no cambian el puntaje.
- `useResponses.js` muestra ambos avisos en el mensaje de importación de la pantalla. Tras guardar, relee `/respuestas/` y avisa si alguna hoja difiere.
- 6 pruebas nuevas en `parsers.test.js`. Probado con los 5 archivos reales de respuestas: sin advertencias.

## Al probar en el navegador

Tras desplegar cambios del frontend hay que recargar la pestaña con recarga forzada (Cmd+Shift+R). Una pestaña abierta antes del cambio sigue ejecutando el parser anterior en memoria y vuelve a guardar las respuestas desplazadas. Tras recargar, volver a cargar padrón, identificadores, respuestas y claves.

## Pendiente conocido

- El importador de padrón (`exceljs` 3.4) falla con libros que contienen tablas con filtros aplicados (`Unexpected xml node in parseClose: filters`). Alternativa actual: guardar una copia con una sola hoja y sin la tabla.
