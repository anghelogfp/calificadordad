# README DEV - Calificador DAD Frontend

> Documento técnico para continuidad entre sesiones de desarrollo.

## Estado Actual: REFACTORIZACIÓN COMPLETADA

**Fecha:** 2026-02-03
**App.vue:** 6,568 líneas → 180 líneas
**Build:** `npm run build` - SUCCESS

---

## Cambios Realizados

### Fase 1: Infraestructura Base
```
src/constants/index.js     - TAB_KEYS, tabs, COLUMNS, AREAS, STORAGE_KEYS, DEFAULT_PONDERATIONS, API_BASE_URL
src/utils/helpers.js       - removeDiacritics, normalize, stripDigits, generateId, formatTimestamp, buildResponseMatchKey, buildAreaTipoKey, buildPonderationKey, classifyAnswerChar, buildQuestionPlan
src/utils/parsers.js       - createIdentifierRow, buildIdentifierObservation, parseIdentifierLine, createResponseRow, buildResponseObservation, parseResponseLine, readLinesFromFile
```

### Fase 2: Composable Genérico
```
src/composables/useTableState.js - CRUD genérico con selection, editing, search, filtering, drag handlers
```

### Fase 3: Composables de Dominio
```
src/composables/useArchives.js      - Excel import/export, archiveByDni lookup
src/composables/useIdentifiers.js   - .dat parsing, identifierLookup, identifierLookupByLitho
src/composables/useResponses.js     - depende de identifiers lookups, responsesByDni
src/composables/useAnswerKeys.js    - dual file import, answerKeyLookupByAreaTipo
src/composables/usePonderations.js  - API CRUD, ponderationEntriesByArea, ponderationTotalsByArea
src/composables/useCalification.js  - scoring logic, depende de TODOS los otros composables
```

### Fase 4: Componentes UI Reutilizables
```
src/components/shared/EmptyState.vue     - icon prop: document|time|chart
src/components/shared/StepInfoCard.vue   - variant prop: default|gold
src/components/shared/SubTabs.vue        - tabs array, v-model
src/components/shared/FileUploader.vue   - drag & drop, badges, hints
src/components/shared/Toolbar.vue        - search, slots: actions, metrics
src/components/shared/SourcesPanel.vue   - sources list, remove handler
src/components/shared/DataTable.vue      - columns config, selection, editing, row-class
```

### Fase 5: Layout y Tabs
```
src/components/layout/AppHeader.vue
src/components/layout/StepNav.vue        - tabs, counts para badges de completado
src/components/tabs/ArchivesTab.vue
src/components/tabs/IdentifiersTab.vue
src/components/tabs/ResponsesTab.vue
src/components/tabs/AnswerKeysTab.vue
src/components/tabs/ScoresTab.vue
src/components/modals/CalificationModal.vue
```

### Fase 6: App.vue Refactorizado
- Orquestador que inicializa composables en orden de dependencia
- Watch para sincronizar identifiers → responses
- onMounted para initializePonderations()

---

## Dependencias entre Composables

```
useArchives()           → independiente
useIdentifiers()        → independiente
useResponses(identifierLookup, identifierLookupByLitho)
useAnswerKeys(archiveRows)
usePonderations()       → independiente
useCalification(archiveRows, responsesRows, answerKeyRows, ponderationRows, ponderationEntriesByArea, ponderationTotalsByArea, responsesByDni, answerKeyLookupByAreaTipo)
```

---

## Errores Conocidos y Soluciones

### Error: Cannot resolve "@/constants"
```
error during build:
[vite]: Rollup failed to resolve import "@/constants" from "src/App.vue"
```
**Solución:** Agregar alias en `vite.config.js`:
```js
import { fileURLToPath, URL } from 'node:url'
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  }
})
```

### Warning: Chunk size > 500kB
```
(!) Some chunks are larger than 500 kB after minification
```
**Causa:** ExcelJS es grande (~1.5MB). No es crítico para funcionamiento.
**Solución opcional:** Dynamic imports para ExcelJS.

---

## Archivos de Configuración Modificados

### vite.config.js
```js
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  }
})
```

---

## Estructura de Props por Componente

### StepNav
```js
props: tabs, activeTab, archivesCount, identifiersCount, responsesCount, answerKeysCount, scoresCount
emit: update:activeTab
```

### Tab Components (todos siguen patrón similar)
```js
// ArchivesTab
props: { archives: Object }

// IdentifiersTab, ResponsesTab, AnswerKeysTab
props: { [name]: Object, subTab: String }
emit: update:subTab

// ScoresTab
props: { calification: Object, ponderations: Object }
emit: openModal
```

### CalificationModal
```js
props: { show: Boolean, tab: String, calification: Object, ponderations: Object }
emit: close, update:tab
```

---

## Storage Keys (localStorage)
```js
'calificador-active-tab'
'calificador-identificador-subtab'
'calificador-respuestas-subtab'
'calificador-claves-subtab'
'calificador-candidatos'           // archives
'calificador-identificadores'      // identifiers
'calificador-respuestas'           // responses
'calificador-claves'               // answer keys
'calificador-ponderaciones'        // ponderations
'calificador-calificaciones'       // score results
'calificador-identificadores-sources'
'calificador-respuestas-sources'
'calificador-claves-sources'
```

---

## API Endpoints (usePonderations)
```
Base: http://localhost:8000/api
GET    /ponderaciones/
GET    /ponderaciones/?area={area}
POST   /ponderaciones/
PUT    /ponderaciones/{id}/
DELETE /ponderaciones/{id}/
POST   /ponderaciones/bulk_create/
```

---

## Comandos
```bash
npm run dev      # desarrollo
npm run build    # producción
npm run preview  # preview build
```

---

## Tareas Pendientes / Mejoras Futuras

- [ ] Code splitting para ExcelJS (reducir bundle)
- [ ] Tests unitarios para composables
- [ ] Tests E2E para flujo completo
- [ ] PWA support (offline)
- [ ] Validación de tipos con TypeScript (opcional)

---

## Notas Técnicas

1. **useTableState** es el composable base - CRUD genérico reutilizado por 4 composables
2. **El watcher en App.vue** sincroniza identifiers con responses automáticamente
3. **Ponderations** se inicializan desde API o localStorage con fallback a defaults
4. **Los estilos globales** están en `src/style.css` (variables CSS, reset, animaciones)
5. **Estilos scoped** de componentes incluyen clases duplicadas por diseño (cada componente es autónomo)

---

## Historial de Sesiones

### Sesión 2026-02-03
- Completada refactorización completa de App.vue
- Creados 25 archivos modulares
- Configurado alias @ en vite.config.js
- Build exitoso
