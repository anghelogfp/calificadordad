# Estado del endurecimiento del core

Fecha: 2026-07-01

## Objetivo

Hacer más robusto el core de la aplicación de calificación, principalmente:

- parseo de archivos `.dat`
- vinculación de identificadores, respuestas y claves
- cálculo de puntajes
- ranking
- ingresantes por vacantes
- validaciones antes y después de calcular

## Avance completado

### 1. Cobertura de parseo

Se amplió la cobertura de `frontend/src/utils/__tests__/parsers.test.js`.

Ahora se prueba:

- `parseIdentifierLine`
  - línea válida completa
  - extracción de cabecera, lectura, examCode, folio, indicador, litho, tipo, DNI, aula y respuestas
  - líneas vacías o de relleno
  - línea corta
  - cabecera inválida
  - código de examen ausente
  - folio ausente
  - indicador ausente

- `parseResponseLine`
  - línea válida con offset por defecto
  - `responseAnswersOffset` personalizado
  - línea corta
  - cabecera inválida

- `detectResponseAnswersOffset`
  - casos negativos existentes
  - caso positivo detectando offset correcto

- `readLinesFromFile`
  - normalización de saltos `\r\n`, `\r`, `\n`
  - eliminación de `\u001a`
  - ignorar líneas vacías

### 2. Cobertura inicial de calificación

Se agregó `frontend/src/composables/__tests__/useCalification.test.js`.

Ahora se prueba:

- simulacro general
  - clave general
  - cálculo de puntaje
  - ranking global
  - resumen

- no calificados
  - DNI incompleto
  - candidato sin respuesta
  - respuesta duplicada
  - respuesta sin DNI vinculada como `unlinkedResponses`

- convocatoria real
  - exige claves `P/Q/R/S/T`
  - tipo inválido queda no calificado
  - ranking global
  - ranking por programa
  - `isIngresante` según vacantes

### 3. Motor puro de calificación

Se creó:

```txt
frontend/src/domain/calification/calculateResults.js
```

Exporta:

```js
calculateAreaResults(...)
```

Responsabilidad:

- calcular puntajes
- generar resultados
- generar resumen
- manejar no calificados
- aplicar modo simulacro/general/real
- aplicar ranking global
- aplicar ranking por programa
- marcar ingresantes según vacantes

`useCalification.js` ya no contiene el cálculo grande directamente. Ahora arma el payload desde sus refs/computed y llama a `calculateAreaResults`.

Tests directos:

```txt
frontend/src/domain/calification/__tests__/calculateResults.test.js
```

Cubren:

- cálculo puro sin Vue
- rechazo de plantilla incompleta
- rechazo de clave con respuesta inválida
- ingresantes por programa en proceso real

### 4. Validador posterior de resultados

Se creó:

```txt
frontend/src/domain/calification/validateResults.js
```

Exporta:

```js
validateCalificationResult(...)
```

Responsabilidad:

- verificar que `score` sea número finito
- verificar que `position` global sea secuencial
- verificar longitud de `answersRaw`
- verificar longitud de `correctAnswersRaw`
- impedir que un DNI esté en `results` y `noCalificados`
- verificar que `summary.totalCandidates === results.length + noCalificados.length`
- en modo real:
  - exigir programa en todo resultado calificado
  - verificar `positionInPrograma` secuencial
  - impedir ingresantes sin vacantes
  - impedir ingresantes fuera de cupo
- en simulacro:
  - advertir si hay `isIngresante`

Tests:

```txt
frontend/src/domain/calification/__tests__/validateResults.test.js
```

### 5. Preflight puro

Se creó:

```txt
frontend/src/domain/calification/preflight.js
```

Exporta:

```js
buildCalificationPreflight(...)
```

Responsabilidad:

- validar condiciones antes de calcular
- devolver el mismo contrato que la UI ya usaba:

```js
{
  items,
  hasBlockers,
  hasWarnings
}
```

Ahora `useCalification.js` delega el `preflightCheck` a esta función pura.

Tests:

```txt
frontend/src/domain/calification/__tests__/preflight.test.js
```

Cubren:

- caso limpio sin blockers ni warnings
- falta de candidatos
- falta de claves
- DNI inválido
- respuesta faltante
- respuesta duplicada
- respuesta huérfana
- respuesta sin DNI
- fallback de simulacro con candidatos sin área
- modo real exigiendo claves `P/Q/R/S/T`
- modo real con respuesta sin tipo
- modo real con candidato sin programa
- simulacro general con clave general

### 6. Vinculación identificador-respuesta

Se agregó:

```txt
frontend/src/composables/__tests__/useResponses.test.js
```

Ahora se prueba `applyIdentifierDataToResponseRow`, punto crítico donde una fila de respuesta recibe datos del identificador.

Casos cubiertos:

- match exacto por `litho|indicator|folio`
- preferencia del match exacto sobre fallback por `litho`
- fallback por `litho` cuando no hay match exacto
- copia de `dni`, `tipo` y `aula` desde identificadores
- recálculo de observaciones después de vincular
- normalización de DNI y tipo cuando no hay identificador
- observaciones cuando la respuesta queda sin vínculo útil
- agrupación de `responsesByDni` por DNI normalizado

### 7. Importación y validación de claves

Se agregó:

```txt
frontend/src/composables/__tests__/useAnswerKeys.test.js
```

Ahora se prueba:

- `createAnswerKeyRow`
  - clave general sin área
  - clave por área
  - normalización de área
  - `scope` general vs área

- `buildAnswerKeyObservation`
  - tipo faltante en clave por área
  - litho incompleto
  - respuestas vacías
  - respuestas incompletas
  - respuestas inválidas

- `readGeneralAnswerKeyFile`
  - importación de clave general desde archivo de respuestas `.dat`
  - registro de source general

- `readAnswerKeyFiles`
  - importación de claves por área cruzando identificador + respuesta
  - match exacto por `litho|indicator|folio`
  - fallback por `litho`
  - caso sin coincidencia en identificador
  - observaciones por tipo faltante y falta de coincidencia

- lookups
  - `answerKeyLookupByAreaTipo`
  - `answerKeyFallbackByArea`

### 8. Auditoría no bloqueante de resultados

Se conectó `validateCalificationResult` en runtime desde:

```txt
frontend/src/composables/useCalification.js
```

Comportamiento:

- después de calcular un área, se validan invariantes del resultado
- si el resultado es válido, no hace nada visible
- si el resultado tiene errores de invariantes, registra:

```js
console.warn('[calification] Resultado calculado con invariantes inválidas:', validation)
```

- no bloquea el cálculo
- no bloquea el guardado
- no muestra alerta al usuario

Objetivo:

- empezar con auditoría segura sin cambiar UX
- detectar inconsistencias internas si aparecen en producción o desarrollo
- dejar preparado el camino para decidir más adelante si ciertos errores deben bloquear guardado

También se agregó cobertura en:

```txt
frontend/src/composables/__tests__/useCalification.test.js
```

Caso cubierto:

- si el validador retorna inválido, la calificación sigue generando resultados y emite `console.warn`

### 9. Bloqueo por preflight con blockers

Se endureció `runCalification` en:

```txt
frontend/src/composables/useCalification.js
```

Comportamiento:

- si `preflightCheck.value.hasBlockers === true`, no ejecuta el cálculo
- usa el detalle específico del primer item con `status: 'error'`
- muestra el error con `showToast`
- no llama al motor de cálculo
- no ejecuta auditoría posterior

También se aplicó el mismo criterio en `runAllAreas`:

- cada área se revisa con `buildCalificationPreflight`
- si tiene blockers, se agrega a `skippedDetails`
- las demás áreas pueden seguir calculándose

Se agregó cobertura en:

```txt
frontend/src/composables/__tests__/useCalification.test.js
```

Casos cubiertos:

- bloquea cuando no hay candidatos
- sigue permitiendo calcular cuando solo hay warnings manejables como DNI inválido, respuesta faltante o respuesta duplicada

### 10. Backend: aislamiento por usuario y bulk replace

Se agregó:

```txt
backend/convocatorias/tests.py
```

Cobertura agregada:

- `CandidatoViewSet.bulk_replace`
  - reemplaza datos solo del usuario autenticado
  - no toca datos de otro usuario
  - listado devuelve solo candidatos del usuario actual

- `IdentifierRowViewSet.bulk_replace`
  - reemplaza fuentes y filas solo del usuario autenticado
  - conserva datos de otro usuario
  - vincula filas con su `IdentifierSource` por `sourceId`

- `ResponseRowViewSet.bulk_replace`
  - reemplaza fuentes y filas solo del usuario autenticado
  - conserva datos de otro usuario
  - vincula filas con su `ResponseSource` por `sourceId`

- `AnswerKeyRowViewSet.bulk_replace`
  - reemplaza fuentes y filas solo del usuario autenticado
  - conserva datos de otro usuario
  - vincula filas con su `AnswerKeySource` por `sourceId`

- `ProgramaVacanteViewSet.bulk_replace`
  - reemplaza vacantes solo del usuario autenticado
  - conserva vacantes de otro usuario
  - normaliza valores inválidos o negativos a `0`
  - ignora programas vacíos

- `CalificationConfigViewSet.bulk_replace`
  - reemplaza configuración solo del usuario autenticado
  - conserva configuración de otro usuario
  - ignora entradas inválidas o sin área

### 11. Backend: autenticación y administración de usuarios

Se amplió:

```txt
backend/usuarios/tests.py
```

Cobertura agregada:

- autenticación
  - login correcto devuelve `access`, `refresh` y payload de usuario
  - login rechaza credenciales faltantes
  - login rechaza contraseña incorrecta
  - login rechaza usuario inexistente
  - login rechaza usuario inactivo

- refresh token
  - requiere token
  - rechaza token inválido
  - acepta refresh válido y devuelve access token

- sesión
  - `/api/auth/me/` requiere autenticación
  - `/api/auth/logout/` requiere autenticación
  - usuario autenticado obtiene su payload en `me`
  - logout autenticado responde correctamente

- administración de usuarios
  - usuario normal no puede listar, crear, editar ni cambiar contraseña
  - admin puede listar usuarios
  - admin puede crear usuarios
  - creación valida usuario/password requeridos
  - creación rechaza username duplicado
  - admin puede editar usuario regular
  - edición rechaza username duplicado
  - edición de usuario inexistente devuelve 404
  - admin staff no puede editar superusuario
  - superusuario sí puede editar superusuario
  - admin puede cambiar contraseña
  - cambio de contraseña rechaza password vacío
  - cambio de contraseña en usuario inexistente devuelve 404

### 12. Backend: procesos de calificación y verificador

Se amplió:

```txt
backend/resultados/tests.py
```

Cobertura agregada para procesos:

- validaciones de creación
  - `local_id` requerido
  - `name` requerido
  - `areas` debe ser objeto

- endpoint `/api/procesos/{id}/full/`
  - devuelve formato compatible con frontend
  - incluye `id`, `dbId`, `name`, `type`, `simulacroScope`, `savedAt`
  - incluye resumen por área
  - incluye resultados con score, ranking e ingresante

- aislamiento por usuario
  - otro usuario no puede recuperar proceso ajeno
  - otro usuario no puede acceder a `/full/` de proceso ajeno
  - otro usuario no puede borrar proceso ajeno
  - listado devuelve solo procesos del usuario autenticado

Cobertura agregada para verificador:

- crear sesión autenticada
- `created_by` se toma del usuario autenticado
- editar sesión propia
- recuperar sesión propia
- eliminar sesión propia
- listar solo sesiones propias
- no recuperar, editar ni borrar sesiones de otro usuario

### 13. CI automático

Se agregó:

```txt
.github/workflows/ci.yml
```

El workflow corre en:

- push a `main`
- push a `master`
- push a `develop`
- pull requests

Jobs:

- frontend
  - instala dependencias con `npm ci`
  - ejecuta `npm run test`
  - ejecuta `npm run build`

- backend
  - instala dependencias desde `requirements.txt`
  - ejecuta `python manage.py test`
  - usa SQLite de test, sin servicios externos

Variables configuradas para CI:

```txt
DJANGO_DEBUG=true
DJANGO_SECRET_KEY=django-insecure-ci-test-only
```

### 14. Backend: ponderaciones y plantillas

Se agregó:

```txt
backend/ponderaciones/tests.py
```

Cobertura agregada:

- permisos
  - usuario autenticado puede leer ponderaciones y plantillas
  - usuario normal no puede crear/editar/borrar ni ejecutar acciones write
  - admin sí puede escribir

- ponderaciones legacy
  - filtro por área
  - acción `areas`
  - `bulk_create` requiere lista
  - `bulk_create` crea ponderaciones nuevas
  - `bulk_create` actualiza ponderaciones existentes por área/asignatura
  - `bulk_create` reporta errores por filas inválidas

- plantillas
  - crear plantilla con items
  - recalcular `question_total` al crear
  - editar plantilla y reemplazar items
  - recalcular `question_total` al editar
  - agregar item
  - editar item
  - eliminar item
  - recalcular `question_total` en cada cambio de item
  - no permitir editar item de otra plantilla
  - filtro por área incluye plantillas globales y específicas

- migración
  - `migrate_from_ponderaciones`
  - crea plantillas `UNAP — {area}`
  - ordena items por `order` y `subject`
  - recalcula totales
  - es idempotente

Bug corregido:

- `PonderacionViewSet.bulk_create` pretendía actualizar ponderaciones existentes, pero el `ModelSerializer` podía fallar por unicidad antes de llegar a la rama de actualización.
- Se cambió el flujo para buscar la ponderación existente antes de instanciar el serializer.

### 15. Backend: áreas y configuración DAT global

Se amplió:

```txt
backend/convocatorias/tests.py
```

Cobertura agregada:

- áreas
  - usuario autenticado puede leer áreas
  - usuario normal no puede crear, editar, borrar ni ejecutar acciones write
  - admin puede ejecutar `init_defaults`
  - `init_defaults` es idempotente
  - `init_defaults` no sobrescribe áreas existentes
  - admin puede ejecutar `set_vacantes`
  - `set_vacantes` valida que `vacantes` sea requerido

- configuración DAT global
  - `DatFormatConfigViewSet.list` crea/retorna singleton `pk=1`
  - llamadas repetidas no duplican configuración
  - usuario normal solo puede leer
  - usuario normal no puede modificar
  - admin puede actualizar el singleton aunque no exista previamente
  - actualización conserva un solo registro global

## Estado de verificación

Última verificación ejecutada:

```bash
npm run test
npm run build
python manage.py test
```

Resultado:

- tests frontend: 104 pasando
- build frontend: OK
- tests backend: 48 pasando
- CI configurado

Warnings conocidos del build:

- `exceljs` usa `eval` internamente.
- algunos chunks superan 500 kB.

Estos warnings no bloquean la app, pero quedan como optimización futura.

## Pendientes del core

### 1. Golden tests con fixtures completas

Estado: pendiente, pausado por decisión.

Objetivo:

Crear casos fijos de negocio con input y output esperado.

Ejemplo de estructura:

```txt
frontend/src/domain/calification/__fixtures__/
  simulacro-general.input.json
  simulacro-general.expected.json
  simulacro-por-area.input.json
  simulacro-por-area.expected.json
  real-por-programa.input.json
  real-por-programa.expected.json
```

Casos recomendados:

- simulacro general
  - candidatos sin área
  - clave general
  - puntajes distintos
  - ranking global
  - candidato sin respuesta

- simulacro por área
  - candidatos de dos áreas
  - solo califica un área
  - clave por área
  - fallback de clave general si aplica

- convocatoria real por programa
  - claves `P/Q/R/S/T`
  - varios programas
  - vacantes por programa
  - ranking global
  - ranking por programa
  - ingresantes correctos
  - candidato sin programa
  - respuesta con tipo inválido

Opción recomendada:

- empezar con fixtures sintéticas bien diseñadas
- luego agregar una fixture real anonimizada

### 2. Fixtures `.dat` reales o semirreales

Objetivo:

Probar el flujo desde archivo crudo hasta resultado:

```txt
.dat crudo -> parser -> vinculación -> clave -> calificación -> resultado
```

Faltan fixtures para:

- identificadores válidos
- respuestas válidas
- clave general
- claves reales `P/Q/R/S/T`
- líneas con errores controlados

### 3. Validación formal de entradas antes del cálculo

Pendiente:

- pesos negativos
- `answersLength` inválido
- `correctValue`, `incorrectValue`, `blankValue` fuera de rango esperado
- claves con longitud incorrecta antes del loop
- respuestas más largas/cortas según política
- plantillas sin items
- áreas inexistentes

### 4. Trazabilidad del puntaje

Estado actual:

- se guarda `score`
- se guarda `answersRaw`
- se guarda `correctAnswersRaw`
- se guarda `plantillaSnapshot`
- el motor frontend ahora genera `questionDetails` por candidato
- el motor frontend ahora genera `subjectBreakdown` por candidato
- el validador audita la trazabilidad cuando existe:
  - longitud del detalle por pregunta
  - suma de puntaje por pregunta contra `score`
  - suma de puntaje por materia contra `score`

Incluido en `questionDetails`:

- número de pregunta
- materia
- ponderación
- respuesta marcada
- respuesta correcta
- estado: `correct`, `incorrect`, `blank`
- aporte de puntaje

Incluido en `subjectBreakdown`:

- materia
- total de preguntas
- correctas
- incorrectas
- blancas
- puntaje por materia
- peso total por materia

Pendiente opcional:

- mostrar esta trazabilidad en una pantalla dedicada o persistirla en backend si se requiere auditoría histórica.

### 5. Backend

El backend todavía tiene cobertura baja en:

- `usuarios`
  - revisar si se necesita política extra para que admin staff no pueda cambiar contraseña de superusuario

- `convocatorias`
  - endpoints CRUD individuales de candidatos, identificadores, respuestas y claves si se agregan reglas nuevas

- `ponderaciones`
  - cobertura adicional solo si se agregan nuevas reglas de negocio

- `resultados`
  - cobertura adicional de serialización detallada si se agregan nuevos campos

### 10. CI

Estado actual:

- workflow creado en `.github/workflows/ci.yml`
- frontend ejecuta `npm ci`, `npm run test`, `npm run build`
- backend instala `requirements.txt` y ejecuta `python manage.py test`

## Optimización build

Estado actual:

- Excel/PDF dejaron de cargarse de forma estática en el arranque.
- Se creó `frontend/src/utils/exportLoaders.js`.
- Exportadores de padrón, identificadores, respuestas, claves, resultados, backup, verificador y detalle individual cargan dependencias pesadas con `import()` cuando se usan.
- `npm run build` genera chunks separados:
  - `vendor-excel`
  - `vendor-pdf`
  - `html2canvas`
- El bundle principal queda alrededor de `380 kB` minificado.

Riesgo residual:

- `exceljs` sigue emitiendo warning de `eval` y chunk grande, incluso usando `exceljs/dist/exceljs.bare.min.js`.
- Como Excel ahora es lazy, el warning afecta al chunk de importación/exportación, no al arranque normal de la app.

Opciones profesionales si se quiere eliminar por completo ese riesgo:

- reemplazar ExcelJS por una librería más liviana para lectura/escritura XLSX
- mantener ExcelJS solo para importación y generar exports simples con CSV/XLSX propio
- mover import/export Excel pesado a backend

Objetivo logrado:

Evitar depender de correr tests manualmente antes de cambios o despliegues y reducir el costo inicial de carga del frontend.

## Orden recomendado para continuar

Si se pausa golden tests, el orden sugerido es:

1. Volver a golden tests con fixtures sintéticas.
2. Agregar fixtures reales anonimizadas.
3. Decidir si la trazabilidad se muestra solo en UI o también se persiste en backend.
4. Decidir si ExcelJS se reemplaza o se acepta como chunk lazy.

## Cierre de sesión

Fecha: 2026-07-01

Quedó consolidado:

- trazabilidad avanzada del puntaje en el motor de calificación
- validación de coherencia para detalle por pregunta y por materia
- carga diferida de Excel/PDF para reducir el costo inicial del frontend
- tests frontend y backend ejecutados con éxito

Estado de verificación:

- frontend: `107` tests pasando
- backend: `48` tests pasando
- build frontend pasando

Pendiente para la siguiente sesión:

- probar carga sintética con ~5000 postulantes
- decidir persistencia de la trazabilidad
- decidir si se mantiene ExcelJS o se reemplaza
