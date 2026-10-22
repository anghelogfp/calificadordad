# Rediseño de la revisión en la pantalla de resultados — 2026-10-22

## Problema

En la pantalla de resultados los no calificados formaban una lista larga (129 filas iguales, sin paginación ni búsqueda), la misma cifra aparecía hasta 5 veces, todo se mostraba como alarma roja aunque en un simulacro faltar es normal, y el ranking quedaba al final. Además, las hojas cuyo DNI no está en el padrón no figuraban en ningún conteo: quedaban fuera del ranking sin aviso.

## Cambios

**Una sola franja de estado.** Calificados (de N), Ingresantes y Promedio. Se quitaron "Observaciones" (duplicaba el conteo de no calificados), el panel de verificación y el panel rojo de 129 filas.

**Panel "Revisión"** (`ReviewPanel.vue`), colapsado por defecto en una barra de una línea:

| Pestaña | Contenido | Tono |
|---|---|---|
| Hojas sin alumno | Hojas cuyo DNI no está en el padrón, con DNI sugerido y puntaje provisional (`OrphanSheetsTable.vue`) | Ámbar: requiere acción |
| Otras incidencias | DNI inválido o duplicado, sin clave, sin programa, tipo inválido, con "qué hacer" | Ámbar |
| Alumnos sin hoja | Alumnos del padrón sin hoja de respuestas | Gris: informativo |

- Cada pestaña tiene búsqueda y paginación (10 por página).
- La lista de alumnos sin hoja ya no repite motivo ni detalle en cada fila.
- Si solo hay alumnos sin hoja, el panel no habla de errores.
- "Descargar revisión (Excel)" exporta solo la revisión (`exportReviewListToExcel`): hoja "No calificados" y hoja "Hojas sin alumno" con las sugerencias. Antes el botón del panel rojo exportaba todos los resultados.

**Dominio.** `calculateAreaResults` agrega `summary.sheetsWithoutCandidate` (hojas sin alumno en el padrón). `findOrphanResponses` pasó a `utils/calificationHelpers.js`. Los puntajes no cambian.

**Textos.** "Sin respuesta .dat" se muestra como "Sin hoja de respuestas"; el Excel conserva el motivo original.

## Pruebas

- `ReviewPanel.test.js` (12): oculto sin incidencias, colapsado, tono según urgencia, paginación 1–10 de 129, búsqueda, singular/plural, exportación, error de vista previa.
- `ScoresTab.test.js`: el panel recibe los datos, cada cifra una sola vez, la descarga no exporta los resultados.
- `calculateResults.test.js`: conteo de hojas sin alumno.
- Suite completa: 228 pruebas y `vite build` correctos. Revisión visual con datos de ejemplo (129 sin hoja, 27 hojas sin alumno).

## Pendiente

- Botón Sí/No para confirmar un DNI sugerido, con registro de auditoría (requiere guardarlo en la base).
- Decidir si los confirmados entran al ranking oficial o aparecen separados.
- Agrupar las acciones de la cabecera y revisar tablas en pantallas pequeñas.
