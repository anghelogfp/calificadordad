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

---

## Pendientes (orden de prioridad)

1. **Verificador manual de respuestas** *(baja-media)*
   - Vista central nueva: `VerificadorView.vue` — ítem en sidebar debajo de Backup
   - Selector de plantilla (dropdown `usePonderations`) → carga columna Correcto automáticamente
   - Campos opcionales del postulante: DNI, nombre, área, programa
   - Grid 60 celdas editables (A/B/C/D/E o blanco) con navegación por teclado — al escribir letra avanza celda
   - Cálculo reactivo en tiempo real: puntaje, correctas/incorrectas/blancos
   - Tabla comparativa igual a `CandidateDetailModal`: N° | Curso | Marc. | Corr. | Pond. | Pts | Acum.
   - Export PDF igual al detalle existente
   - Reutiliza: `buildQuestionPlan()`, lógica de cálculo de `CandidateDetailModal`, `usePonderations`
   - Uso: verificar 1-3 candidatos puntuales sin necesidad de padrón ni .dat cargados

2. **Gestión de usuarios** *(medio esfuerzo)*
   - Crear/desactivar operadores desde la app

3. **Deploy** — pendiente decisión de servidor
