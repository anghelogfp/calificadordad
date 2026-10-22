# Vista previa: calificar con el DNI sugerido — 2026-10-22

## Objetivo

Algunas hojas no se pueden calificar porque el DNI marcado por el alumno no está en el padrón (error de marcado o DNI incompleto). Esta vista previa muestra qué puntaje tendría cada hoja si el DNI parecido del padrón fuera el correcto, para decidir con datos antes de pedir confirmación al colegio.

Es solo una vista previa: **no cambia resultados, ranking ni datos guardados**.

## Qué hace

En la pestaña de resultados, el panel "Hojas sin alumno en el padrón" lista las hojas cuyo DNI no pertenece a ningún postulante. Para cada una busca alumnos del padrón con un DNI a una sola edición de distancia (un dígito cambiado, de más, de menos o dos contiguos intercambiados) y calcula el puntaje con el motor oficial, con la misma plantilla y valores de la calificación mostrada. El cálculo solo se hace al pulsar "Revisar hojas".

Cada sugerencia queda en uno de estos estados:

| Estado | Significado |
|---|---|
| ok | Se muestra el puntaje marcado como PROVISIONAL y la posición que tendría |
| blocked-has-sheet | Ese alumno ya tiene su propia hoja: no se calcula puntaje |
| conflict | Otra hoja sugiere al mismo alumno: no se calcula puntaje |
| not-scored | El motor no pudo calcularlo; se muestra el error |

Un DNI parecido no confirma quién es el alumno. La confirmación sigue siendo humana (hoja física o el colegio).

## Código

- `frontend/src/domain/calification/provisionalMatches.js`: lógica pura (`isSingleEditApart`, `suggestCandidatesForDni`, `findOrphanResponses`, `buildProvisionalPreview`). Reutiliza `calculateAreaResults`, sin duplicar la fórmula de puntaje.
- `frontend/src/composables/useCalification.js`: `previewProvisionalMatches()`.
- `frontend/src/components/shared/ProvisionalMatchesPanel.vue` y su uso en `ScoresTab.vue`.

## Pruebas

- 12 pruebas de dominio y 4 del panel.
- Con el simulacro real (179 hojas, plantilla Sociales): 27 hojas sin alumno; 7 con un alumno posible, cuyo puntaje coincide exactamente con el cálculo independiente hecho antes con otro código; 7 más son parecidas solo a alumnos que ya tienen su hoja y quedan bloqueadas.
- Suite completa: 217 pruebas y `vite build` correctos.

## Pendiente (segunda entrega)

Botón Sí/No para confirmar la corrección con registro de auditoría (quién, cuándo, DNI original y corregido), y decidir si los confirmados entran al ranking oficial o aparecen separados con etiqueta.
