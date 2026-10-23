# Filtro "DNI sin alumno" en Identificadores y Respuestas — 2026-10-22

## Problema

En los pasos 2 (Identificadores) y 3 (Respuestas), el panel de verificacion decia cuantas fichas estaban "fuera del padron" pero no permitia ubicarlas: habia que recorrer toda la tabla. La correccion solo se descubria despues de calificar, en Resultados > Revision.

La rama `feat/calificacion-pj` tenia un boton parecido; se evaluo (ver `docs/integracion-ramas.md`) y se trajo la idea mejorada: ubicar las fichas y orientar al operador, pero **sin** cambiar datos por su cuenta.

## Que hace

- Boton **"Ver DNI sin alumno (N)"** en los pasos 2 y 3. Solo aparece si hay padron cargado y al menos una ficha cuyo DNI no coincide con ningun alumno (DNI de 8 digitos fuera del padron, o DNI incompleto). Las fichas sin DNI no se incluyen: no hay nada que comparar.
- Al activarlo, la tabla muestra solo esas fichas, resaltadas, y aparece un panel con **Hoja, Aula, DNI leido y Posible alumno**.
- **Posible alumno** es una pista de solo lectura: alumnos del padron cuyo DNI difiere en una sola edicion (un digito cambiado, de mas, de menos o dos contiguos intercambiados). Indica si el alumno sugerido **ya tiene su propia ficha**, y si la hoja ya tiene una **correccion confirmada** muestra a que alumno se atribuyo.
- Se apaga solo cuando ya no queda ninguna ficha por revisar, y no se pisa con "Ver observados" (activar uno apaga el otro).
- Muestra el mismo conjunto y las mismas sugerencias que Resultados > Revision.

## Que no hace (decision de diseno)

- **No corrige nada.** Un DNI parecido no prueba quien es el alumno. Para corregir: editar el DNI en la tabla (errores evidentes de lectura optica) o, despues de calificar, confirmar la correccion auditada en Resultados > Revision (conserva el dato original, se puede deshacer y entra a la huella y al backup).
- No se trajo el mecanismo de la otra rama (editar el DNI y perder el original sin registro) como via principal.

## Codigo

- `domain/reconciliation/outsidePadronReview.js`: funcion pura `buildOutsidePadronReview`. Reutiliza `suggestCandidatesForDni` y la proteccion de correcciones por DNI original de la hoja.
- `components/shared/OutsidePadronPanel.vue`: panel de solo lectura (paginado de 10 en 10).
- `IdentifiersTab.vue` y `ResponsesTab.vue`: boton, filtro y resaltado; `App.vue` les pasa el padron y las correcciones confirmadas.

## Pruebas

- 16 del dominio (casos de DNI fuera, incompleto, vacio, sugerencias, "ya tiene ficha", correcciones confirmadas, correccion de otro examen, sin padron, no modifica entradas).
- 8 del panel y 17 de integracion en ambos pasos (aparicion del boton, filtro, resaltado, apagado automatico, exclusion con "Ver observados").
- Con el simulacro real (179 fichas): 27 fichas (26 fuera del padron y 1 incompleta), 7 con alumno posible y 13 sin parecido, igual que en Resultados.
- Suite: 453 pruebas de frontend y `vite build` correctos.
