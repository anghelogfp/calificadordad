# Calificador DAD — Documentación del Sistema

> Última actualización: 2026-03-27
> Estado: Funcional. Próxima tarea: refactor de ponderaciones con sistema de plantillas nombradas.

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
│   │   ├── models.py            — modelo Ponderacion
│   │   ├── serializers.py       — PonderacionSerializer
│   │   ├── views.py             — PonderacionViewSet (+ bulk_create, areas)
│   │   └── urls.py
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
        ├── constants/index.js              — TAB_KEYS, tabs, ANSWER_KEY_AREAS, DEFAULT_PONDERATIONS, STORAGE_KEYS, DEFAULT_DAT_FORMAT
        ├── composables/
        │   ├── useArchives.js              — padrón de postulantes (Excel)
        │   ├── useIdentifiers.js           — identificadores .dat (litho→DNI)
        │   ├── useResponses.js             — respuestas .dat (con lookup por DNI)
        │   ├── useAnswerKeys.js            — claves de respuestas (área+tipo→respuestas)
        │   ├── usePonderations.js          — ponderaciones por asignatura (+ API sync)
        │   ├── useCalification.js          — motor de calificación y resultados
        │   ├── useTableState.js            — selección/edición de filas (writable computed + localStorage)
        │   ├── useConvocatoria.js          — convocatoria activa
        │   ├── useAreas.js                 — áreas desde API
        │   ├── useDatFormat.js             — configuración de formato .dat
        │   ├── useBackup.js                — backup/restore de estado
        │   ├── useExport.js                — exportación de resultados
        │   └── useScoreDashboard.js        — métricas del dashboard
        ├── components/
        │   ├── layout/
        │   │   ├── AppHeader.vue           — cabecera con logo UNAP
        │   │   └── StepNav.vue             — navegación de pasos (recibe funciones como props)
        │   ├── tabs/
        │   │   ├── ArchivesTab.vue         — Paso 1: padrón Excel
        │   │   ├── IdentifiersTab.vue      — Paso 2: identificadores .dat
        │   │   ├── ResponsesTab.vue        — Paso 3: respuestas .dat
        │   │   ├── AnswerKeysTab.vue       — Paso 4: claves de respuestas
        │   │   ├── PonderationsTab.vue     — Paso 5: ponderaciones por asignatura
        │   │   └── ScoresTab.vue           — Paso 6: tabla de resultados
        │   ├── modals/
        │   │   ├── CalificationModal.vue   — modal para configurar y ejecutar calificación
        │   │   └── BackupModal.vue         — modal de backup
        │   ├── panels/                     — paneles adicionales
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
Ponderacion
  id, convocatoria_id (FK nullable), area, subject, question_count, ponderation (decimal 10,3),
  order, created_at, updated_at
  unique_together: (convocatoria, area, subject)
  indexes: (area, order), (convocatoria, area)
```

### API Endpoints actuales

```
GET/POST   /api/ponderaciones/
GET/PUT/DELETE /api/ponderaciones/{id}/
GET        /api/ponderaciones/areas/          — lista áreas únicas
POST       /api/ponderaciones/bulk_create/    — upsert masivo

GET/POST   /api/convocatorias/
GET/PUT/DELETE /api/convocatorias/{id}/
GET/POST   /api/areas/
...        (CalificationConfig, DatFormatConfig, etc.)
```

---

## Flujo de 6 pasos

```
Paso 1 — Padrón Excel
  → Carga archivo .xlsx con columnas: DNI, apellido paterno, apellido materno, nombres, observaciones, área
  → Mapeo flexible de columnas con aliases
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

Paso 5 — Ponderaciones
  → Define el peso de cada asignatura dentro de las 60 preguntas
  → Por ejemplo Biomédicas: Aritmética=3 preguntas × peso 3.331, Biología=6 preguntas × peso 7.816...
  → La suma de preguntas debe = 60 (answers_length)
  → Sincroniza con API /ponderaciones/
  → Almacena en localStorage

Paso 6 — Calificación
  → Abre modal: selecciona área a calificar + ponderación a aplicar + valores (correcta/incorrecta/blanco)
  → Motor: para cada postulante del área, busca sus respuestas, las compara con la clave, aplica pesos
  → Genera tabla de puntajes ordenada de mayor a menor
  → Almacena resultados en localStorage
```

---

## Arquitectura Vue 3 — Patrón crítico

### Problema: refs no se auto-desenvuelven en props

Los composables retornan objetos planos con `Ref`/`ComputedRef` internos:
```js
// usePonderations retorna:
{ ponderationRows: Ref<[]>, ponderationAreaList: ComputedRef<[]>, ... }
```

Vue 3 solo auto-desenvuelve refs **top-level** en `<script setup>`. Cuando se pasa como prop a un componente hijo, los refs NO se desenvuelven en el template.

**Síntoma:** `ponderations.ponderationAreaList.map()` falla (es un ComputedRef, no un Array). `archives.hasData` siempre es truthy (es un objeto ComputedRef). Resultado: pantalla blanca.

### Solución: `reactive()` wrapper obligatorio

En **cada componente que recibe un composable como prop**, agregar al inicio del `<script setup>`:

```js
const props = defineProps({ ponderations: { type: Object, required: true } })
const ponderations = reactive(props.ponderations)  // ← OBLIGATORIO
```

`reactive()` crea un Proxy que auto-desenvuelve refs anidados en acceso y escritura.

**Reglas de uso con el wrapper:**
- En templates: `ponderations.ponderationModalArea` (sin `.value`)
- v-model: `v-model="ponderations.search"` (sin `.value`)
- Asignación de ref: `(el) => ponderations.identificationInputRef = el` (el proxy setter asigna a `.value` automáticamente)
- Funciones: `ponderations.addPonderationRow()` funciona igual

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
getStepDescription(key) → string (ej: '45 postulantes' o 'Sin cargar')
```

---

## Estado de localStorage (claves)

```js
'calificador-candidatos'         → rows del padrón
'calificador-identificadores'    → rows de identificadores
'calificador-respuestas'         → rows de respuestas
'calificador-claves'             → rows de claves de respuestas
'calificador-ponderaciones'      → rows de ponderaciones
'calificador-calificaciones'     → { summary, rows } de resultados
'calificador-active-tab'         → tab activa actual
'calificador-calification-config'→ { [area]: { correctValue, incorrectValue, blankValue } }
'calificador-convocatoria'       → ID de convocatoria activa
'calificador-dat-format'         → configuración del formato .dat
'calificador-vacantes'           → vacantes por área
```

---

## Motor de calificación (`useCalification.js`)

```
Para cada postulante del área seleccionada:
  1. Busca sus respuestas por DNI (responsesByDni Map)
  2. Busca la clave correcta para (área, tipo) del postulante
  3. buildQuestionPlan(entries) → array de 60 items, cada uno con su peso
  4. Para cada posición i de 0..59:
       weight = plan[i].weight
       si responseChar == correctChar → total += correctValue * weight
       si responseChar es A-E pero ≠ correctChar → total += incorrectValue * weight
       si responseChar es blanco/inválido → total += blankValue * weight
  5. score = round(total, 2)

Ordena resultados de mayor a menor puntaje
Genera summary: área, timestamp, totalCandidates, missingResponses, missingKeys, unlinkedResponses
```

---

## Valores de ponderación por defecto (DEFAULT_PONDERATIONS en constants/index.js)

Las 3 áreas tienen 18 asignaturas cada una (= 54 filas). Cada una cubre exactamente 60 preguntas en total.

Ejemplo Biomédicas:
```
Aritmética          3 pregs  peso 3.331
Álgebra             3 pregs  peso 3.202
Geometría           3 pregs  peso 3.301
Trigonometría       3 pregs  peso 3.404
Física              3 pregs  peso 5.505
Química             5 pregs  peso 6.623
Biología y Anatomía 6 pregs  peso 7.816
...
Total              60 pregs
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

---

## Próxima mejora planeada: Sistema de Plantillas de Ponderación

### Problema actual

El sistema tiene **una única configuración de ponderación por área**. No se pueden guardar múltiples "recetas" ni reutilizarlas entre convocatorias.

### Concepto

Separar la **receta de puntaje** (plantilla) de los **candidatos a calificar** (área del padrón).

Una **PlantillaPonderacion** es una colección nombrada de filas de ponderación:
- `"UNAP 2024 Biomédicas"` → las 18 asignaturas con sus pesos exactos
- `"Modo Simple"` → 1 asignatura "General", 60 preguntas, peso=1 (para calificación plana)
- `"Especial Medicina 2023"` → otra configuración histórica

### Nuevos modelos Django propuestos

```python
PlantillaPonderacion
  id, name, area (nullable), convocatoria_id (FK nullable), created_at, updated_at

PlantillaItem
  id, plantilla_id (FK), subject, question_count, ponderation (decimal 10,3), order
```

El campo `area` en la plantilla es **opcional** (etiqueta organizativa, no restricción técnica):
- Plantillas con área: aparecen solo cuando se califica esa área (UNAP 2024 Biomédicas)
- Plantillas sin área (`null`): aparecen en todas las áreas (Modo Simple)

### Nuevo flujo UI propuesto

**Paso 5 — Plantillas de Ponderación** (layout de 2 columnas):
```
┌─────────────────────┬──────────────────────────────────────┐
│  LISTA              │  EDITOR                              │
│  ─────────────────  │  ──────────────────────────────────  │
│  Biomédicas (2)     │  Nombre: [UNAP 2024 Biomédicas    ]  │
│   ● UNAP 2024  ←── │  Área:   [Biomédicas ▾] (opcional)  │
│   ● Modo Simple    │                                      │
│  Sociales (1)       │  Asignatura    Pregs  Ponderación    │
│   ● UNAP 2024      │  Aritmética     3      3.331  [✎][🗑]│
│  Ingeniería (1)     │  Álgebra        3      3.202  [✎][🗑]│
│  General (1)        │  ...                                 │
│   ● Modo Simple    │                                      │
│                     │  Totales: 60/60 ✓ Listo             │
│  [+ Nueva plantilla]│  [+ Agregar asignatura]             │
└─────────────────────┴──────────────────────────────────────┘

[⚡ Generar Modo Simple para todas las áreas]
```

**Paso 6 — CalificationModal** (selector de plantilla):
```
Área a calificar:    [Biomédicas ▾]
Plantilla:           [UNAP 2024 Biomédicas (60 pregs ✓) ▾]
                      ──────────────────────────────────
                      UNAP 2024 Biomédicas  (60 pregs ✓)
                      Modo Simple          (60 pregs ✓)
                      ──────────────────────────────────
                      + Crear nueva plantilla
Valor correcta:  [10]
Valor incorrecta: [0]
Valor en blanco:  [2]
```

### Migración de datos

Al implementar, auto-generar una plantilla `"UNAP [año] [área]"` por cada grupo `(convocatoria, area)` existente en `Ponderacion`. Cero pérdida de datos.

### Impacto en código

| Archivo | Cambio |
|---|---|
| `backend/ponderaciones/models.py` | Agregar `PlantillaPonderacion` + `PlantillaItem` |
| `backend/ponderaciones/views.py` | Agregar ViewSets para plantillas + migración auto |
| `frontend/src/composables/usePonderations.js` | Refactorizar para trabajar con lista de plantillas |
| `frontend/src/composables/useCalification.js` | Recibir `plantillaId` en vez de `ponderationArea` |
| `frontend/src/components/tabs/PonderationsTab.vue` | Rediseño completo: sidebar lista + editor |
| `frontend/src/components/modals/CalificationModal.vue` | Dropdown de plantilla en vez de dropdown de área |

### Opciones de layout discutidas

- **Opción A:** Sidebar deslizante (drawer) global accesible desde cualquier paso — cómodo pero editor comprimido
- **Opción B:** Pestaña dedicada con layout 2 columnas — espacio completo, flujo lineal claro ← **preferida**
- **Opción C:** Ambas — pestaña principal + botón acceso rápido en header

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

1. **`useStorage` de @vueuse/core** — `ponderationRows`, `selection`, `editing` y más son writable computed refs (leen/escriben localStorage). Al asignarles un nuevo array, actualizar con `xxx.value = [...]` no `xxx = [...]`.

2. **`selection` y `editing` en `useTableState`** — son writable computed refs respaldados por localStorage como arrays, pero expuestos como Sets. La asignación `selection.value = newSet` convierte el Set a array para localStorage.

3. **`buildQuestionPlan`** — función clave en `utils/helpers.js`. Toma las filas de ponderación de un área y expande cada asignatura en N ítems individuales (uno por pregunta), cada uno con su peso normalizado. El plan resultante tiene exactamente `answers_length` ítems.

4. **Normalización de área** — `normalizeArea(area, areaList)` en `utils/helpers.js`. Usa aliases para mapear variantes ("biomedica", "biomedicas" → "Biomédicas"). Siempre usar esta función al comparar o guardar áreas.

5. **CORS** — el backend tiene middleware CORS habilitado en `config/settings.py` + `config/cors_middleware.py`. Permite peticiones desde `localhost:5173`.
