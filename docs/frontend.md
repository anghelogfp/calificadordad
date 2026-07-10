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
- En identificadores y respuestas, los paneles separan el cierre del DAT, el cierre contra el padron, los duplicados y la calidad del archivo para que los conteos sean auditables.
- Las tablas de Respuestas y Claves exponen un boton de vista que abre una cartilla visual en modal para revisar la cadena cargada sin alterar el dato original.
- El camino del proceso se muestra con una insignia compartida para mantener consistencia visual entre las etapas.

## Verificacion Por Pasos

El estado del stepper se calcula desde datos reales del proceso:

- Padron: `completed` cuando hay postulantes cargados.
- Identificadores: `pending` sin datos, `warning` si hay observaciones de conciliacion, `completed` si los cruces estan limpios.
- Respuestas: `pending` sin datos, `warning` si hay respuestas sin vincular u observaciones, `completed` si estan listas.
- Claves: `pending` sin claves, `warning` si faltan pares area/tipo, hay claves incompletas o duplicadas, `completed` si cubren el camino.
- Resultados: `completed` cuando existen resultados; antes de calcular muestra faltantes u observaciones segun el preflight.

Las respuestas con cadena mas corta que el formato esperado ya no se tratan como error generico de cadena incompleta. Se registran como `Blancos finales asumidos` y el detalle por pregunta marca esos blancos finales con `blankSource: assumed-final`.

En los pasos de identificadores y respuestas, el panel de verificacion muestra cierres independientes: registros del DAT vinculados, fuera del padron o sin dato de enlace; y postulantes del padron con o sin registro correspondiente. Tambien agrupa duplicados y observaciones de calidad del DAT.

## Importacion De Padron

El Paso 1 importa la primera hoja del `.xlsx`, toma la primera fila como encabezados y mapea cada fila con `mapArchiveRowToSchema`.

Los alias de encabezados viven en `src/constants/index.js` como `ARCHIVE_KEY_ALIASES`. Actualmente se aceptan variantes con espacios y guiones bajos para apellidos, por ejemplo `apellido paterno`, `apellido_paterno`, `apellidos_paterno`, `ape_pat` y `ap_paterno`; lo mismo aplica para materno.

El importador ignora columnas externas no mapeadas, por ejemplo `nro` o `sede`. Si `sede` pasa a ser requerida para reportes o segmentacion, debe agregarse como campo real del padron y no solo como alias.

## Camino Del Proceso

El camino se define al crear el proceso y queda bloqueado para el resto del flujo:

- `Simulacro general`: usa clave general y la clave general cubre el simulacro.
- `Simulacro por areas`: exige claves por area; una clave general no cubre este camino.
- `Convocatoria real`: usa claves por area y tipo, con ponderaciones y resultados de convocatoria.

Reglas de seguridad del cálculo:

- El simulacro general exige exactamente una clave sin área asignada; no reutiliza una clave de área como reemplazo.
- El preflight bloquea claves duplicadas para la misma área y tipo, evitando que el resultado dependa del orden de carga.
- En convocatoria real, las respuestas con tipo diferente de `P/Q/R/S/T` se muestran antes del cálculo y quedan no calificadas hasta corregirse.
- Una vacante con valor `0` significa que el programa no tiene vacantes y no marcará ingresantes.

La UI muestra este camino de forma consistente en claves, ponderaciones, modal de calificacion, resultados, historial y dashboard.

## Verificador Manual

El verificador manual es una herramienta auxiliar independiente del flujo principal de calificacion. No modifica padron, respuestas, claves ni resultados del proceso operativo.

Estado actual:

- Permite ingresar clave oficial y respuestas del postulante en grillas separadas.
- La clave oficial se representa en azul, respuestas correctas del postulante en verde, incorrectas en rojo y blancos en gris.
- La tabla de detalle se muestra en dos columnas y conserva `N°`, curso, marcada, correcta, ponderacion, puntos y acumulado.
- El calculo del verificador usa tres decimales para puntos y acumulado.
- Permite pegar cadenas completas de respuestas desde cualquier celda.
- Permite guardar y reutilizar una clave frecuente por plantilla desde `localStorage`.
- Valida faltantes de clave oficial antes de guardar o exportar PDF.
- Muestra resumen por curso.
- El historial del verificador permite buscar, duplicar sesiones y exportar CSV.
- La vista del verificador manual usa la misma cartilla visual en modo comparacion, pero sigue fuera del core operativo de calificacion.

## Pendientes Tecnicos

- Extraer reconciliaciones de `App.vue` a composables dedicados.
- Agregar tests E2E del flujo completo.
- Validar rendimiento con 5000 postulantes.
- Decidir si la trazabilidad se persiste tambien en backend.
- Seguir puliendo jerarquia visual del modal de calificacion si el negocio pide menos densidad.
