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

## Confirmar un DNI sugerido (Sí/No)

En la pestaña "Hojas sin alumno", cada sugerencia viable tiene un botón **Confirmar**. Pide una confirmación en pantalla ("¿Es este alumno?") antes de guardar; no usa diálogos del navegador.

- La corrección confirmada se muestra aparte: "Confirmado · fuera del ranking oficial", con su puntaje y la posición que tendría. **No entra al ranking oficial.** (Decisión: separada y marcada hasta que el colegio la verifique.)
- **Deshacer** la revoca; queda registrada, no se borra.
- Un alumno confirmado con una hoja queda bloqueado para otras hojas.
- Solo se confirman sugerencias viables: no las bloqueadas ni las que chocan con otra hoja. "No" equivale a no confirmar.
- Las correcciones confirmadas salen en la hoja "Hojas sin alumno" del Excel de revisión.
- Sin restricción de rol: el sistema lo usa el administrador; los datos siguen aislados por usuario.

Backend: modelo `DniCorrection`, migración `0012_dnicorrection`, endpoint `/api/correcciones-dni/` (listar, crear, deshacer). Ver `docs/backend.md`.

Pruebas: 12 de backend (validaciones, auditoría al deshacer, aislamiento por usuario, autenticación), 3 de dominio, 5 de composable y 6 del panel. Verificado también contra el servidor real. Suite: 242 de frontend y 66 de backend.

## Aviso: base de datos de la raíz

La base que había en la raíz venía de la rama `feat/calificacion-pj`, con columnas obligatorias que `main` no tiene (`aula_padron`, `file_size`...), y rechazaba guardar datos con error 500. Se respaldó en `~/Documents/admision_work/respaldos-db/` y `main` usa ahora una base limpia.

`feat/calificacion-pj` tiene su propia migración `0012_answerkeysource_file_size...`: al fusionarla con `main` habrá dos migraciones 0012 y hará falta una migración de fusión.

## Pendiente

- Agrupar las acciones de la cabecera y revisar tablas en pantallas pequeñas.
- Decidir si los confirmados deben poder incluirse en el ranking oficial.
- Incluir las correcciones en el backup/restauración.
