# Documento Historico

Este documento se conserva como referencia historica. Puede estar desactualizado y no debe tomarse como fuente normativa del estado actual. Ver la documentacion vigente en `README.md` y `docs/`.

# Migracion de datos a base de datos

## Estado general

Se inicio la migracion de los datos principales de negocio desde `localStorage` hacia la API/Django. La idea aplicada fue conservadora:

- La base de datos queda como fuente principal.
- `localStorage` queda como respaldo local/fallback cuando la API no responde.
- En el primer arranque, si la API esta vacia pero existe data local, el frontend sincroniza esa data local hacia la API.
- Las preferencias de interfaz siguen siendo locales porque no son datos de negocio.

## Datos ya migrados a API/DB

### Padron / candidatos

Backend:

- Modelo: `Candidato`
- Endpoint:
  - `GET /api/candidatos/`
  - `POST /api/candidatos/bulk_replace/`
- Migracion: `backend/convocatorias/migrations/0003_candidato.py`

Frontend:

- Composable: `frontend/src/composables/useArchives.js`
- Inicializacion desde `App.vue` con `archives.initializeArchives()`.

### Identificadores

Backend:

- Modelos:
  - `IdentifierSource`
  - `IdentifierRow`
- Endpoints:
  - `GET /api/identifier-sources/`
  - `GET /api/identificadores/`
  - `POST /api/identificadores/bulk_replace/`
- Migracion: `backend/convocatorias/migrations/0004_identifiersource_identifierrow_and_more.py`

Frontend:

- Composable: `frontend/src/composables/useIdentifiers.js`
- Inicializacion desde `App.vue` con `identifiers.initializeIdentifiers()`.

### Respuestas

Backend:

- Modelos:
  - `ResponseSource`
  - `ResponseRow`
- Endpoints:
  - `GET /api/response-sources/`
  - `GET /api/respuestas/`
  - `POST /api/respuestas/bulk_replace/`
- Migracion: `backend/convocatorias/migrations/0005_responsesource_responserow_and_more.py`

Frontend:

- Composable: `frontend/src/composables/useResponses.js`
- Inicializacion desde `App.vue` con `responses.initializeResponses()`.

### Claves de respuestas

Backend:

- Modelos:
  - `AnswerKeySource`
  - `AnswerKeyRow`
- Endpoints:
  - `GET /api/answer-key-sources/`
  - `GET /api/answer-keys/`
  - `POST /api/answer-keys/bulk_replace/`
- Migracion: `backend/convocatorias/migrations/0006_answerkeysource_answerkeyrow_and_more.py`

Frontend:

- Composable: `frontend/src/composables/useAnswerKeys.js`
- Inicializacion desde `App.vue` con `answerKeys.initializeAnswerKeys()`.

### Vacantes por programa

Backend:

- Modelo: `ProgramaVacante`
- Endpoints:
  - `GET /api/programa-vacantes/`
  - `POST /api/programa-vacantes/bulk_replace/`
- Migracion: `backend/convocatorias/migrations/0007_programavacante.py`

Frontend:

- Composable: `frontend/src/composables/useVacantesPrograma.js`
- Inicializacion desde `App.vue` con `vacantesPrograma.initializeVacantesPrograma()`.

### Configuracion de calificacion por area

Backend:

- Modelo: `CalificationConfig`
- Endpoints:
  - `GET /api/calification-configs/`
  - `POST /api/calification-configs/bulk_replace/`
- Migracion: `backend/convocatorias/migrations/0008_calificationconfig.py`

Frontend:

- Composable: `frontend/src/composables/useCalification.js`
- Inicializacion desde `App.vue` con `calification.initializeCalificationConfig()`.
- Guarda los valores:
  - `correctValue`
  - `incorrectValue`
  - `blankValue`

### Ponderaciones y procesos

Ya estaban apoyados en API antes de esta fase:

- Ponderaciones:
  - Composable: `frontend/src/composables/usePonderations.js`
  - Endpoints de plantillas/items.

- Historial/procesos:
  - Composable: `frontend/src/composables/useHistory.js`
  - Endpoint: `/api/procesos/`
  - Los resultados de calificacion se guardan en backend desde `useCalification.js`.

### Formato DAT

Ya estaba apoyado en API:

- Composable: `frontend/src/composables/useDatFormat.js`
- Endpoint: `/api/dat-format-configs/`

## Cambios en arranque de la aplicacion

Archivo: `frontend/src/App.vue`

Se agrego un flujo de inicializacion autenticada para cargar datos desde la API despues del login:

1. `archives.initializeArchives()`
2. `identifiers.initializeIdentifiers()`
3. `responses.initializeResponses()`
4. `answerKeys.initializeAnswerKeys()`
5. `vacantesPrograma.initializeVacantesPrograma()`
6. `calification.initializeCalificationConfig()`
7. `ponderations.initializePonderations()`

Tambien se habia corregido antes el problema de pantalla en blanco por inicializacion asincrona, evitando que Vue intente renderizar componentes con datos incompletos.

## Backup

Archivo: `frontend/src/composables/useBackup.js`

Se actualizo a version 3.

Antes:

- Exportaba/restauraba principalmente `localStorage`.
- Eso ya no era correcto porque los datos principales ahora viven en DB.

Ahora:

- Exporta datos desde la API:
  - candidatos
  - identificadores
  - respuestas
  - claves
  - vacantes por programa
  - configuracion de calificacion
  - formato DAT
  - plantillas
  - procesos/historial
- Mantiene una seccion `localUi` para preferencias locales.
- Tiene fallback local si la API no responde.
- Importa backups nuevos restaurando por endpoints.
- Mantiene compatibilidad basica con backups antiguos que solo tengan `data`.

Archivo: `frontend/src/components/modals/BackupModal.vue`

Se ajusto el texto del modal:

- Exportar ahora indica que respalda datos del servidor.
- Importar muestra estado de carga.
- Limpiar ahora dice que limpia datos locales del navegador, no la base de datos.

## Datos que siguen correctamente en localStorage

Estos datos pueden seguir en `localStorage` porque son estado local de UI o cache/fallback:

- Tab activo.
- Subtabs activos.
- Sidebar expandido.
- Tokens de autenticacion, segun el diseno actual.
- Metadata liviana del proceso activo.
- Cache local de tablas como fallback si la API no responde.

## Verificaciones realizadas

Backend:

```bash
cd backend
../venv/bin/python manage.py check
../venv/bin/python manage.py migrate
../venv/bin/python manage.py makemigrations convocatorias --check --dry-run
```

Resultado:

- Django check pasa.
- Migraciones aplicadas.
- No hay migraciones pendientes.
- Queda un warning no bloqueante:

```text
staticfiles.W004: The directory 'backend/static' in the STATICFILES_DIRS setting does not exist.
```

Frontend:

```bash
cd frontend
npm run build
```

Resultado:

- Build pasa.
- Queda un warning no bloqueante de Vite por chunks grandes.

Endpoint probado manualmente:

- `/api/calification-configs/bulk_replace/`
- Se creo un registro temporal, se leyo correctamente y luego se elimino.

## Archivos principales modificados

Backend:

- `backend/convocatorias/models.py`
- `backend/convocatorias/serializers.py`
- `backend/convocatorias/views.py`
- `backend/convocatorias/urls.py`
- `backend/convocatorias/migrations/0003_candidato.py`
- `backend/convocatorias/migrations/0004_identifiersource_identifierrow_and_more.py`
- `backend/convocatorias/migrations/0005_responsesource_responserow_and_more.py`
- `backend/convocatorias/migrations/0006_answerkeysource_answerkeyrow_and_more.py`
- `backend/convocatorias/migrations/0007_programavacante.py`
- `backend/convocatorias/migrations/0008_calificationconfig.py`

Frontend:

- `frontend/src/App.vue`
- `frontend/src/composables/useArchives.js`
- `frontend/src/composables/useIdentifiers.js`
- `frontend/src/composables/useResponses.js`
- `frontend/src/composables/useAnswerKeys.js`
- `frontend/src/composables/useVacantesPrograma.js`
- `frontend/src/composables/useCalification.js`
- `frontend/src/composables/useBackup.js`
- `frontend/src/components/modals/BackupModal.vue`

Tambien existen cambios previos relacionados a bugs:

- `frontend/src/components/views/UsuariosView.vue`
- `frontend/src/components/tabs/ScoresTab.vue`

## Que falta

### 1. Probar flujo completo en navegador

Orden recomendado:

1. Iniciar backend.
2. Iniciar frontend.
3. Login.
4. Cargar padron.
5. Cargar identificadores.
6. Cargar respuestas.
7. Cargar claves.
8. Configurar vacantes.
9. Configurar ponderaciones si aplica.
10. Calificar.
11. Guardar/ver historial.
12. Recargar pagina.
13. Cerrar sesion y volver a entrar.
14. Confirmar que los datos vuelven desde DB.

### 2. Probar backup con datos reales

Escenario recomendado:

1. Crear datos reales de prueba.
2. Exportar backup.
3. Restaurarlo con un usuario/base limpia.
4. Confirmar que vuelve:
   - padron
   - identificadores
   - respuestas
   - claves
   - vacantes
   - ponderaciones
   - configuracion de calificacion
   - historial/procesos

### 3. Mover backup al backend

La version actual funciona desde frontend llamando varios endpoints.

Para un nivel mas profesional, conviene crear endpoints especificos:

- `GET /api/backup/export/`
- `POST /api/backup/import/`

Ventajas:

- Restauracion en una sola transaccion.
- Mejor control de validaciones.
- Menos riesgo de restauracion parcial.
- Mejor manejo de errores.

### 4. Reducir localStorage despues de validar

Una vez confirmado que la DB funciona bien:

- Mantener solo preferencias UI y tokens.
- Eliminar llaves antiguas de datos de negocio.
- Revisar `useTableState` para que quede claramente como cache/fallback, no fuente principal.

### 5. Corregir warning de Django static

Crear carpeta:

```bash
mkdir -p backend/static
```

O ajustar `STATICFILES_DIRS` si esa carpeta ya no debe usarse.

### 6. Optimizar bundle frontend

Vite muestra warning por chunk grande.

Pendiente tecnico:

- Separar chunks con `manualChunks`.
- Evaluar carga diferida de modulos pesados como Excel/PDF/exportaciones.

## Comandos utiles para continuar

Backend:

```bash
cd backend
../venv/bin/python manage.py runserver
../venv/bin/python manage.py check
../venv/bin/python manage.py migrate
../venv/bin/python manage.py makemigrations --check --dry-run
```

Frontend:

```bash
cd frontend
npm run dev
npm run build
```

Busqueda de uso local:

```bash
rg -n "localStorage|useStorage\\(|STORAGE_KEYS" frontend/src
```

Estado git:

```bash
git status --short
git diff --stat
```

## Recomendacion para el siguiente paso

No seguir refactorizando hasta hacer una prueba completa en navegador con datos reales o datos representativos.

El siguiente paso mas seguro es validar el flujo completo con backend y frontend levantados, porque ya se toco persistencia central y es importante confirmar comportamiento real antes de reducir mas `localStorage` o mover el backup al backend.
