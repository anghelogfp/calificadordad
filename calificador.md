# Calificador DAD — Documentación del Sistema

> Última actualización: 2026-04-08
> Estado: Funcional. Multi-usuario con autenticación JWT. Sidebar navigation implementado.

---

## ¿Qué es este sistema?

Sistema web para calificar exámenes de admisión universitaria (UNAP — Universidad Nacional del Altiplano Puno, Perú).

Procesa archivos `.dat` generados por lectores ópticos de hojas de respuestas, los cruza con un padrón Excel de postulantes y las claves de respuestas, aplica ponderaciones por asignatura, y genera una tabla de puntajes final ordenada.

### Contexto del proceso real

1. Se rinde un examen de admisión con **60 preguntas** de opción múltiple (A-E)
2. Las respuestas se leen con un lector óptico → genera archivos `.dat`
3. Hay **3 áreas** de postulantes: **Biomédicas**, **Sociales**, **Ingeniería** (cada una con su cuadernillo distinto)
4. Cada asignatura tiene un peso diferente (ponderación) según el área
5. El puntaje final = suma de (valor_correcta × peso) por pregunta acertada

---

## Stack tecnológico

### Backend
- **Django 6.0** + **Django REST Framework**
- **djangorestframework-simplejwt** — autenticación JWT (access 8h, refresh 30d)
- Base de datos: **SQLite** (desarrollo) — archivo `db.sqlite3` en `/backend/`
- Servidor: `python manage.py runserver` → `http://localhost:8000`
- Directorio: `backend/`
- Apps: `usuarios`, `ponderaciones`, `convocatorias`, `resultados`

### Frontend
- **Vue 3** con `<script setup>` (Composition API)
- **Vite** como bundler
- **@vueuse/core** para `useStorage` (persistencia en localStorage)
- Sin router (SPA de una sola pantalla con navegación por estado)
- Directorio: `frontend/`
- Dev server: `npm run dev` → `http://localhost:5173`

---

## Cómo levantar el proyecto

```bash
# Backend
cd backend
# Activar venv primero:
# Windows: venv\Scripts\activate
pip install django djangorestframework djangorestframework-simplejwt django-cors-headers
python manage.py migrate
python manage.py createsuperuser   # para crear el primer usuario
python manage.py runserver

# Frontend (en otra terminal)
cd frontend
npm install
npm run dev
```

Acceder a: `http://localhost:5173`

El frontend se comunica con `http://localhost:8000/api`.

---

## Estructura de directorios

```
calificadordad/
├── backend/
│   ├── config/
│   │   ├── settings.py           — Django, JWT, CORS, INSTALLED_APPS
│   │   ├── api_urls.py           — incluye urls de: usuarios, ponderaciones, convocatorias, resultados
│   │   └── cors_middleware.py    — middleware CORS manual
│   ├── usuarios/
│   │   ├── views.py              — login, refresh_token, me, logout (AllowAny en login/refresh)
│   │   └── urls.py
│   ├── ponderaciones/
│   │   ├── models.py             — Ponderacion (legacy) + PlantillaPonderacion + PlantillaItem
│   │   ├── serializers.py
│   │   ├── views.py              — PlantillaPonderacionViewSet con nested items
│   │   └── urls.py               — router: plantillas + items nested
│   ├── convocatorias/
│   │   ├── models.py             — Convocatoria, Area, CalificationConfig, DatFormatConfig
│   │   ├── serializers.py
│   │   ├── views.py
│   │   └── urls.py
│   ├── resultados/
│   │   ├── models.py             — ProcesoCalificacion, AreaCalificacion, ResultadoCandidato
│   │   ├── serializers.py
│   │   ├── views.py              — ProcesoCalificacionViewSet (upsert por local_id, bulk_create)
│   │   └── urls.py
│   └── manage.py
│
└── frontend/
    └── src/
        ├── App.vue                         — raíz: composables, layout, modales
        ├── constants/index.js              — TAB_KEYS, tabs (5 pasos sin Ponderaciones), STORAGE_KEYS
        ├── utils/
        │   ├── apiFetch.js                 — fetch con Bearer token + refresh automático en 401
        │   ├── helpers.js                  — normalize, normalizeArea, buildPonderationKey, etc.
        │   └── parsers.js                  — parsers de archivos .dat y Excel
        ├── composables/
        │   ├── useAuth.js                  — singleton: initialize, login, logout, user, isAuthenticated
        │   ├── useArchives.js              — padrón de postulantes (Excel)
        │   ├── useIdentifiers.js           — identificadores .dat (litho→DNI)
        │   ├── useResponses.js             — respuestas .dat (lookup por DNI)
        │   ├── useAnswerKeys.js            — claves de respuestas (área+tipo→respuestas)
        │   ├── usePonderations.js          — plantillas API-backed, CRUD completo, export/import JSON
        │   ├── useCalification.js          — motor de calificación, guarda en API, preflight
        │   ├── useTableState.js            — selección/edición de filas genérica
        │   ├── useConvocatoria.js          — CRUD convocatorias, nombre compuesto (tipo+año+sufijo)
        │   ├── useAreas.js                 — áreas desde API
        │   ├── useDatFormat.js             — configuración de formato .dat
        │   ├── useBackup.js                — backup/restore de estado
        │   ├── useExport.js                — exportación de resultados Excel/PDF
        │   ├── useHistory.js               — historial API-backed: fetchHistory, saveProcess, deleteProcess
        │   ├── useScoreDashboard.js        — métricas del dashboard
        │   └── useVacantesPrograma.js      — vacantes por programa de estudios
        ├── components/
        │   ├── auth/
        │   │   └── LoginPage.vue           — two-panel: branding UNAP + card de login
        │   ├── layout/
        │   │   ├── AppHeader.vue           — logo, convocatoria activa (info+gestión), user chip+logout
        │   │   ├── AppSidebar.vue          — sidebar colapsable: Nuevo proceso, Ponderaciones, Historial, Config, Backup
        │   │   └── StepNav.vue             — 5 pasos del proceso (sin Ponderaciones), flex-shrink: 0
        │   ├── tabs/
        │   │   ├── ArchivesTab.vue         — Paso 1: padrón Excel
        │   │   ├── IdentifiersTab.vue      — Paso 2: identificadores .dat
        │   │   ├── ResponsesTab.vue        — Paso 3: respuestas .dat
        │   │   ├── AnswerKeysTab.vue       — Paso 4: claves de respuestas
        │   │   ├── PonderationsTab.vue     — herramienta sidebar: plantillas 2 columnas + export/import JSON
        │   │   └── ScoresTab.vue           — Paso 5: tabla de resultados
        │   ├── views/                      — vistas centrales del sidebar (sin overlay)
        │   │   ├── HistoryView.vue         — grid de procesos guardados, cargar/eliminar
        │   │   └── ConfigView.vue          — 2 columnas: vacantes por programa + formato DAT
        │   ├── modals/
        │   │   ├── CalificationModal.vue   — configurar y ejecutar calificación (preflight + vacantes)
        │   │   ├── BackupModal.vue         — backup de sesión
        │   │   └── NuevoProcesoModal.vue   — seleccionar/crear convocatoria + limpiar datos + ir al paso 1
        │   ├── panels/
        │   │   ├── ConvocatoriaPanel.vue   — gestión de convocatorias (crear/cerrar/reabrir)
        │   │   └── DashboardPanel.vue      — estadísticas + histograma CSS
        │   └── shared/
        │       ├── DataTable.vue
        │       ├── StepInfoCard.vue
        │       ├── SubTabs.vue
        │       ├── Toolbar.vue
        │       └── EmptyState.vue
```

---

## Arquitectura de navegación (Híbrida)

```
┌─────────────────────────────────────────────────────┐
│  AppHeader — logo + convocatoria activa + usuario   │
├────────┬────────────────────────────────────────────┤
│        │  StepNav (solo pasos 1-5, sticky top 0)    │
│Sidebar │────────────────────────────────────────────│
│        │  app-main (overflow-y: auto)                │
│+ Nuevo │    ArchivesTab / IdentifiersTab /           │
│  proc. │    ResponsesTab / AnswerKeysTab /           │
│        │    ScoresTab                                │
│📊 Pond │    PonderationsTab (sin StepNav)            │
│🕐 Hist │    HistoryView (sin StepNav)                │
│⚙ Conf  │    ConfigView (sin StepNav)                 │
│💾 Back │  ← BackupModal (overlay, siempre)          │
└────────┴────────────────────────────────────────────┘
```

### Regla de StepNav
`showStepNav = computed(() => ['archives','identifiers','responses','answer_keys','results'].includes(activeTab))`

StepNav se oculta cuando `activeTab` es `'ponderations'`, `'history'` o `'config'`.

### Sidebar colapsable
- Estado persistido en localStorage (`calificador-sidebar-expanded`)
- Expandido: 200px — icono + label
- Colapsado: 56px — solo icono + tooltip
- Indicador activo: barra azul izquierda en el item activo

---

## Flujo de Nuevo Proceso

```
Sidebar [+ Nuevo proceso]
    ↓
NuevoProcesoModal:
  - Carga convocatorias desde API
  - Lista de convocatorias con radio button (preselecciona la activa)
  - Formulario inline para crear nueva convocatoria:
      Tipo [GENERAL    ] Año [2026] Sufijo [I ] (opcional)
      Vista previa: GENERAL 2026 - I
  - Advertencia si hay datos cargados actualmente
  - [Cancelar] [Iniciar proceso →]
    ↓
confirmNewProcess(convocatoria):
  - setActiveConvocatoria(selected)
  - archives.clearAll()
  - identifiers.clearAllIdentifiers()
  - responses.clearAllResponses()
  - answerKeys.clearAllAnswerKeys()
  - calification.resetCalificationResults()
  - activeTab = 'archives'
```

### Nombre de convocatoria compuesto
En `useConvocatoria.createConvocatoria()`:
```js
const name = suffix ? `${tipo} ${year} - ${suffix}` : `${tipo} ${year}`
// Ejemplos:
// GENERAL 2026 - I
// EXTRAORDINARIO 2026
// GENERAL 2026 - II
```

---

## Autenticación JWT

### Backend (`usuarios/views.py`)
```
POST /api/auth/login/    — AllowAny — retorna { access, refresh, user }
POST /api/auth/refresh/  — AllowAny — retorna { access }
GET  /api/auth/me/       — IsAuthenticated — retorna user actual
POST /api/auth/logout/   — IsAuthenticated — logout formal
```

### Frontend (`utils/apiFetch.js`)
- Agrega `Authorization: Bearer <token>` a cada request
- En 401: intenta refresh automáticamente, reintenta la request original
- Si refresh falla: llama `onUnauthorized` (registrado por `useAuth`)

### `useAuth.js` (singleton global)
```js
initialize()   // verifica token existente al montar App
login(user, pass)
logout()
isAuthenticated  // ref<boolean>
user             // ref<{username, first_name, ...}>
```

---

## Modelos de base de datos

### `usuarios` app
Usa el `User` nativo de Django. Sin modelos adicionales.

### `ponderaciones` app
```python
PlantillaPonderacion
  id, name, area (nullable), convocatoria (FK nullable)
  question_total (int, denormalizado — se recalcula en save)
  created_at, updated_at

PlantillaItem
  id, plantilla (FK, CASCADE), subject
  question_count, ponderation (decimal 10,3), order
```

### `convocatorias` app
```python
Convocatoria
  id, name, year, status ('active'|'closed'), created_at, updated_at

Area
  id, convocatoria (FK), name, question_count (default=60), vacantes, order
  unique_together: (convocatoria, name)

DatFormatConfig
  id, convocatoria (OneToOne), header_length, answers_length,
  litho_offset, litho_length, tipo_offset, tipo_length,
  dni_offset, dni_length, aula_offset, aula_length, answers_offset
```

### `resultados` app
```python
ProcesoCalificacion
  id, local_id (unique), name, convocatoria (FK nullable)
  created_by (FK User), created_at, updated_at

AreaCalificacion
  id, proceso (FK), area, timestamp
  correct_value, incorrect_value, blank_value
  plantilla_id, plantilla_name, plantilla_snapshot (JSONField)
  total_candidates, missing_responses, missing_keys, total_weight, answers_length
  unique_together: (proceso, area)

ResultadoCandidato
  id, area_result (FK), dni, paterno, materno, nombres, area, programa
  score (decimal), position, position_in_programa, is_ingresante
  unique_together: (area_result, dni)
```

---

## API Endpoints

```
# Auth
POST   /api/auth/login/
POST   /api/auth/refresh/
GET    /api/auth/me/
POST   /api/auth/logout/

# Plantillas
GET/POST       /api/plantillas/
GET/PATCH/DEL  /api/plantillas/{id}/
GET/POST       /api/plantillas/{id}/items/
GET/PUT/DEL    /api/plantillas/{id}/items/{item_id}/

# Convocatorias
GET/POST       /api/convocatorias/
GET/PUT/DEL    /api/convocatorias/{id}/
POST           /api/convocatorias/{id}/close/
POST           /api/convocatorias/{id}/reopen/
POST           /api/convocatorias/{id}/init_defaults/
GET/POST       /api/areas/
GET/PUT        /api/dat-format/{convocatoria_id}/

# Procesos (historial)
GET/POST       /api/procesos/          — filtra por created_by=request.user
GET/DEL        /api/procesos/{id}/
GET            /api/procesos/{id}/full/ — retorna proceso con areas+resultados completos
```

---

## Flujo de datos — 5 pasos del proceso

```
Paso 1 — Padrón Excel
  → .xlsx: DNI, paterno, materno, nombres, área, programa
  → Mapeo flexible de columnas (aliases en ARCHIVE_KEY_ALIASES)
  → localStorage (STORAGE_KEYS.ARCHIVE)

Paso 2 — Identificadores (.dat)
  → Formato fijo: litho(6) + tipo(1) + DNI(8) + aula(3) + respuestas(60)
  → Construye lookup: litho → DNI
  → localStorage

Paso 3 — Respuestas (.dat)
  → Cruza con identificadores para asignar DNI a cada fila
  → responsesByDni: Map<dni, rows[]>
  → localStorage

Paso 4 — Claves de respuestas
  → área + tipo + 60 chars A-E
  → answerKeyLookupByAreaTipo: Map<"área|tipo", string>
  → localStorage

Paso 5 — Calificación (desde sidebar: Ponderaciones configurado previamente)
  → CalificationModal: área + plantilla + valores correcta/incorrecta/blanco
  → Preflight check: candidatos sin respuesta, respuestas huérfanas, etc.
  → Vacantes por programa configurables en el modal
  → Motor califica → guarda en API (ProcesoCalificacion upsert por local_id)
  → ScoresTab muestra resultados con ingresantes resaltados
```

---

## Motor de calificación

```
Para cada postulante del área seleccionada:
  1. Busca respuestas por DNI (responsesByDni Map)
  2. Busca clave correcta para (área, tipo)
  3. buildQuestionPlan(plantilla.items) → 60 items con su peso normalizado
  4. Para cada posición i de 0..59:
       si responseChar == correctChar → total += correctValue * weight
       si responseChar A-E ≠ correctChar → total += incorrectValue * weight
       si blanco/inválido → total += blankValue * weight
  5. score = round(total, 2)

Ranking por programa (post-score):
  - Agrupa por programa de estudios
  - Ordena por score desc dentro de cada grupo
  - isIngresante = positionInPrograma <= vacantesPrograma[programa]
  - Aplana y ordena globalmente por score desc

Persistencia API:
  - POST /api/procesos/ con local_id (upsert idempotente)
  - bulk_create para ResultadoCandidato (reemplaza los anteriores)
```

---

## Plantillas de ponderación

### Flujo
- Al iniciar sin plantillas → seed automático: UNAP Biomédicas, Sociales, Ingeniería + Modo Simple
- CRUD completo con API: crear, renombrar, eliminar, agregar/editar/eliminar ítems
- Export: descarga JSON `plantillas_YYYY-MM-DD.json`
- Import: lee JSON, POST por cada plantilla a `/api/plantillas/`

### Formato JSON de export/import
```json
[
  {
    "name": "UNAP Biomédicas",
    "area": "Biomédicas",
    "items": [
      { "subject": "Biología", "questionCount": 10, "ponderation": 0.5, "order": 1 }
    ]
  }
]
```

---

## Patrón crítico Vue 3 — reactive(props)

Los composables retornan objetos con `Ref`/`ComputedRef` internos. En componentes hijos:

```js
// OBLIGATORIO en cada tab/view que recibe composable como prop
const ponderations = reactive(props.ponderations)
// Luego en template: ponderations.selectedPlantilla (sin .value)
```

---

## Historial de implementaciones

### Fase 1 — JWT Auth
- `djangorestframework-simplejwt`, access 8h, refresh 30d
- `useAuth.js` singleton, `apiFetch.js` con retry automático
- `LoginPage.vue` two-panel institucional

### Fase 2 — Plantillas en API
- `usePonderations.js` reescrito: `ref([])` en lugar de `useStorage`
- CRUD completo contra `/api/plantillas/` y `/api/plantillas/{id}/items/`
- Seed automático si no hay plantillas
- Export/import JSON en `PonderationsTab.vue`

### Fase 3 — Historial en DB
- Modelos `resultados`: `ProcesoCalificacion`, `AreaCalificacion`, `ResultadoCandidato`
- `useHistory.js` reescrito: fetchHistory, saveProcess, deleteProcess contra API
- `useCalification._saveProcesoToApi()` guarda automáticamente tras calificar
- `HistoryView.vue` — vista central en grid (sin panel flotante)

### Mejoras funcionales
- **Preflight check** en CalificationModal: diagnóstico antes de calificar
- **Vacantes por programa** en CalificationModal: inputs por programa con límite de ingresantes
- **ConfigView.vue** — vacantes + formato DAT como vista central (sin panel flotante)

### Navegación híbrida (sidebar)
- `AppSidebar.vue` — colapsable, Nuevo proceso + Ponderaciones + Historial + Config + Backup
- `StepNav` — solo 5 pasos del proceso, se oculta en vistas de herramientas
- `app-layout`: `height: 100vh; overflow: hidden` → `app-body` flex → `app-content` (overflow hidden) → `app-main` (overflow-y: auto)

### Convocatoria unificada
- `NuevoProcesoModal.vue` — punto único de entrada: selecciona convocatoria → limpia datos → paso 1
- Nombre compuesto: `${tipo} ${año}` o `${tipo} ${año} - ${sufijo}`
- Header: convocatoria es solo informativa + gestión (no punto de inicio de proceso)

---

## PENDIENTES — Próximas implementaciones

### Alta prioridad

#### 1. Nombre editable al guardar proceso
**Qué es:** Antes de guardar al historial, mostrar un input para que el usuario escriba un nombre descriptivo.  
**Dónde:** En `ScoresTab.vue`, botón "Guardar en historial" → mini modal o inline input.  
**Archivos:** `ScoresTab.vue`, `useHistory.saveProcess()`.

#### 2. PDF oficial de ingresantes
**Qué es:** Documento formal con numeración correlativa, cabecera institucional (logo UNAP, convocatoria, área, fecha), espacio para firma y sello del director.  
**Herramienta sugerida:** `jsPDF` o `pdfmake`.  
**Archivos:** `useExport.js`, `ScoresTab.vue`.

#### 3. Notificaciones toast
**Qué es:** Reemplazar los `alert()` y mensajes inline por un sistema de toasts central (éxito, error, info).  
**Implementación:** Composable `useToast.js` + componente `ToastContainer.vue` en `App.vue`.  
**Archivos a modificar:** `App.vue`, `NuevoProcesoModal.vue`, `usePonderations.js`, `useHistory.js`.

### Media prioridad

#### 4. Detalle pregunta por pregunta
**Qué es:** Para cada candidato en resultados, tabla de 60 filas: qué marcó vs cuál era la correcta, coloreado verde/rojo/gris. Herramienta de revisión e impugnación.  
**Complejidad:** Alta — requiere guardar las respuestas individuales en `ResultadoCandidato` (nueva columna `answers_raw` en el modelo).  
**Archivos:** `resultados/models.py`, `useCalification.js`, `ScoresTab.vue`.

#### 5. Gestión de usuarios
**Qué es:** Crear/desactivar operadores desde la app sin entrar al admin Django.  
**Archivos:** Nueva vista en sidebar, nuevo endpoint `usuarios/views.py`.

### Infraestructura

#### 6. Deploy
**Qué es:** Despliegue en servidor para uso multiusuario real.  
**Stack sugerido:** Nginx + Gunicorn + servidor Linux.  
**Pendiente por:** decisión del cliente sobre servidor.

---

## Bugs conocidos resueltos

| Bug | Causa | Fix |
|---|---|---|
| Pantalla blanca (composables) | Refs no se desenvuelven a través de props | `reactive(props.xxx)` en cada tab |
| DataTable selectAll ref | `:ref` asigna a prop readonly | Ref local + prop `isIndeterminate` |
| Modal sin scroll | `max-height` en flex child con overflow | `overflow-y: auto` en `app-main`, `overflow: hidden` en `app-content` |
| StepNav cubriendo contenido | `position: sticky` conflicto con `overflow-y: auto` en padre | Sticky removido, scroll solo en `app-main` |
| simplejwt no encontrado | Instalado en Python global, no en venv | Reinstalar en venv con `venv/Scripts/python.exe -m pip install` |
| Preflight bloqueaba calificación | `hasBlockers` incluía falta de claves | Solo bloquea si `candidates.length === 0` |
