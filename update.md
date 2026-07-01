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

## Estado de verificación

Última verificación ejecutada:

```bash
npm run test
npm run build
```

Resultado:

- tests frontend: 87 pasando
- build frontend: OK

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

### 3. Conectar `validateCalificationResult` en runtime

Estado:

- existe y está testeado
- todavía no se usa en producción

Opciones:

- usarlo solo en desarrollo con `console.warn`
- mostrar alerta técnica al usuario
- bloquear guardado si hay error grave
- registrar auditoría para soporte

Recomendación:

No conectarlo como bloqueo fuerte sin definir UX. Primero decidir qué errores deben bloquear y cuáles solo advertir.

### 4. Endurecer `preflightCheck.hasBlockers`

Estado:

- existe como función pura
- la UI lo consume

Pendiente:

- revisar si `runCalification` debe bloquear explícitamente cuando `preflightCheck.hasBlockers === true`
- definir qué blockers son absolutos y qué casos pueden seguir como no calificados

### 5. Validación formal de entradas antes del cálculo

Pendiente:

- pesos negativos
- `answersLength` inválido
- `correctValue`, `incorrectValue`, `blankValue` fuera de rango esperado
- claves con longitud incorrecta antes del loop
- respuestas más largas/cortas según política
- plantillas sin items
- áreas inexistentes

### 6. Trazabilidad del puntaje

Estado actual:

- se guarda `score`
- se guarda `answersRaw`
- se guarda `correctAnswersRaw`
- se guarda `plantillaSnapshot`

Pendiente opcional:

- detalle por pregunta
- detalle por materia
- cantidad de correctas, incorrectas y blancas
- puntaje por materia
- explicación del cálculo por candidato

Esto ayudaría cuando alguien pregunte por qué un postulante obtuvo cierto puntaje.

### 7. Tests de importación de claves

Pendiente cubrir:

- `createAnswerKeyRow`
- `buildAnswerKeyObservation`
- `readAnswerKeyFiles`
- `readGeneralAnswerKeyFile`
- match exacto por `litho|indicator|folio`
- fallback por `litho`
- caso sin match
- clave general sin identificador

### 8. Tests de vinculación identificador-respuesta

Pendiente cubrir:

- `applyIdentifierDataToResponseRow`
- match por `litho|indicator|folio`
- fallback por `litho`
- caso sin match
- normalización de DNI/tipo
- actualización de observaciones

### 9. Backend

El backend todavía tiene cobertura baja en:

- `usuarios`
  - login correcto/incorrecto
  - usuario inactivo
  - refresh token
  - `me`
  - `logout`
  - CRUD admin
  - permisos de usuario normal

- `convocatorias`
  - `CandidatoViewSet.bulk_replace`
  - `IdentifierRow`
  - `ResponseRow`
  - `AnswerKeyRow`
  - relación con sources
  - aislamiento por usuario
  - `DatFormatConfig` singleton
  - `ProgramaVacante.bulk_replace`
  - `CalificationConfig.bulk_replace`

- `ponderaciones`
  - CRUD
  - filtro por área
  - `bulk_create`
  - plantillas
  - items
  - recalcular `question_total`
  - `migrate_from_ponderaciones`
  - permisos admin/usuario normal

- `resultados`
  - `/api/procesos/{id}/full/`
  - validaciones de `local_id`, `name`, `areas`
  - actualización de proceso existente
  - borrado
  - aislamiento por usuario
  - `VerificadorSesionViewSet`

### 10. CI

Pendiente:

Configurar ejecución automática de:

```bash
npm run test
npm run build
python backend/manage.py test
```

Objetivo:

Evitar depender de correr tests manualmente antes de cambios o despliegues.

## Orden recomendado para continuar

Si se pausa golden tests, el orden sugerido es:

1. Tests de importación de claves.
2. Tests de vinculación identificador-respuesta.
3. Decidir cómo conectar `validateCalificationResult` en runtime.
4. Revisar si `preflightCheck.hasBlockers` debe bloquear `runCalification`.
5. Agregar tests backend de permisos, aislamiento y bulk replace.
6. Configurar CI.
7. Volver a golden tests con fixtures sintéticas.
8. Agregar fixtures reales anonimizadas.
