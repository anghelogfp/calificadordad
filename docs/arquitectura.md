# Arquitectura

## Proposito

El sistema califica examenes de admision a partir de:

1. Padron de postulantes.
2. Archivos `.dat` de identificadores.
3. Archivos `.dat` de respuestas.
4. Claves oficiales de respuestas.
5. Plantillas de ponderacion.
6. Configuracion de vacantes y modalidad.

El resultado es un proceso de calificacion con puntajes, posiciones, ingresantes, no calificados, trazabilidad por pregunta y persistencia en historial.

## Flujo Principal

1. El operador inicia sesion.
2. Carga o continua un proceso.
3. Importa padron.
4. Importa identificadores.
5. Importa respuestas.
6. Importa claves.
7. Revisa ponderaciones y configuracion.
8. Ejecuta preflight.
9. Calcula una o varias areas (el resultado debe pasar la auditoria para aceptarse).
10. Revisa el panel de Revision: hojas sin alumno, respuestas incompletas, otras incidencias y alumnos sin hoja.
11. Si corresponde, confirma correcciones de DNI y registra excepciones de pregunta; el ranking se recalcula.
12. Guarda resultados en historial.
13. Exporta reportes o usa el verificador manual.

## Fuente De Verdad

La direccion recomendada del sistema es:

- Datos de negocio: backend/API/base de datos.
- Preferencias de interfaz: `localStorage`.
- Estado temporal de trabajo: memoria del navegador mientras la app esta abierta.
- Si la API responde vacia, la app respeta ese estado vacio y no sube datos viejos del navegador automaticamente.

Las tablas grandes, sources y configuraciones de negocio ya no se persisten en `localStorage`. Si la API falla, los cambios solo viven en memoria hasta que se recargue la app.

## Motor De Calificacion

El core de calificacion vive en `frontend/src/domain/calification/` y es logica pura (sin Vue ni UI), probada de forma directa:

| Modulo | Responsabilidad |
|---|---|
| `scoreAnswerSheet.js` | **Unica** implementacion del puntaje por pregunta (aciertos, errores, blancos, multiples y excepciones). La usan el motor, el detalle del alumno, las exportaciones y el verificador. |
| `calculateResults.js` | Calcula puntajes, ranking, ingresantes y trazabilidad de un area; aplica correcciones de DNI y excepciones; agrega el resumen y las huellas. |
| `preflight.js` | Valida condiciones antes de calcular (bloqueos y advertencias). |
| `validateResults.js` | Audita el resultado despues de calcular, incluido un recalculo independiente del puntaje. |
| `questionExceptions.js` | Valida y clasifica excepciones de pregunta, ligadas a la clave por hash. |
| `dniCorrections.js` | Aplica las correcciones de DNI confirmadas a las hojas. |
| `provisionalMatches.js` | Sugiere alumnos para hojas sin alumno y calcula su puntaje provisional (vista previa, no cambia nada). |
| `fingerprint.js` | Huellas SHA-256 de la configuracion y de los datos de un calculo. |

`domain/reconciliation/buildReconciliation.js` concilia padron, identificadores y respuestas.

Esta separacion permite probar la logica critica sin depender de Vue ni de la UI. La regla de la arquitectura es que **ningun componente calcula puntajes**: todos llaman a las funciones del dominio.

### Capas de proteccion del resultado

1. **Carga:** el parser decide la posicion de las respuestas por la columna tipo; se audita cada archivo (disposiciones mezcladas, caracteres ajenos, hojas cortas o largas) y se compara lo guardado con lo cargado.
2. **Preflight:** bloquea el calculo ante claves duplicadas, excepciones invalidas, area desconocida, etc.
3. **Calculo:** funcion unica de puntaje; las correcciones y excepciones se ligan a sus datos (DNI original de la hoja, hash de la clave) para no aplicarse a otro examen.
4. **Auditoria:** recalcula el puntaje y el estado de cada pregunta leyendo respuestas y clave de forma independiente, y comprueba que cada hoja aplico exactamente las excepciones registradas.
5. **Trazabilidad:** SHA-256 de cada archivo (sobre bytes) y huellas de configuracion y datos guardadas con el resultado.

Ver `docs/reglas-de-calificacion.md` para el detalle de cada regla.

## Decisiones Que Se Registran Aparte Del Calculo

Algunas decisiones humanas cambian el resultado y se guardan como datos auditables del usuario (API/BD), no como cambios a los archivos originales:

- **Correcciones de DNI** (`DniCorrection`): una hoja sin alumno se atribuye a un alumno del padron. El servidor deriva el DNI original de la hoja.
- **Excepciones de pregunta** (`QuestionException`): anulacion o varias respuestas validas sobre una clave. El servidor deriva la huella de la clave.

Ambas: pertenecen al usuario, se deshacen por revocacion (no se borran), entran a la huella de configuracion, se guardan en el historial y el backup, y fuerzan un recalculo del ranking al registrarse o deshacerse.

## Modos De Proceso

- Simulacro general: puede usar clave general y ranking global.
- Simulacro por areas: usa areas del padron y claves por area cuando aplica.
- Convocatoria real: exige tipos P/Q/R/S/T, programa de estudios y vacantes por programa.

## Integracion Con Otras Ramas

El repositorio tiene ramas con trabajo para otros procesos (concurso del Poder Judicial). No se fusionan enteras: se portan piezas genericas. Ver `docs/integracion-ramas.md`.

## Riesgos Arquitectonicos Actuales

- Documentacion historica puede contradecir el codigo vigente.
- `App.vue` aun concentra inicializacion, navegacion y reconciliaciones.
- Backup/restauracion necesita mas pruebas de aislamiento para no afectar datos globales.
