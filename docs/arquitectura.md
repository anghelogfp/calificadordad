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
9. Calcula una o varias areas.
10. Guarda resultados en historial.
11. Exporta reportes o usa el verificador manual.

## Fuente De Verdad

La direccion recomendada del sistema es:

- Datos de negocio: backend/API/base de datos.
- Preferencias de interfaz: `localStorage`.
- Estado temporal de trabajo: memoria del navegador mientras la app esta abierta.
- Si la API responde vacia, la app respeta ese estado vacio y no sube datos viejos del navegador automaticamente.

Las tablas grandes, sources y configuraciones de negocio ya no se persisten en `localStorage`. Si la API falla, los cambios solo viven en memoria hasta que se recargue la app.

## Motor De Calificacion

El core de calificacion vive en `frontend/src/domain/calification/`:

- `calculateResults.js`: calcula puntajes, ranking, ingresantes y trazabilidad.
- `preflight.js`: valida condiciones antes de calcular.
- `validateResults.js`: audita invariantes despues de calcular.

Esta separacion es correcta porque permite probar la logica critica sin depender de Vue ni de la UI.

## Modos De Proceso

- Simulacro general: puede usar clave general y ranking global.
- Simulacro por areas: usa areas del padron y claves por area cuando aplica.
- Convocatoria real: exige tipos P/Q/R/S/T, programa de estudios y vacantes por programa.

## Riesgos Arquitectonicos Actuales

- Documentacion historica puede contradecir el codigo vigente.
- `App.vue` aun concentra inicializacion, navegacion y reconciliaciones.
- Backup/restauracion necesita mas pruebas de aislamiento para no afectar datos globales.
