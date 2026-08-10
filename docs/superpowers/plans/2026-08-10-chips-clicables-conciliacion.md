# Chips Clicables de Conciliación — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convertir los chips de incidencias de cruce (duplicados, fuera de padrón, sin DNI) en filtros clicables de la tabla, en los tabs de Identificadores y Respuestas, reutilizando los datos que ya calcula `buildReconciliation.js`.

**Architecture:** `buildIdentifierReconciliation`/`buildResponseReconciliation` (frontend/src/domain/reconciliation/buildReconciliation.js) agregan un campo `rowIdsByIssueCode: Map<issueCode, Set<rowId>>` a su objeto de retorno, agrupando los ids de `identifier`/`response` de cada `verificationRow`/`detailRow` por sus `issueCodes`. Los componentes `IdentifiersTab.vue` y `ResponsesTab.vue` agregan un estado local `activeChipFilter` (string código o `null`); los chips relevantes se convierten en `<button>` que activan ese estado, un botón "Quitar filtro" lo limpia, y el `computed` `displayedRows` de cada tab filtra usando `rowIdsByIssueCode` cuando hay un filtro de chip activo.

**Tech Stack:** Vue 3 (`<script setup>`, Composition API), Vitest para tests unitarios de dominio.

## Global Constraints

- Spec de referencia: `docs/superpowers/specs/2026-08-10-chips-clicables-conciliacion-design.md` — cualquier duda sobre alcance se resuelve ahí.
- Alcance: solo `IdentifiersTab.vue` y `ResponsesTab.vue`. El tab de Claves (`AnswerKeysTab.vue`) queda fuera.
- Solo son clicables los chips listados en la tabla de mapeo (sección Task 3 y Task 4). El resto de chips (sobre filas de padrón) no se tocan.
- No se agregan archivos de test de componente para `IdentifiersTab.vue`/`ResponsesTab.vue` en este trabajo (sin precedente hoy).
- Correr `npm run test` (desde `frontend/`) después de cada task de dominio para confirmar que no hay regresiones.

---

### Task 1: `rowIdsByIssueCode` en `buildIdentifierReconciliation`

**Files:**
- Modify: `frontend/src/domain/reconciliation/buildReconciliation.js:100-145`
- Test: `frontend/src/domain/reconciliation/__tests__/buildReconciliation.test.js`

**Interfaces:**
- Consumes: `verificationRows` (array ya construido en la función, cada fila tiene `identifier` (objeto con `id` o `null`) e `issueCodes` (array de strings)).
- Produces: `rowIdsByIssueCode` — `Map<string, Set<string>>` — agregado al objeto que retorna `buildIdentifierReconciliation`. Task 3 lo consume como `props.reconciliation.rowIdsByIssueCode.get(code)`.

- [ ] **Step 1: Escribir los tests que fallan**

Agregar estos tres `it(...)` dentro del `describe('buildIdentifierReconciliation', ...)` existente en `frontend/src/domain/reconciliation/__tests__/buildReconciliation.test.js`, después del test `'incluye el nombre del archivo fuente en el detalle'` (antes del `})` que cierra el describe, línea 51):

```js
  it('agrupa ids de identificadores por issueCode en rowIdsByIssueCode', () => {
    const identifiers = [
      { id: 'idr-1', dni: '12345678', litho: '1', indicator: 'A', folio: '1' },
      { id: 'idr-2', dni: '12345678', litho: '1', indicator: 'A', folio: '1' },
      { id: 'idr-3', dni: '99999999', litho: '9', indicator: 'Z', folio: '9' },
    ]
    const result = buildIdentifierReconciliation([{ dni: '12345678' }], identifiers)

    expect(result.rowIdsByIssueCode.get('IDENTIFIER_DNI_DUPLICATE')).toEqual(new Set(['idr-1', 'idr-2']))
    expect(result.rowIdsByIssueCode.get('IDENTIFIER_MATCH_KEY_DUPLICATE')).toEqual(new Set(['idr-1', 'idr-2']))
    expect(result.rowIdsByIssueCode.get('IDENTIFIER_OUTSIDE_PADRON')).toEqual(new Set(['idr-3']))
  })

  it('no agrega ids cuando la fila no tiene identificador asociado (IDENTIFIER_MISSING)', () => {
    const result = buildIdentifierReconciliation([{ dni: '12345678' }], [])
    expect(result.rowIdsByIssueCode.has('IDENTIFIER_MISSING')).toBe(false)
  })
```

- [ ] **Step 2: Correr los tests y confirmar que fallan**

Run (desde `frontend/`): `npx vitest run src/domain/reconciliation/__tests__/buildReconciliation.test.js`
Expected: FAIL — `result.rowIdsByIssueCode` es `undefined` (`Cannot read properties of undefined (reading 'get')` o similar).

- [ ] **Step 3: Implementar `rowIdsByIssueCode` en `buildIdentifierReconciliation`**

En `frontend/src/domain/reconciliation/buildReconciliation.js`, insertar el siguiente bloque **después** del segundo `identifiers.forEach(...)` (el que cierra en la línea 114 con `})`, justo antes de `const padronDnis = new Set(candidatesByDni.keys())` en la línea 116):

```js
  const rowIdsByIssueCode = new Map()
  verificationRows.forEach((row) => {
    const rowId = row.identifier?.id
    if (!rowId) return
    row.issueCodes.forEach((code) => {
      if (!rowIdsByIssueCode.has(code)) rowIdsByIssueCode.set(code, new Set())
      rowIdsByIssueCode.get(code).add(rowId)
    })
  })

```

Luego, en el `return` de la función (línea 129-144), agregar `rowIdsByIssueCode,` justo después de `verificationRows,` (línea 141):

```js
  return {
    padronTotal: padronDnis.size,
    identifiersTotal: identifiers.length,
    linkedIdentifierRows,
    matchedCandidates,
    missingIdentifiers,
    identifiersWithoutCandidate,
    unlinkedIdentifiers,
    invalidPadronRows,
    duplicatePadronDnis,
    duplicateIdentifierDnis,
    duplicateMatchKeys,
    verificationRows,
    rowIdsByIssueCode,
    issues,
    status: issues === 0 && padronDnis.size > 0 && identifiers.length > 0 ? 'ok' : issues > 0 ? 'warn' : 'empty',
  }
```

- [ ] **Step 4: Correr los tests y confirmar que pasan**

Run: `npx vitest run src/domain/reconciliation/__tests__/buildReconciliation.test.js`
Expected: PASS (todos los tests del archivo, incluyendo los 4 preexistentes de `buildIdentifierReconciliation`).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/domain/reconciliation/buildReconciliation.js frontend/src/domain/reconciliation/__tests__/buildReconciliation.test.js
git commit -m "feat: agregar rowIdsByIssueCode a buildIdentifierReconciliation"
```

---

### Task 2: `rowIdsByIssueCode` en `buildResponseReconciliation`

**Files:**
- Modify: `frontend/src/domain/reconciliation/buildReconciliation.js:195-233`
- Test: `frontend/src/domain/reconciliation/__tests__/buildReconciliation.test.js`

**Interfaces:**
- Consumes: `detailRows` (ya construido en la función, cada fila tiene `response` (objeto con `id` o `null`) e `issueCodes`).
- Produces: `rowIdsByIssueCode` — `Map<string, Set<string>>` — agregado al objeto que retorna `buildResponseReconciliation`. Task 4 lo consume como `props.reconciliation.rowIdsByIssueCode.get(code)`.

- [ ] **Step 1: Escribir los tests que fallan**

Agregar este `it(...)` dentro del `describe('buildResponseReconciliation', ...)` existente, después del test `'detalla respuestas faltantes, externas, no vinculadas y duplicadas'` (antes del `})` que cierra el describe, línea 71):

```js
  it('agrupa ids de respuestas por issueCode y excluye respuestas ausentes (RESPONSE_MISSING)', () => {
    const candidates = [{ dni: '12345678' }, { dni: '87654321' }]
    const responses = [
      { id: 'r-1', dni: '12345678' },
      { id: 'r-2', dni: '12345678' },
      { id: 'r-3', dni: '99999999' },
    ]
    const result = buildResponseReconciliation(candidates, candidates, responses)

    expect(result.rowIdsByIssueCode.get('RESPONSE_DNI_DUPLICATE')).toEqual(new Set(['r-1', 'r-2']))
    expect(result.rowIdsByIssueCode.get('RESPONSE_OUTSIDE_PADRON')).toEqual(new Set(['r-3']))
    expect(result.rowIdsByIssueCode.has('RESPONSE_MISSING')).toBe(false)
  })
```

- [ ] **Step 2: Correr los tests y confirmar que fallan**

Run: `npx vitest run src/domain/reconciliation/__tests__/buildReconciliation.test.js`
Expected: FAIL — `result.rowIdsByIssueCode` es `undefined`.

- [ ] **Step 3: Implementar `rowIdsByIssueCode` en `buildResponseReconciliation`**

En `frontend/src/domain/reconciliation/buildReconciliation.js`, insertar el siguiente bloque **después** del `responses.forEach(...)` que cierra en la línea 208 con `})`, justo antes de `const linkedResponses = responses.filter(...)` en la línea 210:

```js
  const rowIdsByIssueCode = new Map()
  detailRows.forEach((row) => {
    const rowId = row.response?.id
    if (!rowId) return
    row.issueCodes.forEach((code) => {
      if (!rowIdsByIssueCode.has(code)) rowIdsByIssueCode.set(code, new Set())
      rowIdsByIssueCode.get(code).add(rowId)
    })
  })

```

Luego, en el `return` de la función (línea 220-232), agregar `rowIdsByIssueCode,` justo después de `detailRows,` (línea 229):

```js
  return {
    padronTotal: padronDnis.size,
    responsesTotal: responses.length,
    linkedResponses,
    unlinkedResponses,
    responsesWithoutCandidate,
    candidatesWithoutResponse,
    identifiersWithoutResponse,
    duplicateResponseDnis,
    detailRows,
    rowIdsByIssueCode,
    issues,
    status: issues === 0 && responses.length > 0 ? 'ok' : issues > 0 ? 'warn' : 'empty',
  }
```

- [ ] **Step 4: Correr los tests y confirmar que pasan**

Run: `npx vitest run src/domain/reconciliation/__tests__/buildReconciliation.test.js`
Expected: PASS (todos los tests del archivo).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/domain/reconciliation/buildReconciliation.js frontend/src/domain/reconciliation/__tests__/buildReconciliation.test.js
git commit -m "feat: agregar rowIdsByIssueCode a buildResponseReconciliation"
```

---

### Task 3: Chips clicables en `IdentifiersTab.vue`

**Files:**
- Modify: `frontend/src/components/tabs/IdentifiersTab.vue`

**Interfaces:**
- Consumes: `props.reconciliation.rowIdsByIssueCode` (de Task 1, `Map<string, Set<string>>`), `identifiers.rows` (array completo, ya expuesto por `useIdentifiers.js` vía `...tableState`).
- Produces: nada consumido por otras tasks (Task 3 y 4 son independientes entre sí).

**Mapeo chip → issueCode (los únicos que se vuelven clicables):**

| Chip actual (línea) | issueCode |
|---|---|
| `sin DNI leído` (línea 197) | `IDENTIFIER_DNI_MISSING` |
| `fuera del padrón` (línea 196) | `IDENTIFIER_OUTSIDE_PADRON` |
| `DNI duplicados` (línea 210) | `IDENTIFIER_DNI_DUPLICATE` |
| `lecturas/litho duplicados` (línea 211) | `IDENTIFIER_MATCH_KEY_DUPLICATE` |

- [ ] **Step 1: Agregar estado y computeds en el `<script setup>`**

En `frontend/src/components/tabs/IdentifiersTab.vue`, reemplazar (líneas 23-28):

```js
const identifiers = reactive(props.identifiers)
const showOnlyObserved = ref(false)

const displayedRows = computed(() => (
  showOnlyObserved.value ? identifiers.observations : identifiers.pagedRows
))
```

por:

```js
const identifiers = reactive(props.identifiers)
const showOnlyObserved = ref(false)
const activeChipFilter = ref(null)

const chipFilteredRows = computed(() => {
  if (!activeChipFilter.value) return null
  const ids = props.reconciliation?.rowIdsByIssueCode?.get(activeChipFilter.value)
  return ids ? identifiers.rows.filter(row => ids.has(row.id)) : []
})

const displayedRows = computed(() => {
  if (chipFilteredRows.value) return chipFilteredRows.value
  return showOnlyObserved.value ? identifiers.observations : identifiers.pagedRows
})

function selectChipFilter(code) {
  activeChipFilter.value = code
  showOnlyObserved.value = false
}

function clearChipFilter() {
  activeChipFilter.value = null
}

function toggleShowOnlyObserved() {
  showOnlyObserved.value = !showOnlyObserved.value
  if (showOnlyObserved.value) activeChipFilter.value = null
}
```

- [ ] **Step 2: Actualizar el slot `#actions` del panel de verificación**

Reemplazar (líneas 182-189):

```html
      <template v-if="identifiers.observationCount" #actions>
          <button type="button" class="btn btn--ghost" @click="showOnlyObserved = !showOnlyObserved">
            {{ showOnlyObserved ? 'Ver todos' : 'Ver observados' }}
          </button>
          <button type="button" class="btn btn--primary" @click="identifiers.exportIdentifierObservationsToExcel">
            Exportar observados
          </button>
      </template>
```

por:

```html
      <template v-if="identifiers.observationCount || activeChipFilter" #actions>
          <button v-if="activeChipFilter" type="button" class="btn btn--ghost" @click="clearChipFilter">
            Quitar filtro
          </button>
          <button v-if="identifiers.observationCount" type="button" class="btn btn--ghost" @click="toggleShowOnlyObserved">
            {{ showOnlyObserved ? 'Ver todos' : 'Ver observados' }}
          </button>
          <button v-if="identifiers.observationCount" type="button" class="btn btn--primary" @click="identifiers.exportIdentifierObservationsToExcel">
            Exportar observados
          </button>
      </template>
```

- [ ] **Step 3: Convertir los 4 chips del mapeo en botones clicables**

Reemplazar la línea 197 (chip "sin DNI leído"):

```html
          <span class="verification-chip" :class="identifierDatClosure.withoutDni ? 'verification-chip--warn' : 'verification-chip--muted'"><strong>{{ identifierDatClosure.withoutDni }}</strong> sin DNI leído</span>
```

por:

```html
          <button type="button" class="verification-chip verification-chip--clickable" :class="[identifierDatClosure.withoutDni ? 'verification-chip--warn' : 'verification-chip--muted', activeChipFilter === 'IDENTIFIER_DNI_MISSING' ? 'verification-chip--active' : '']" :disabled="!identifierDatClosure.withoutDni" @click="selectChipFilter('IDENTIFIER_DNI_MISSING')"><strong>{{ identifierDatClosure.withoutDni }}</strong> sin DNI leído</button>
```

Reemplazar la línea 196 (chip "fuera del padrón"):

```html
          <span class="verification-chip" :class="identifierDatClosure.outsidePadron ? 'verification-chip--warn' : 'verification-chip--muted'"><strong>{{ identifierDatClosure.outsidePadron }}</strong> fuera del padrón</span>
```

por:

```html
          <button type="button" class="verification-chip verification-chip--clickable" :class="[identifierDatClosure.outsidePadron ? 'verification-chip--warn' : 'verification-chip--muted', activeChipFilter === 'IDENTIFIER_OUTSIDE_PADRON' ? 'verification-chip--active' : '']" :disabled="!identifierDatClosure.outsidePadron" @click="selectChipFilter('IDENTIFIER_OUTSIDE_PADRON')"><strong>{{ identifierDatClosure.outsidePadron }}</strong> fuera del padrón</button>
```

Reemplazar la línea 210 (chip "DNI duplicados"):

```html
          <span class="verification-chip" :class="reconciliation.duplicateIdentifierDnis ? 'verification-chip--error' : 'verification-chip--muted'"><strong>{{ reconciliation.duplicateIdentifierDnis }}</strong> DNI duplicados</span>
```

por:

```html
          <button type="button" class="verification-chip verification-chip--clickable" :class="[reconciliation.duplicateIdentifierDnis ? 'verification-chip--error' : 'verification-chip--muted', activeChipFilter === 'IDENTIFIER_DNI_DUPLICATE' ? 'verification-chip--active' : '']" :disabled="!reconciliation.duplicateIdentifierDnis" @click="selectChipFilter('IDENTIFIER_DNI_DUPLICATE')"><strong>{{ reconciliation.duplicateIdentifierDnis }}</strong> DNI duplicados</button>
```

Reemplazar la línea 211 (chip "lecturas/litho duplicados"):

```html
          <span class="verification-chip" :class="reconciliation.duplicateMatchKeys ? 'verification-chip--error' : 'verification-chip--muted'"><strong>{{ reconciliation.duplicateMatchKeys }}</strong> lecturas/litho duplicados</span>
```

por:

```html
          <button type="button" class="verification-chip verification-chip--clickable" :class="[reconciliation.duplicateMatchKeys ? 'verification-chip--error' : 'verification-chip--muted', activeChipFilter === 'IDENTIFIER_MATCH_KEY_DUPLICATE' ? 'verification-chip--active' : '']" :disabled="!reconciliation.duplicateMatchKeys" @click="selectChipFilter('IDENTIFIER_MATCH_KEY_DUPLICATE')"><strong>{{ reconciliation.duplicateMatchKeys }}</strong> lecturas/litho duplicados</button>
```

- [ ] **Step 4: Actualizar el binding de paginación del `DataTable`**

Reemplazar la línea 318:

```html
        :pagination="showOnlyObserved ? null : identifiers.pagination"
```

por:

```html
        :pagination="(showOnlyObserved || activeChipFilter) ? null : identifiers.pagination"
```

- [ ] **Step 5: Agregar estilos para los nuevos estados de chip**

En el bloque `<style scoped>` de `frontend/src/components/tabs/IdentifiersTab.vue`, agregar al final (después de la regla `.verification-chip--muted`, línea 756-760):

```css
.verification-chip--clickable {
  font-family: inherit;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.verification-chip--clickable:hover:not(:disabled) {
  border-color: var(--unap-blue-300);
  box-shadow: 0 0 0 1px var(--unap-blue-100);
}

.verification-chip--clickable:disabled {
  cursor: not-allowed;
  opacity: 0.7;
}

.verification-chip--active {
  border-color: var(--unap-blue-600);
  background: var(--unap-blue-50);
  color: var(--unap-blue-700);
  box-shadow: 0 0 0 2px rgba(0, 64, 128, 0.12);
}

.verification-chip--active strong {
  color: var(--unap-blue-800);
}
```

- [ ] **Step 6: Verificación manual**

Run (desde `frontend/`): `npm run dev`

En el navegador: cargar un padrón e identificadores con al menos un DNI duplicado o fuera de padrón (o usar datos existentes de prueba). Ir al tab Identificadores y confirmar:
1. Los 4 chips del mapeo tienen cursor de mano y, al pasar el mouse, un leve resalte — solo cuando su contador es mayor a 0.
2. Click en un chip con contador > 0 → la tabla muestra solo esas filas, el chip queda resaltado, y aparece el botón "Quitar filtro".
3. Click en "Quitar filtro" → la tabla vuelve a mostrar todas las filas (paginadas), el chip deja de estar resaltado.
4. Click en "Ver observados" mientras hay un chip activo → el chip se desactiva y se muestra la lista de observaciones de parseo en su lugar.
5. Los chips fuera del mapeo (padrón, sin identificador, etc.) siguen sin reaccionar al click.

- [ ] **Step 7: Correr la suite de frontend para confirmar que no hay regresiones**

Run (desde `frontend/`): `npm run test`
Expected: PASS (todos los tests existentes, sin nuevos fallos).

- [ ] **Step 8: Commit**

```bash
git add frontend/src/components/tabs/IdentifiersTab.vue
git commit -m "feat: chips clicables de conciliacion en IdentifiersTab"
```

---

### Task 4: Chips clicables en `ResponsesTab.vue`

**Files:**
- Modify: `frontend/src/components/tabs/ResponsesTab.vue`

**Interfaces:**
- Consumes: `props.reconciliation.rowIdsByIssueCode` (de Task 2, `Map<string, Set<string>>`), `responses.rows` (array completo, ya expuesto por `useResponses.js` vía `...tableState`).
- Produces: nada consumido por otras tasks.

**Mapeo chip → issueCode:**

| Chip actual (línea) | issueCode |
|---|---|
| `fuera del padrón` (línea 301) | `RESPONSE_OUTSIDE_PADRON` |
| `sin DNI` (línea 302) | `RESPONSE_DNI_UNLINKED` |
| `DNI duplicados` (línea 319) | `RESPONSE_DNI_DUPLICATE` |

- [ ] **Step 1: Agregar estado y computeds en el `<script setup>`**

En `frontend/src/components/tabs/ResponsesTab.vue` hay dos ediciones separadas dentro de este step:

**Cambio 1 — línea 41**, reemplazar:

```js
const showOnlyObserved = ref(false)
```

por:

```js
const showOnlyObserved = ref(false)
const activeChipFilter = ref(null)
```

**Cambio 2 — líneas 51-53**, reemplazar:

```js
const displayedRows = computed(() => (
  showOnlyObserved.value ? responses.actionableObservations : responses.pagedRows
))
```

por:

```js
const chipFilteredRows = computed(() => {
  if (!activeChipFilter.value) return null
  const ids = props.reconciliation?.rowIdsByIssueCode?.get(activeChipFilter.value)
  return ids ? responses.rows.filter(row => ids.has(row.id)) : []
})

const displayedRows = computed(() => {
  if (chipFilteredRows.value) return chipFilteredRows.value
  return showOnlyObserved.value ? responses.actionableObservations : responses.pagedRows
})

function selectChipFilter(code) {
  activeChipFilter.value = code
  showOnlyObserved.value = false
}

function clearChipFilter() {
  activeChipFilter.value = null
}

function toggleShowOnlyObserved() {
  showOnlyObserved.value = !showOnlyObserved.value
  if (showOnlyObserved.value) activeChipFilter.value = null
}
```

(Mantener el orden relativo: `showOnlyObserved`/`activeChipFilter` quedan donde estaba la línea 41; los computeds y funciones nuevos reemplazan el bloque de `displayedRows` de las líneas 51-53, antes de `displayedRowsWithCounts` en la línea 55.)

- [ ] **Step 2: Actualizar el slot `#actions` del panel de verificación**

Reemplazar (líneas 282-284):

```html
          <button type="button" class="btn btn--ghost" :disabled="!responses.actionableObservationCount" @click="showOnlyObserved = !showOnlyObserved">
            {{ showOnlyObserved ? 'Ver todos' : 'Ver observados' }}
          </button>
```

por:

```html
          <button v-if="activeChipFilter" type="button" class="btn btn--ghost" @click="clearChipFilter">
            Quitar filtro
          </button>
          <button type="button" class="btn btn--ghost" :disabled="!responses.actionableObservationCount" @click="toggleShowOnlyObserved">
            {{ showOnlyObserved ? 'Ver todos' : 'Ver observados' }}
          </button>
```

(Esto queda dentro del `<template #actions>` existente en la línea 272, que ya se renderiza siempre — no requiere cambiar ningún `v-if` de la plantilla, a diferencia de Identificadores.)

- [ ] **Step 3: Convertir los 3 chips del mapeo en botones clicables**

Reemplazar la línea 301 (chip "fuera del padrón"):

```html
            <span class="verification-chip" :class="responseDatClosure.outsidePadron ? 'verification-chip--warn' : 'verification-chip--muted'"><strong>{{ responseDatClosure.outsidePadron }}</strong> fuera del padrón</span>
```

por:

```html
            <button type="button" class="verification-chip verification-chip--clickable" :class="[responseDatClosure.outsidePadron ? 'verification-chip--warn' : 'verification-chip--muted', activeChipFilter === 'RESPONSE_OUTSIDE_PADRON' ? 'verification-chip--active' : '']" :disabled="!responseDatClosure.outsidePadron" @click="selectChipFilter('RESPONSE_OUTSIDE_PADRON')"><strong>{{ responseDatClosure.outsidePadron }}</strong> fuera del padrón</button>
```

Reemplazar la línea 302 (chip "sin DNI"):

```html
            <span class="verification-chip" :class="responseDatClosure.withoutDni ? 'verification-chip--warn' : 'verification-chip--muted'"><strong>{{ responseDatClosure.withoutDni }}</strong> sin DNI</span>
```

por:

```html
            <button type="button" class="verification-chip verification-chip--clickable" :class="[responseDatClosure.withoutDni ? 'verification-chip--warn' : 'verification-chip--muted', activeChipFilter === 'RESPONSE_DNI_UNLINKED' ? 'verification-chip--active' : '']" :disabled="!responseDatClosure.withoutDni" @click="selectChipFilter('RESPONSE_DNI_UNLINKED')"><strong>{{ responseDatClosure.withoutDni }}</strong> sin DNI</button>
```

Reemplazar la línea 319 (chip "DNI duplicados"):

```html
            <span class="verification-chip" :class="reconciliation.duplicateResponseDnis ? 'verification-chip--error' : 'verification-chip--muted'"><strong>{{ reconciliation.duplicateResponseDnis }}</strong> DNI duplicados</span>
```

por:

```html
            <button type="button" class="verification-chip verification-chip--clickable" :class="[reconciliation.duplicateResponseDnis ? 'verification-chip--error' : 'verification-chip--muted', activeChipFilter === 'RESPONSE_DNI_DUPLICATE' ? 'verification-chip--active' : '']" :disabled="!reconciliation.duplicateResponseDnis" @click="selectChipFilter('RESPONSE_DNI_DUPLICATE')"><strong>{{ reconciliation.duplicateResponseDnis }}</strong> DNI duplicados</button>
```

- [ ] **Step 4: Actualizar el binding de paginación del `DataTable`**

Reemplazar la línea 444:

```html
        :pagination="showOnlyObserved ? null : responses.pagination"
```

por:

```html
        :pagination="(showOnlyObserved || activeChipFilter) ? null : responses.pagination"
```

- [ ] **Step 5: Agregar estilos para los nuevos estados de chip**

En el bloque `<style scoped>` de `frontend/src/components/tabs/ResponsesTab.vue`, agregar después de la regla `.verification-chip--muted` (línea ~955-959, junto a las demás reglas `.verification-chip*`):

```css
.verification-chip--clickable {
  font-family: inherit;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.verification-chip--clickable:hover:not(:disabled) {
  border-color: var(--unap-blue-300);
  box-shadow: 0 0 0 1px var(--unap-blue-100);
}

.verification-chip--clickable:disabled {
  cursor: not-allowed;
  opacity: 0.7;
}

.verification-chip--active {
  border-color: var(--unap-blue-600);
  background: var(--unap-blue-50);
  color: var(--unap-blue-700);
  box-shadow: 0 0 0 2px rgba(0, 64, 128, 0.12);
}

.verification-chip--active strong {
  color: var(--unap-blue-800);
}
```

- [ ] **Step 6: Verificación manual**

Run (desde `frontend/`): `npm run dev`

En el navegador: con datos que incluyan alguna respuesta fuera de padrón o duplicada, ir al tab Respuestas y confirmar el mismo comportamiento que en el Step 6 de Task 3 (chip clicable → filtra tabla → "Quitar filtro" la restaura; "Ver observados" desactiva el chip activo).

- [ ] **Step 7: Correr la suite de frontend para confirmar que no hay regresiones**

Run (desde `frontend/`): `npm run test`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/components/tabs/ResponsesTab.vue
git commit -m "feat: chips clicables de conciliacion en ResponsesTab"
```
