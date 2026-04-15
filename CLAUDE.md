# Calificador DAD — Contexto para Claude

## Stack
- **Frontend:** Vue 3 + Vite (`frontend/src/`)
- **Backend:** Django 6.0 REST Framework (`backend/`)
- **DB:** SQLite (`backend/db.sqlite3`)

---

## Arquitectura frontend — 5 pasos en el stepper

1. **ArchivesTab** — Padrón Excel (.xlsx)
2. **IdentifiersTab** — Identificadores (.dat)
3. **ResponsesTab** — Respuestas (.dat)
4. **AnswerKeysTab** — Claves de respuestas
5. **ResultsTab** — Calificación + ranking + export

Vistas centrales (sin StepNav): Ponderaciones, Historial, Config.

---

## Composables clave

- `useAuth.js` — JWT singleton, access 8h / refresh 30d
- `apiFetch.js` — fetch con retry automático en 401
- `useConvocatoria.js` — sesiones de examen CRUD
- `useAreas.js` — áreas dinámicas desde API
- `useDatFormat.js` — configuración del formato .dat
- `usePonderations.js` — plantillas API-backed (`/api/plantillas/`)
- `useHistory.js` — historial en DB (`/api/procesos/`)
- `useExport.js` — Excel + PDF ingresantes
- `useBackup.js` — backup/restore JSON de la sesión
- `useToast.js` — singleton, `showToast(msg, type, duration=3000)`

---

## Patrón Vue obligatorio

En cada componente que recibe un composable como prop:
```js
const xxx = reactive(props.xxx)
```
Sin esto los refs no se auto-desenvuelven en el template (pantalla blanca).

---

## Composables clave (adicionales)

- `useVerificador.js` — CRUD de sesiones del verificador (`/api/verificador/`)

---

## Navegación

- Tab activo persiste en `localStorage` via `useStorage('calificador-active-tab', 'dashboard')`
- Entrada por defecto: **Dashboard** (`DashboardHomeView.vue`)
- Vistas del stepper (pasos 1-5): muestran `StepNav` arriba
- Vistas secundarias (Ponderaciones, Historial, Config, Verificador): sin StepNav
- **Breadcrumb** `← Inicio / [Sección]` aparece en todas las vistas excepto Dashboard
- Logo del header es clickeable → navega al Dashboard

## Layout AppHeader

- Altura: 76px, logo UNAP 48px
- 3 líneas de texto: Universidad / Dirección de Admisión / Sistema de Calificación · [convocatoria]
- Click en la marca (logo + texto) emite `go-home` → `activeTab = 'dashboard'`
- Font: **Inter** (Google Fonts) — mejor legibilidad de caracteres ambiguos (i/l/I)

---

## Implementado al 2026-04-14

- Autenticación JWT (`LoginPage.vue` two-panel institucional UNAP)
- Plantillas de ponderaciones API-backed con seed automático (Biomédicas/Sociales/Ingeniería/Modo Simple)
- Historial de procesos en DB (modelos: `ProcesoCalificacion`, `AreaCalificacion`, `ResultadoCandidato`)
- Guardado automático tras calificar
- Nombre editable al guardar proceso (input inline en ScoresTab)
- Navegación sidebar colapsable 200px/56px
- `NuevoProcesoModal.vue` — selecciona/crea convocatoria y limpia datos
- Toast notifications (`ToastContainer.vue` fixed top-right, TransitionGroup)
- PDF oficial ingresantes — logo UNAP, agrupado por área, pie con paginación
- Vacantes configurables por área en CalificationModal
- Preflight check antes de calificar
- **Detalle pregunta por pregunta** — `CandidateDetailModal.vue` completo:
  - Botón por candidato en ScoresTab (deshabilitado si no hay `answersRaw`)
  - Modal con tabla: N° | Curso | Marc. | Corr. | Pond. | Pts | Acum.
  - Colores: verde correctas, rojo incorrectas, azul columna Correcto, dorado última fila Acum.
  - Stats bar: correctas / incorrectas / en blanco + valores de ponderación + plantilla
  - Campos candidato: DNI, Litho, Aula, Tipo, Cor.ID, Área, Posición, Programa
  - Exportar PDF una sola hoja A4: encabezado UNAP, card candidato con puntaje final en cuadro dorado, dos columnas de preguntas (split dinámico), footer con fecha/hora y usuario
  - Todos los puntajes con 3 decimales
  - Nuevos campos en `ResultadoCandidato`: `answers_raw`, `correct_answers_raw`, `aula`, `tipo`, `litho`, `cor_id`
  - Migración aplicada: `0002_add_detail_fields_to_resultado.py`

## Implementado al 2026-04-29

- **Verificador manual de respuestas** — `VerificadorView.vue` (vista central, sidebar entre Config y Backup)
  - Sub-tab **Nueva verificación**: selector de plantilla + valores editables (correcta/incorrecta/blanco, default 10/0/2)
  - Campos del candidato (jerárquicos, 3 filas): Proceso/Tipo → Nombre/DNI/Aula → Área/Programa/Posición
  - Dos grids de 60 celdas: claves correctas + respuestas del candidato
  - Acepta A-E y 1-5; display muestra lo ingresado, cálculo y PDF siempre usan A-E
  - Sobreescritura directa: tipear nueva letra/número en celda ocupada la reemplaza sin Delete
  - Navegación por teclado: auto-avance al tipear, flechas, Backspace retrocede, Delete limpia
  - Cálculo reactivo: stats bar + tabla N°|Curso|Marc.|Corr.|Pond.|Pts|Acum. con colores
  - Última fila de la tabla: solo celda Acum. resaltada en ámbar (puntaje final), no toda la fila
  - Sub-tab **Historial**: tarjetas con proceso (azul), nombre/DNI, tags pill (área/aula/posición/tipo)
  - Export PDF: encabezado con proceso si está cargado, card compacta (38mm), dos columnas de preguntas, footer fecha/usuario
  - Backend: modelo `VerificadorSesion` con campos `proceso`, `aula`, `posicion`, `tipo_prueba`
  - Migraciones: `0003_add_verificador_sesion.py`, `0004_add_verificador_extra_fields.py`

## Implementado al 2026-05-XX (esta sesión)

- **UX/UI general**
  - Font cambiado de Plus Jakarta Sans a **Inter** (mejor legibilidad i/l/I)
  - AppHeader rediseñado: 76px alto, logo 48px, 3 líneas institucionales, click en logo → inicio
  - Breadcrumb `← Inicio / Sección` en todas las vistas (incluye pasos del stepper)
  - Sidebar: ítem activo muestra `›` a la derecha
  - `ConvocatoriaPanel` convertido a **modal centrado** (de slide-in derecho a modal con `scaleIn`)
  - Gestión de convocatoria movida del header al **ConfigView** (botón "Gestionar convocatoria")
  - `DashboardHomeView.vue` — pantalla de bienvenida con procesos recientes, accesos rápidos y convocatoria activa

- **Limpieza de código**
  - Eliminados: `ConfigPanel.vue`, `HistoryPanel.vue` (reemplazados por sus respectivas Views)
  - `useHistory.js`: eliminados `showHistoryPanel`, `openHistoryPanel`, `closeHistoryPanel` (sin uso)

## Implementado (sesión actual)

- **Paginación en tablas** (`useTableState.js` + `DataTable.vue`)
  - `useTableState` expone `pagedRows`, `pagination`, `goToPage` — solo renderiza 100 filas por página
  - `DataTable` muestra footer con controles `«  ‹  1 … n  ›  »` y texto "Mostrando X–Y de Z registros"
  - Aplicado en ArchivesTab, IdentifiersTab, ResponsesTab, AnswerKeysTab
  - Búsqueda y cambio de datos resetean a página 1 automáticamente

- **Debounce de localStorage** (`useTableState.js`)
  - Reemplazado `useStorage` en el array de filas por `ref` + `watchDebounced` (400 ms)
  - Elimina el stringify de 10k filas en cada cambio individual
  - Compatible con el sistema de backup (usa `window.location.reload()` tras restaurar)

- **Convocatoria Real / Simulacro** (`useCalification.js`, `CalificationModal.vue`, `ScoresTab.vue`, `useExport.js`)
  - Toggle **Simulacro | Convocatoria Real** en `CalificationModal` — guarda `activeProcess.type`
  - `processType` persiste en `activeProcess`, se restaura al cargar historial
  - Preflight: advertencia si modo real y postulantes sin `programa` asignado
  - `ScoresTab` modo simulacro → tabla plana (comportamiento anterior)
  - `ScoresTab` modo real → secciones por carrera con encabezado azul (postulantes / vacantes / ingresantes), posición dentro de carrera (`positionInPrograma`)
  - `exportIngresantesPdf` modo simulacro → tabla plana con columna Programa
  - `exportIngresantesPdf` modo real → filas separadoras por carrera con nombre + conteo, sin columna Programa; archivo `ingresantes-real-*.pdf`

---

## Pendientes (orden de prioridad)

1. **Gestión de usuarios** *(medio esfuerzo)*
   - Backend: endpoints `GET/POST /api/usuarios/`, `PATCH /api/usuarios/:id/`, `POST /api/usuarios/:id/set-password/`
   - Frontend: sección en `ConfigView` o vista nueva — tabla de operadores, crear/desactivar
   - Solo visible para `is_staff = true`

2. **Deploy** — pendiente decisión de servidor
   - Opción A: local en red (nginx + whitenoise, una sola máquina)
   - Opción B: VPS (Dockerfile + PostgreSQL)
