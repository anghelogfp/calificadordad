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

## Implementado al 2026-04-10

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

### Archivos pendientes de commit (2026-04-10)

**Modificados:**
- `frontend/src/App.vue`
- `frontend/src/components/panels/ConfigPanel.vue`
- `frontend/src/components/tabs/ScoresTab.vue`
- `frontend/src/components/views/ConfigView.vue`
- `frontend/src/composables/useExport.js`
- `frontend/src/composables/useHistory.js`

**Nuevos (untracked):**
- `frontend/src/components/shared/ToastContainer.vue`
- `frontend/src/composables/useToast.js`

**Mensaje de commit sugerido:**
```
feat: add toast notifications, editable save name, and PDF ingresantes export
```

---

## Pendientes (orden de prioridad)

1. **Detalle pregunta por pregunta** *(alto esfuerzo)*
   - Nueva columna `answers_raw` en `ResultadoCandidato`
   - Vista comparativa por candidato en ScoresTab

2. **Gestión de usuarios** *(medio esfuerzo)*
   - Crear/desactivar operadores desde la app

3. **Deploy** — pendiente decisión de servidor
