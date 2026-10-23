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

## Confirmar un DNI sugerido (Sí/No) e incluirlo en el ranking

En la pestaña "Hojas sin alumno", cada sugerencia viable tiene un botón **Confirmar**. Pide una confirmación en pantalla ("¿Es este alumno? Entrará al ranking.") antes de guardar; no usa diálogos del navegador.

- **Al confirmar, la hoja entra al ranking oficial.** El sistema recalcula las áreas ya calificadas con la misma plantilla y valores. El alumno aparece en el ranking con la marca "DNI corregido" (el detalle indica el DNI que traía la hoja) y la columna "Observación" en el Excel de resultados.
- **Deshacer** la revoca y el alumno sale del ranking; la corrección queda registrada, no se borra.
- Un alumno confirmado con una hoja queda bloqueado para otras hojas.
- Solo se confirman sugerencias viables. "No" equivale a no confirmar.
- Una calificación nueva ya incluye las correcciones confirmadas (se cargan al iniciar).
- Sin restricción de rol: el sistema lo usa el administrador; los datos siguen aislados por usuario.
- El resumen del cálculo agrega `dniCorrectionsApplied`; `sheetsWithoutCandidate` cuenta solo las pendientes. La barra de revisión muestra "N confirmadas en el ranking" y sigue disponible para deshacer.
- Si el recálculo falla, la corrección queda guardada pero el ranking no cambia, y se avisa.

**Código.** Dominio: `domain/calification/dniCorrections.js` (`applyDniCorrections`) y parámetro `dniCorrections` en `calculateAreaResults`. Composable: `confirmDniCorrection`, `undoDniCorrection`, `recalculateActiveAreas`. Backend: modelo `DniCorrection`, migración `0012_dnicorrection`, endpoint `/api/correcciones-dni/`.

**Backup.** El export incluye `dniCorrections` y la restauración las reemplaza (ver `docs/backend.md`).

**Historial.** La marca "DNI corregido" se guarda por fila (`ResultadoCandidato.dni_corregido` y `dni_original`) y el resumen guarda `sheets_without_candidate` y `dni_corrections_applied`, con la migración `resultados/0008_marca_dni_corregido`. Al abrir un resultado del historial o restaurar un backup, el ranking conserva la marca y la barra de revisión sus conteos. Los resultados guardados antes no traen la marca (quedan en "no corregido").

**Pruebas.** Backend: 73 (12 de la API de correcciones, 3 de backup, 4 de la marca en el historial). Frontend: 257, incluidas las del dominio, el recálculo del ranking al confirmar y deshacer, y el panel. Verificado con el simulacro real: al confirmar las 7 hojas viables, calificados 152 → 159, sin hoja 129 → 122, hojas sin alumno 27 → 20; cada puntaje coincide con el cálculo independiente y ninguno de los 152 anteriores cambió.

## Aviso: base de datos de la raíz

La base que había en la raíz venía de la rama `feat/calificacion-pj`, con columnas obligatorias que `main` no tiene (`aula_padron`, `file_size`...), y rechazaba guardar datos con error 500. Se respaldó en `~/Documents/admision_work/respaldos-db/` y `main` usa ahora una base limpia.

`feat/calificacion-pj` tiene su propia migración `0012_answerkeysource_file_size...`: al fusionarla con `main` habrá dos migraciones 0012 y hará falta una migración de fusión.

## Pendiente

- Agrupar las acciones de la cabecera y revisar tablas en pantallas pequeñas.
