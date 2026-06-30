# Testing - Calificador DAD

## Estado: ✅ Implementado

## Setup

### Framework
- **Vitest** v3.1.4 con jsdom
- Alias `@` → `frontend/src/`

### Archivos de configuración
- `frontend/package.json` — scripts y deps
- `frontend/vitest.config.js` — configuración del runner

### Comandos
```bash
npm test        # ejecución única
npm run test:watch  # modo watch
```

---

## Tests Implementados (58 passing)

### 1. `frontend/src/utils/__tests__/helpers.test.js` — 20 tests

| Función | Casos cubiertos |
|---------|-----------------|
| `removeDiacritics` | elimina tildes, maneja nulos |
| `stripDigits` | extrae dígitos, vacío, solo números |
| `removeWhitespace` | elimina espacios |
| `normalize` | minúsculas + sin tildes |
| `normalizeArea` | coincidencia exacta, normaliza tildes, fallback a primera área |
| `buildResponseMatchKey` | clave litho\|indicator\|folio, extrae dígitos del litho |
| `buildAreaTipoKey` | normaliza área y tipo, vacío |
| `buildPonderationKey` | clave única |
| `classifyAnswerChar` | A-E → option, resto → blank |

### 2. `frontend/src/composables/__tests__/calificationHelpers.test.js` — 19 tests

| Función | Casos cubiertos |
|---------|-----------------|
| `buildDniCounts` | cuenta duplicados, ignora vacíos, array vacío, extrae dígitos |
| `getCandidateDniIssue` | válido, vacío, incompleto, duplicado |
| `getExactAnswerKey` | búsqueda exacta, normaliza, sin tipo, sin match |
| `REAL_TEST_TYPES` | constante ['P','Q','R','S','T'] |
| `GENERAL_SIMULACRO_AREA` | constante 'General' |

### 3. `frontend/src/utils/__tests__/parsers.test.js` — 19 tests

| Función | Casos cubiertos |
|---------|-----------------|
| `createIdentifierRow` | valores por defecto, datos iniciales, id único |
| `buildIdentifierObservation` | sin obs, litho incompleto/vacío, tipo sin marcar, DNI incompleto, aula incompleto, múltiples obs |
| `createResponseRow` | valores por defecto, datos iniciales |
| `buildResponseObservation` | válido, caracteres inválidos, cadena corta, vacío |
| `detectResponseAnswersOffset` | mínimo 3 líneas, líneas cortas, vacío |

---

## ArchivosNuevos

```
frontend/
├── vitest.config.js
├── src/utils/
│   ├── __tests__/
│   │   ├── helpers.test.js       # 20 tests
│   │   └── parsers.test.js       # 19 tests
│   └── calificationHelpers.js    # extractado del composable
└── src/composables/
    └── __tests__/
        └── calificationHelpers.test.js  # 19 tests
```

---

## Pendiente

### Alta prioridad

1. **Tests de integración `useCalification`**
   - El composable completo depende de localStorage, Vue refs, API calls
   - Requiere mock de `useStorage` + `apiFetch`
   - Casos críticos:
     - `preflightCheck` computed con DNIs duplicados
     - `preflightCheck` computed en modo simulacro general vs real
     - `processType` y `simulacroScope` computeds
     - `isGeneralSimulacro` computed

2. **Tests del backend Django**
   - Actualizar `resultados/tests.py` para nuevos campos (`type`, `simulacroScope`, métricas preflight)
   - Tests de `process_type` en procesos (simulacro vs real)
   - Tests de upsert con `simulacro_scope`

### Media prioridad

3. **Tests de parsers completos**
   - `parseIdentifierLine` — parser completo de línea .dat
   - `parseResponseLine` — parser completo de línea .dat
   - Ambos requieren construir líneas válidas de 60+ caracteres con formato correcto

4. **Tests de `useExport.js`**
   - Generación de PDFs
   - Exportación de ingresantes

### Baja prioridad

5. **Tests E2E (Playwright)**
   - Flujo completo: subir padrón → subir respuestas → subir claves → calificar → exportar
   - Solo si se requiere cobertura de regresión visual

6. **Tests de `useArchives.js`, `useResponses.js`, `useIdentifiers.js`**
   - Funciones de parsing de archivos Excel/.dat

---

## Notas

- `calificationHelpers.js` fue creado como módulo independiente para permitir testing sin mock de Vue reactivity
- Los tests actuales son **unitarios** (funciones puras), no requieren Vue Test Utils
- Coverage actual aproximado: ~30% del frontend, foco en lógica de calificación