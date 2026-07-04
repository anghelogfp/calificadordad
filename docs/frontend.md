# Frontend

## Stack

- Vue 3.
- Vite.
- Composition API.
- Vitest para pruebas.

## Estructura Principal

- `src/App.vue`: orquestador de autenticacion, inicializacion, layout y navegacion.
- `src/components`: vistas, tabs, modales, layout y componentes compartidos.
- `src/composables`: estado y operaciones por dominio.
- `src/domain/calification`: logica pura de calificacion.
- `src/utils`: parsers, helpers, API fetch y carga diferida de exportadores.
- `src/constants`: tabs, storage keys, columnas, areas fallback y formato DAT por defecto.

## Flujo De Inicializacion

Tras login, la app carga datos desde la API en orden:

1. Areas.
2. Formato DAT.
3. Padron.
4. Identificadores.
5. Respuestas.
6. Claves.
7. Vacantes por programa.
8. Configuracion de calificacion.
9. Ponderaciones.

## Estado Local

Se usa `localStorage` para:

- Tab activo.
- Subtabs.
- Sidebar.
- Tokens JWT.
- Metadata del proceso activo, incluyendo tipo y alcance del camino.

La regla vigente es que la API/DB manda. Las filas de padron, identificadores, respuestas, claves, sources, vacantes, formato DAT y configuracion de calificacion ya no se guardan en `localStorage`.

La meta es reducir `localStorage` de negocio hasta dejar solo preferencias, tokens y metadata liviana.

Los backups antiguos que solo contienen `localStorage` ya no se restauran automaticamente. La restauracion valida debe venir con seccion `server`.

## Motor De Calificacion

El frontend conserva la logica de calculo en modulos puros. Esto permite:

- Tests unitarios directos.
- Auditoria de invariantes.
- Trazabilidad por pregunta.
- Reuso desde UI y verificador.

## Estado De UI Y UX

La pantalla de resultados, el modal de calificacion y el flujo de pasos se reordenaron para priorizar contexto, estado y accion:

- Resultados muestra primero el estado operativo, no calificados e incidencias, y deja los detalles tecnicos al final.
- El modal de calificacion agrupa configuracion, salida y validacion en una sola experiencia con separadores suaves.
- Los bloqueos de preflight ya no quedan silenciosos: el flujo muestra error visible y toast cuando falta informacion para calificar.
- El stepper de los pasos 1 al 5 muestra estado, descripcion y accion contextual por etapa.
- Los pasos de padron, identificadores, respuestas, claves y resultados usan paneles de verificacion para resumir carga, cruces, observaciones y faltantes.
- El camino del proceso se muestra con una insignia compartida para mantener consistencia visual entre las etapas.

## Verificacion Por Pasos

El estado del stepper se calcula desde datos reales del proceso:

- Padron: `completed` cuando hay postulantes cargados.
- Identificadores: `pending` sin datos, `warning` si hay observaciones de conciliacion, `completed` si los cruces estan limpios.
- Respuestas: `pending` sin datos, `warning` si hay respuestas sin vincular u observaciones, `completed` si estan listas.
- Claves: `pending` sin claves, `warning` si faltan pares area/tipo, hay claves incompletas o duplicadas, `completed` si cubren el camino.
- Resultados: `completed` cuando existen resultados; antes de calcular muestra faltantes u observaciones segun el preflight.

Las respuestas con cadena mas corta que el formato esperado ya no se tratan como error generico de cadena incompleta. Se registran como `Blancos finales asumidos` y el detalle por pregunta marca esos blancos finales con `blankSource: assumed-final`.

## Camino Del Proceso

El camino se define al crear el proceso y queda bloqueado para el resto del flujo:

- `Simulacro general`: usa clave general y la clave general cubre el simulacro.
- `Simulacro por areas`: exige claves por area; una clave general no cubre este camino.
- `Convocatoria real`: usa claves por area y tipo, con ponderaciones y resultados de convocatoria.

La UI muestra este camino de forma consistente en claves, ponderaciones, modal de calificacion, resultados, historial y dashboard.

## Pendientes Tecnicos

- Extraer reconciliaciones de `App.vue` a composables dedicados.
- Agregar tests E2E del flujo completo.
- Validar rendimiento con 5000 postulantes.
- Decidir si la trazabilidad se persiste tambien en backend.
- Seguir puliendo jerarquia visual del modal de calificacion si el negocio pide menos densidad.
