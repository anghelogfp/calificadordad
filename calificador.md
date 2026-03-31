# Calificador DAD — Documentación del Sistema

> Última actualización: 2026-03-31
> Estado: Funcional. Mejoras A+B+C+D+E implementadas.

---

## ¿Qué es este sistema?

Sistema web para calificar exámenes de admisión universitaria (UNAP — Universidad Nacional del Altiplano Puno, Perú).

Procesa archivos `.dat` generados por lectores ópticos de hojas de respuestas, los cruza con un padrón Excel de postulantes y las claves de respuestas, aplica ponderaciones por asignatura, y genera una tabla de puntajes final ordenada.

### Contexto del proceso real

1. Se rinde un examen de admisión con **60 preguntas** de opción múltiple (A-E)
2. Las respuestas se leen con un lector óptico → genera archivos `.dat`
3. Hay **3 áreas** de postulantes: **Biomédicas**, **Sociales**, **Ingeniería** (cada una con su cuadernillo distinto)
4. Cada asignatura tiene un peso diferente (ponderación) según el área
5. El puntaje final = suma de (valor_correcta × peso) por pregunta acertada, etc.

---

## Stack tecnológico

### Backend
- **Django 6.0** + **Django REST Framework**
- Base de datos: **SQLite** (desarrollo) — archivo `db.sqlite3` en `/backend/`
- Servidor: `python manage.py runserver` → `http://localhost:8000`
- Directorio: `backend/`

### Frontend
- **Vue 3** con `<script setup>` (Composition API)
- **Vite** como bundler
- **@vueuse/core** para `useStorage` (persistencia en localStorage)
- Sin router (SPA de una sola pantalla con tabs)
- Directorio: `frontend/`
- Dev server: `npm run dev` → `http://localhost:5173`

---

## Estructura de directorios

```
calificadordad/
├── backend/
│   ├── config/
│   │   ├── settings.py          — configuración Django, CORS habilitado
│   │   ├── api_urls.py          — enruta ponderaciones + convocatorias
│   │   └── cors_middleware.py   — middleware CORS manual
│   ├── ponderaciones/
│   │   ├── models.py            — Ponderacion (legacy) + PlantillaPonderacion + PlantillaItem
│   │   ├── serializers.py       — PonderacionSerializer + PlantillaItemSerializer + PlantillaPonderacionSerializer
│   │   ├── views.py             — PonderacionViewSet + PlantillaPonderacionViewSet
│   │   ├── urls.py              — router: ponderaciones + plantillas
│   │   └── migrations/
│   │       ├── 0001_initial.py
│   │       ├── 0002_...
│   │       └── 0003_plantillaponderacion_plantillaitem.py
│   ├── convocatorias/
│   │   ├── models.py            — Convocatoria, Area, CalificationConfig, DatFormatConfig
│   │   ├── serializers.py
│   │   ├── views.py
│   │   └── urls.py
│   └── manage.py
│
└── frontend/
    └── src/
        ├── App.vue                         — raíz: inicializa composables, renderiza tabs
        ├── constants/index.js              — TAB_KEYS, tabs, STORAGE_KEYS, DEFAULT_PONDERATIONS, DEFAULT_DAT_FORMAT
        ├── composables/
        │   ├── useArchives.js              — padrón de postulantes (Excel)
        │   ├── useIdentifiers.js           — identificadores .dat (litho→DNI)
        │   ├── useResponses.js             — respuestas .dat (con lookup por DNI)
        │   ├── useAnswerKeys.js            — claves de respuestas (área+tipo→respuestas)
        │   ├── usePonderations.js          — sistema de plantillas de ponderación
        │   ├── useCalification.js          — motor de calificación y resultados
        │   ├── useTableState.js            — selección/edición de filas (writable computed + localStorage)
        │   ├── useConvocatoria.js          — convocatoria activa
        │   ├── useAreas.js                 — áreas desde API
        │   ├── useDatFormat.js             — configuración de formato .dat
        │   ├── useBackup.js                — backup/restore de estado
        │   ├── useExport.js                — exportación de resultados
        │   ├── useHistory.js               — historial de procesos guardados
        │   ├── useScoreDashboard.js        — métricas del dashboard
        │   └── useVacantesPrograma.js      — vacantes por programa de estudios
        ├── components/
        │   ├── layout/
        │   │   ├── AppHeader.vue           — cabecera con logo UNAP
        │   │   └── StepNav.vue             — navegación de pasos (recibe funciones como props)
        │   ├── tabs/
        │   │   ├── ArchivesTab.vue         — Paso 1: padrón Excel
        │   │   ├── IdentifiersTab.vue      — Paso 2: identificadores .dat
        │   │   ├── ResponsesTab.vue        — Paso 3: respuestas .dat
        │   │   ├── AnswerKeysTab.vue       — Paso 4: claves de respuestas
        │   │   ├── PonderationsTab.vue     — Paso 5: plantillas de ponderación (2 columnas)
        │   │   └── ScoresTab.vue           — Paso 6: tabla de resultados
        │   ├── modals/
        │   │   ├── CalificationModal.vue   — modal para configurar y ejecutar calificación
        │   │   └── BackupModal.vue         — modal de backup
        │   ├── panels/
        │   │   ├── HistoryPanel.vue        — historial de procesos guardados
        │   │   ├── ConvocatoriaPanel.vue   — gestión de convocatoria activa
        │   │   ├── DashboardPanel.vue      — estadísticas globales y distribución de puntajes (CSS histogram)
        │   │   └── ConfigPanel.vue         — vacantes por programa de estudios + configuración formato .dat
        │   └── shared/
        │       ├── DataTable.vue           — tabla reutilizable con selección y edición
        │       ├── StepInfoCard.vue        — tarjeta de información del paso
        │       ├── SubTabs.vue             — sub-pestañas dentro de un tab
        │       ├── Toolbar.vue             — barra con búsqueda + acciones
        │       └── EmptyState.vue          — estado vacío reutilizable
        └── utils/
            ├── helpers.js                  — normalize, normalizeArea, buildPonderationKey, buildQuestionPlan, etc.
            └── parsers.js                  — parsers de archivos .dat y Excel
```

---

## Modelos de base de datos

### `convocatorias` app

```python
Convocatoria
  id, name, year, status ('active'|'closed'), created_at, updated_at

Area
  id, convocatoria_id (FK), name, question_count (default=60), vacantes, order
  unique_together: (convocatoria, name)

CalificationConfig
  id, convocatoria_id (FK), area_name, correct_value, incorrect_value, blank_value, updated_at
  unique_together: (convocatoria, area_name)

DatFormatConfig
  id, convocatoria_id (OneToOne), header_length, answers_length, litho_offset, litho_length,
  tipo_offset, tipo_length, dni_offset, dni_length, aula_offset, aula_length, answers_offset
```

### `ponderaciones` app

```python
Ponderacion  (legacy — se mantiene para compatibilidad)
  id, convocatoria_id (FK nullable), area, subject, question_count, ponderation (decimal 10,3),
  order, created_at, updated_at
  unique_together: (convocatoria, area, subject)
  indexes: (area, order), (convocatoria, area)

PlantillaPonderacion
  id, convocatoria_id (FK nullable), name, area (nullable — null = global), question_total (int, denormalizado),
  created_at, updated_at
  — update_question_total(): recalcula question_total sumando los PlantillaItem

PlantillaItem
  id, plantilla_id (FK → PlantillaPonderacion, CASCADE), subject, question_count, ponderation (decimal 10,3), order
```

**Lógica de área en PlantillaPonderacion:**
- `area` específica (ej: "Biomédicas") → aparece solo al calificar esa área
- `area = null` → plantilla global, aparece en todas las áreas (ej: "Modo Simple")

### API Endpoints

```
# Ponderaciones legacy
GET/POST            /api/ponderaciones/
GET/PUT/DELETE      /api/ponderaciones/{id}/
GET                 /api/ponderaciones/areas/
POST                /api/ponderaciones/bulk_create/

# Plantillas (nuevo)
GET/POST            /api/plantillas/
GET/PUT/DELETE      /api/plantillas/{id}/
POST                /api/plantillas/{id}/add_item/
GET/PUT/DELETE      /api/plantillas/{id}/item_detail/?item_id={n}
POST                /api/plantillas/{id}/migrate_from_ponderaciones/

GET/POST            /api/convocatorias/
GET/PUT/DELETE      /api/convocatorias/{id}/
GET/POST            /api/areas/
...                 (CalificationConfig, DatFormatConfig, etc.)
```

---

## Flujo de 6 pasos

```
Paso 1 — Padrón Excel
  → Carga archivo .xlsx con columnas: DNI, ap. paterno, ap. materno, nombres, observaciones, área, programa
  → Columna "programa" (programa de estudios) mapea aliases: desprograma, des_programa, carrera, escuela, prog, etc.
  → Mapeo flexible de columnas con aliases en ARCHIVE_KEY_ALIASES (constants/index.js)
  → Almacena en localStorage (STORAGE_KEYS.ARCHIVE)

Paso 2 — Identificadores (.dat)
  → Archivos .dat del lector óptico con formato fijo: litho(6) + tipo(1) + DNI(8) + aula(3) + respuestas(60)
  → Construye lookup: litho → DNI para el cruce con respuestas
  → Almacena en localStorage

Paso 3 — Respuestas (.dat)
  → Mismos archivos .dat o archivos de respuestas separados
  → Cruza cada fila con los identificadores para asignar el DNI
  → Almacena en localStorage con responsesByDni (Map<dni, rows[]>)

Paso 4 — Claves de respuestas
  → Archivo con las respuestas correctas: área + tipo + 60 caracteres A-E
  → Construye lookup: (área, tipo) → respuestas correctas
  → Almacena en localStorage

Paso 5 — Plantillas de Ponderación
  → Define plantillas reutilizables con el peso de cada asignatura
  → Cada plantilla tiene nombre, área opcional y sus ítems (asignatura, preguntas, ponderación)
  → "Modo Simple" es una plantilla global (area=null): 1 ítem "General", 60 pregs, peso=1
  → Al iniciar, si no hay plantillas, se pre-cargan las 3 UNAP + Modo Simple automáticamente
  → Layout 2 columnas: sidebar con lista agrupada por área + editor de plantilla seleccionada
  → Almacena en localStorage (STORAGE_KEYS.PLANTILLAS)

Paso 6 — Calificación
  → Abre modal: selecciona área a calificar + plantilla de ponderación + valores (correcta/incorrecta/blanco)
  → El dropdown de plantillas filtra por área seleccionada (muestra área específica + globales)
  → Motor: para cada postulante del área, busca sus respuestas, las compara con la clave, aplica pesos
  → Snapshot de la plantilla guardado en el summary (auditoría histórica)
  → Ranking por programa: agrupa postulantes por programa de estudios, ordena por puntaje dentro
    de cada grupo y marca como ingresante según las vacantes configuradas en ConfigPanel
  → Cada resultado incluye: position (global), positionInPrograma, isIngresante, programa
  → Genera tabla de puntajes ordenada de mayor a menor
  → Columna Estado (INGRESANTE / NO INGRESANTE) visible cuando hay vacantes configuradas
  → Almacena resultados en localStorage
```

---

## Arquitectura Vue 3 — Patrón crítico

### Problema: refs no se auto-desenvuelven en props

Los composables retornan objetos planos con `Ref`/`ComputedRef` internos. Vue 3 solo auto-desenvuelve refs **top-level** en `<script setup>`. Cuando se pasa como prop a un componente hijo, los refs NO se desenvuelven en el template.

**Síntoma:** `.map()` falla (es un ComputedRef, no un Array). `.hasData` siempre truthy (es un objeto). Resultado: pantalla blanca.

### Solución: `reactive()` wrapper obligatorio

En **cada componente que recibe un composable como prop**, agregar al inicio del `<script setup>`:

```js
const props = defineProps({ ponderations: { type: Object, required: true } })
const ponderations = reactive(props.ponderations)  // ← OBLIGATORIO
```

`reactive()` crea un Proxy que auto-desenvuelve refs anidados en acceso y escritura.

**Reglas de uso con el wrapper:**
- En templates: `ponderations.selectedPlantilla` (sin `.value`)
- v-model: `v-model="ponderations.search"` (sin `.value`)
- Asignación de ref: `(el) => ponderations.inputRef = el` (el proxy setter asigna a `.value` automáticamente)
- Funciones: `ponderations.createPlantilla()` funciona igual

**Componentes que aplican este patrón:**
- `ArchivesTab.vue` → `const archives = reactive(props.archives)`
- `IdentifiersTab.vue` → `const identifiers = reactive(props.identifiers)`
- `ResponsesTab.vue` → `const responses = reactive(props.responses)`
- `AnswerKeysTab.vue` → `const answerKeys = reactive(props.answerKeys)`
- `PonderationsTab.vue` → `const ponderations = reactive(props.ponderations)`
- `ScoresTab.vue` → `const calification = reactive(props.calification)` + `const ponderations = reactive(props.ponderations)`
- `CalificationModal.vue` → `const calification = reactive(props.calification)`

### DataTable — ref local, no prop

No pasar un `ref` externo como template ref a `DataTable`. En cambio:
- `DataTable` tiene `const checkboxRef = ref(null)` internamente
- Recibe prop `isIndeterminate: Boolean`
- Usa `watch(() => props.isIndeterminate, val => checkboxRef.value.indeterminate = val)`

### StepNav — props de función

`StepNav` recibe tres funciones en vez de contadores:
```js
getStepStatus(key) → '' | 'completed'
getStepLabel(key)  → string
getStepDescription(key) → string (ej: '3 plantillas' o 'Sin configurar')
```

---

## Estado de localStorage (claves)

```js
STORAGE_KEYS = {
  ARCHIVE:             'calificador-candidatos',
  IDENTIFIER:          'calificador-identificadores',
  RESPONSES:           'calificador-respuestas',
  ANSWER_KEYS:         'calificador-claves',
  PONDERATION:         'calificador-ponderaciones',      // legacy, ya no se escribe
  PLANTILLAS:          'calificador-plantillas',          // nuevo — array de PlantillaPonderacion
  SCORE_RESULTS:       'calificador-calificaciones',
  ACTIVE_TAB:          'calificador-active-tab',
  IDENTIFIER_SUBTAB:   'calificador-identificador-subtab',
  RESPONSES_SUBTAB:    'calificador-respuestas-subtab',
  ANSWER_KEY_SUBTAB:   'calificador-claves-subtab',
  IDENTIFIER_SOURCES:  'calificador-identificador-sources',
  RESPONSES_SOURCES:   'calificador-respuestas-sources',
  ANSWER_KEY_SOURCES:  'calificador-claves-sources',
  CONVOCATORIA:        'calificador-convocatoria',
  DAT_FORMAT:          'calificador-dat-format',
  VACANTES:            'calificador-vacantes',
  VACANTES_PROGRAMA:   'calificador-vacantes-programa',
  HISTORY:             'calificador-historial',
  ACTIVE_PROCESS:      'calificador-proceso-activo',
}
```

---

## `usePonderations.js` — Sistema de plantillas

Reescritura completa (2026-03-31). Ya no usa el patrón "defaults + overrides".

### Lo que expone

```js
// State
plantillas               // useStorage(PLANTILLAS) — array de objetos PlantillaPonderacion
selectedPlantillaId      // ref(null) — ID de plantilla en el editor
selectedPlantilla        // computed — objeto plantilla completo o null
selectedPlantillaItems   // computed — items[] de la plantilla seleccionada
selectedPlantillaTotal   // computed — { questions, weight } de la plantilla seleccionada
sidebarSections          // computed — agrupado por área: [{ area, plantillas[] }]
editorError              // ref('') — mensaje de error en el editor

// CRUD plantillas
getPlantillaById(id)
getPlantillasForCalification(area)  // filtra por área + globales (null)
selectPlantilla(id)
createPlantilla({ name, area })
deletePlantilla(id)
renamePlantilla(id, name)

// CRUD items
addItem(plantillaId, { subject, questionCount, ponderation })
removeItem(plantillaId, itemId)
toggleEditItem(itemId)
isEditingItem(itemId)

// Formulario nueva plantilla (en sidebar)
showNewPlantillaForm
newPlantillaName
newPlantillaArea
openNewPlantillaForm()
cancelNewPlantillaForm()
confirmNewPlantilla()

// Nuevo ítem (en editor)
newItem  // { subject, questionCount, ponderation }

// Init
initializePonderations()   // alias de initializePlantillas
initializePlantillas()     // seed si no hay plantillas

// Backwards compat
ponderationRows            // computed — flatMap de todos los items (para step status en App.vue)
ponderationCurrentTotals   // alias de selectedPlantillaTotal (para ScoresTab.vue)
```

### Seed inicial (`_seedDefaultPlantillas`)

Si `plantillas` está vacío al iniciar, se crean 4 plantillas predeterminadas:
- `"UNAP Biomédicas"` (area: 'Biomédicas') — 18 asignaturas, 60 preguntas, pesos UNAP
- `"UNAP Sociales"` (area: 'Sociales') — 18 asignaturas, 60 preguntas, pesos UNAP
- `"UNAP Ingeniería"` (area: 'Ingeniería') — 18 asignaturas, 60 preguntas, pesos UNAP
- `"Modo Simple"` (area: null = global) — 1 asignatura "General", 60 preguntas, peso=1

---

## `useCalification.js` — Firma actual

```js
useCalification(
  archiveRows,
  responsesRows,
  answerKeyRows,
  ponderationsComposable,        // ← resultado completo de usePonderations()
  responsesByDni,
  answerKeyLookupByAreaTipo,
  areaNames,
  activeConvocatoriaId,
  formatConfig,
  areaByName,
  vacantesPrograma
)
```

**Expone (relevante a ponderaciones):**
- `calificationPlantillaId` — ref del ID de plantilla seleccionada en el modal
- `availablePlantillas` — computed: plantillas filtradas para el área seleccionada
- `selectedCalificationPlantilla` — computed: objeto plantilla completo
- `selectedPonderationIsReady` — computed: `questionTotal === answersLength`

**En `runCalification()`:**
- Obtiene la plantilla por ID → construye el plan desde `plantilla.items`
- Guarda `plantillaId`, `plantillaName`, `plantillaSnapshot` en el summary (auditoría histórica)
- `plantillaSnapshot` = `[{ subject, questionCount, ponderation }]`

---

## Motor de calificación

```
Para cada postulante del área seleccionada:
  1. Busca sus respuestas por DNI (responsesByDni Map)
  2. Busca la clave correcta para (área, tipo) del postulante
  3. buildQuestionPlan(plantilla.items) → array de 60 items, cada uno con su peso
  4. Para cada posición i de 0..59:
       weight = plan[i].weight
       si responseChar == correctChar → total += correctValue * weight
       si responseChar es A-E pero ≠ correctChar → total += incorrectValue * weight
       si responseChar es blanco/inválido → total += blankValue * weight
  5. score = round(total, 2)
  6. Cada resultado incluye campo "programa" (leído del padrón)

Ranking por programa (post-score):
  - Agrupa resultados por programa de estudios
  - Dentro de cada grupo: ordena por score desc, asigna positionInPrograma (1, 2, 3...)
  - isIngresante = positionInPrograma <= vacantesPrograma[programa] (si cupo > 0)
  - Luego aplana y ordena globalmente por score desc, asigna position global (1, 2, 3...)

Genera summary: área, plantillaId, plantillaName, plantillaSnapshot, timestamp,
                totalCandidates, missingResponses, missingKeys, unlinkedResponses
```

---

## Bugs conocidos resueltos (historial)

| Bug | Causa | Fix aplicado |
|---|---|---|
| Pantalla blanca al cargar | `calification.calificationModalTab.value` no existe en useCalification | Eliminado de App.vue |
| Paso 5 no renderizaba | PonderationsTab no importado en App.vue | Agregado import + v-else-if |
| `StepNav is not a function` | StepNav refactorizado a props funcionales, App.vue no actualizado | Agregadas 3 funciones en App.vue |
| Pantalla blanca (DataTable) | `:ref="(el) => selectAllRef = el"` asigna a prop readonly → TypeError | Reemplazado por `ref` local + prop `isIndeterminate` |
| `ponderations.ponderationAreaList.map() is not a function` | ComputedRef no se desenvuelve a través de props | `reactive(props.ponderations)` en cada tab |
| `archives.selection.has() is not a function` | Mismo problema anterior | Mismo fix |
| v-model en search falla | Con reactive wrapper, `.value` explícito causa double-unwrap | Eliminados `.value` en todos los v-model de búsqueda |
| Pantalla blanca tras Mejora B | `ScoresTab` accedía a `ponderations.ponderationCurrentTotals` eliminado del composable | Alias `ponderationCurrentTotals: selectedPlantillaTotal` agregado al return de usePonderations |

---

## Mejoras implementadas

### A — Gaps funcionales (2026-03-27)
- Watcher en `App.vue` que re-aplica datos de identificadores a respuestas cuando cualquiera cambia
- `convocatoria.fetchConvocatorias()` llamado en `onMounted`

### B — Sistema de Plantillas de Ponderación (2026-03-31)
- **Concepto:** separar la receta de puntaje (plantilla) de los candidatos a calificar
- **Backend:** nuevos modelos `PlantillaPonderacion` + `PlantillaItem`, ViewSet con CRUD + `add_item` + `item_detail` + `migrate_from_ponderaciones`, migración `0003`
- **`usePonderations.js`:** reescritura completa — lista de plantillas en localStorage, seed automático, sidebar agrupado por área
- **`useCalification.js`:** nueva firma con `ponderationsComposable`, `calificationPlantillaId`, snapshot de plantilla en summary
- **`PonderationsTab.vue`:** rediseño 2 columnas (sidebar sticky + editor completo), confirmaciones inline, sin `browser confirm()`
- **`CalificationModal.vue`:** eliminado toggle simpleMode, dropdown de plantilla con preview (preguntas/asignaturas/listo)
- **"Modo Simple":** ya no es un toggle — es una plantilla global predeterminada seleccionable desde el dropdown

### C — UX de resultados mejorada (2026-03-27)
- Panel de estadísticas con 6 tarjetas (total, ingresantes, no ingresantes, máx, promedio, mín)
- Filas ingresantes resaltadas en verde, badge de puntaje verde para ingresantes
- Columna Estado (INGRESANTE / NO INGRESANTE) visible solo cuando hay vacantes configuradas
- Confirmaciones inline en vez de `confirm()` del browser
- Botones de exportación Excel y PDF
- Botón "Estadísticas" que abre DashboardPanel

### D — DashboardPanel (2026-03-27)
- Panel slide-in desde la derecha (480px)
- Tarjetas de resumen global: total, ingresantes, no ingresantes, promedio, máx, mín
- Tabla de comparación por área
- Histograma de distribución de puntajes en buckets de 10 — implementado con CSS puro (sin librería de charts)
- Barras con hover interactivo (azul → dorado)

### E — Configuración global (2026-03-30)
- **ConfigPanel** (nuevo panel): vacantes por programa de estudios + formato del archivo .dat
- **`useVacantesPrograma`:** persiste `{ [nombrePrograma]: number }` en localStorage
- **Campo `programa`** agregado al padrón (alias `desprograma`, `carrera`, `escuela`, etc.)
- **Ranking por programa:** en `useCalification`, post-scoring, agrupa por programa, rankea dentro de cada grupo, asigna `isIngresante` según cupo
- **Columna Programa** en tabla de resultados entre Nombres y Puntaje
- **AppHeader:** botón de engranaje que emite `open-config`

---

## Cómo levantar el proyecto

```bash
# Backend
cd backend
pip install django djangorestframework django-cors-headers
python manage.py migrate
python manage.py runserver

# Frontend (en otra terminal)
cd frontend
npm install
npm run dev
```

Acceder a: `http://localhost:5173`

El frontend se comunica con `http://localhost:8000/api` (definido en `frontend/src/constants/index.js` como `API_BASE_URL`).

---

## Notas de implementación importantes

1. **`useStorage` de @vueuse/core** — `plantillas` y otras claves son writable computed refs. Asignar con `xxx.value = [...]` no `xxx = [...]`.

2. **`selection` y `editing` en `useTableState`** — writable computed refs respaldados por localStorage como arrays, pero expuestos como Sets. La asignación `selection.value = newSet` convierte el Set a array para localStorage.

3. **`buildQuestionPlan`** — función clave en `utils/helpers.js`. Toma los ítems de una plantilla y expande cada asignatura en N ítems individuales (uno por pregunta), cada uno con su peso normalizado. El plan resultante tiene exactamente `answers_length` ítems.

4. **Normalización de área** — `normalizeArea(area, areaList)` en `utils/helpers.js`. Usa aliases para mapear variantes ("biomedica", "biomedicas" → "Biomédicas"). Siempre usar esta función al comparar o guardar áreas.

5. **CORS** — el backend tiene middleware CORS habilitado en `config/settings.py` + `config/cors_middleware.py`. Permite peticiones desde `localhost:5173`.

6. **Plantillas globales (`area: null`)** — aparecen en el dropdown de CalificationModal independientemente del área seleccionada. `getPlantillasForCalification(area)` filtra con `Q(area__iexact=area) | Q(area__isnull=True)` en backend y equivalente en frontend.
