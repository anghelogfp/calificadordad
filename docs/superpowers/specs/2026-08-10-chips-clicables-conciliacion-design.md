# Chips clicables de conciliación en Identificadores y Respuestas

Fecha: 2026-08-10

## Contexto

Los tabs de Identificadores y Respuestas ya muestran un panel de verificación (`StepVerificationPanel`) con chips que resumen incidencias de conciliación entre padrón, identificadores y respuestas (ej. "3 DNI duplicados", "2 fuera del padrón"). Esos conteos salen de `buildIdentifierReconciliation`/`buildResponseReconciliation` en `frontend/src/domain/reconciliation/buildReconciliation.js`, que ya calculan `verificationRows`/`detailRows` con un `issueCodes` semántico por fila.

Por separado, ambos tabs ya tienen un toggle "Ver observados / Ver todos" que filtra la tabla, pero ese filtro solo cubre observaciones de **parseo de una sola fila** (`row.observaciones`, calculado en `utils/parsers.js` al leer el .dat — ej. "DNI sin marcar", "Aula incompleta"). Las incidencias de **cruce entre tablas** (duplicado en padrón, fuera de padrón, DNI no vinculado, litho/folio duplicado) hoy solo existen como contadores agregados en los chips — no hay forma de hacer clic en un chip y ver esas filas específicas.

Este documento diseña cómo cerrar ese gap: convertir los chips relevantes en filtros clicables de la tabla.

## Alcance

**Incluido:**
- Tabs de Identificadores (`IdentifiersTab.vue`) y Respuestas (`ResponsesTab.vue`).
- Chips cuyo conteo está expresado en unidades de filas que existen en la tabla actualmente mostrada (identificadores o respuestas, según el tab).
- Un botón explícito "Quitar filtro" para salir del filtro por chip.

**Excluido explícitamente (decisión del usuario):**
- Tab de Claves (`AnswerKeysTab.vue`). Su métrica de "incompletas" ya se cubre con el toggle "Ver observados" existente (vía `row.observaciones`). Su métrica de "duplicadas" no tiene lista de filas hoy — construirla es trabajo de dominio nuevo (`answerKeyReconciliation` en `App.vue` no genera `verificationRows`), y queda para una iteración futura.
- Chips cuyo conteo es sobre filas del **padrón** que no existen en la tabla actual (ej. "DNI duplicados en padrón", "sin identificador", "sin respuesta"). Quedan como informativos, sin interacción. Navegar a otro tab y filtrar ahí queda fuera de este cambio.
- Tests de componente para `IdentifiersTab.vue`/`ResponsesTab.vue` (no existe precedente de esos archivos de test hoy; ampliarlo es alcance aparte).

## Diseño

### 1. Capa de datos — `buildReconciliation.js`

`buildIdentifierReconciliation` y `buildResponseReconciliation` agregan un campo nuevo al objeto que retornan: `rowIdsByIssueCode`, un `Map<string, Set<id>>`.

Se construye en la misma pasada que ya arma `verificationRows`/`detailRows`: por cada fila que tenga un `identifier` (o `response`, según la función) no nulo, se agrega su `id` al set de cada código en `issueCodes` de esa fila. Las filas donde ese lado es `null` (el candidato no tiene fila en identificadores/respuestas — códigos `IDENTIFIER_MISSING`, `PADRON_DNI_INVALID`, `RESPONSE_MISSING`) no aportan ningún id.

El mapa es genérico: no se filtra a priori qué códigos "sirven" para la UI. La UI decide qué chips exponer como clicables mapeándolos a un código presente en el mapa.

### 2. Capa de UI — `IdentifiersTab.vue` y `ResponsesTab.vue`

**Mapeo chip → issueCode (los únicos clicables):**

| Tab | Chip | issueCode |
|---|---|---|
| Identificadores | fuera del padrón | `IDENTIFIER_OUTSIDE_PADRON` |
| Identificadores | sin DNI leído | `IDENTIFIER_DNI_MISSING` |
| Identificadores | DNI duplicados | `IDENTIFIER_DNI_DUPLICATE` |
| Identificadores | lecturas/litho duplicados | `IDENTIFIER_MATCH_KEY_DUPLICATE` |
| Respuestas | fuera del padrón | `RESPONSE_OUTSIDE_PADRON` |
| Respuestas | sin DNI vinculado | `RESPONSE_DNI_UNLINKED` |
| Respuestas | DNI duplicados | `RESPONSE_DNI_DUPLICATE` |

Todos los demás chips existentes en ambos tabs (los que resumen el lado del padrón: duplicados en padrón, sin identificador, sin respuesta, identificadores sin respuesta) permanecen como `<span>` sin `@click`.

**Estado:** un `ref` nuevo por tab, `activeChipFilter` (string issueCode o `null`).

**Interacción:**
- Click en un chip clicable con conteo > 0 → `activeChipFilter` toma ese código, y `showOnlyObserved` se pone en `false` (mutuamente excluyentes: solo un modo de filtro activo — parseo u cruce — a la vez).
- Activar "Ver observados" → limpia `activeChipFilter` a `null` (misma exclusión mutua en el otro sentido).
- Chips con conteo 0 no llevan `@click` (evita un estado "filtro activo, tabla vacía" sin sentido).
- Botón explícito **"Quitar filtro"** aparece en el slot `#actions` del panel (junto al botón "Ver observados"/"Ver todos" existente) cuando `activeChipFilter !== null`, y al hacer click lo pone en `null`. El chip activo mismo no lleva acción de "apagado" — solo activa.
- El chip activo toma un estado visual resaltado (clase adicional, mismo lenguaje visual que otros estados `--active` del proyecto).

**`displayedRows` (computed existente en ambos tabs) pasa a:**
1. Si `activeChipFilter` tiene valor: filtrar el listado completo de filas (`identifiers.rows.value` / `responses.rows.value`, no solo la página actual — mismo criterio que ya usa `observations`) contra `reconciliation.rowIdsByIssueCode.get(activeChipFilter)`.
2. Si no, comportamiento actual sin cambios (`showOnlyObserved` u todas).

La paginación (`:pagination="..."` en `DataTable`) se desactiva cuando `activeChipFilter` está activo, igual que ya ocurre con `showOnlyObserved`.

### 3. Manejo de errores y casos borde

- `reconciliation` ausente o sin `rowIdsByIssueCode` todavía (carga inicial): los chips no son clicables vía guard opcional (`reconciliation?.rowIdsByIssueCode?.get(...)`), sin romper el render — mismo patrón que ya usan con `reconciliation.duplicateIdentifierDnis || 0`.
- El usuario edita una fila mientras el filtro está activo y dicha fila deja de tener el issue: como el estado guardado es el código (no una lista fija de ids), la tabla se recalcula en el siguiente render y la fila corregida sale del filtro automáticamente.
- Cambiar de tab con un filtro activo: `activeChipFilter` es estado local de cada componente, se resetea al salir — mismo comportamiento que ya tiene `showOnlyObserved` hoy (no persiste entre visitas).

### 4. Testing

- `buildReconciliation.test.js`: casos nuevos que verifiquen `rowIdsByIssueCode` — un id aparece en el set del código correspondiente; una fila con `identifier`/`response` nulo no aporta ningún id; un mismo id puede estar en más de un set si la fila tiene varios `issueCodes` simultáneos (ej. duplicado y fuera de padrón a la vez).
- No se agregan tests de componente para `IdentifiersTab.vue`/`ResponsesTab.vue` en este cambio (sin precedente hoy; alcance aparte si se decide más adelante).
