# Roadmap

## Prioridad 1 - Documentacion

- Consolidar documentacion vigente.
- Mover documentos historicos a `docs/historico/`.
- Mantener `README.md` como entrada corta.

## Prioridad 2 - Fuente De Verdad

- Definir formalmente DB/API como fuente principal de negocio.
- Reducir `localStorage` a UI, tokens y cache explicito.
- Documentar reglas de sincronizacion mientras exista fallback local.
- Completado inicial: se elimino la migracion automatica desde cache local hacia API cuando la API responde vacia.
- Completado fase 2: se quito la persistencia local de tablas grandes, sources, vacantes, formato DAT y configuracion de calificacion.
- Completado backup frontend: export/import ya no usa `localStorage` como respaldo de datos de negocio; backups legacy locales quedan bloqueados.

## Prioridad 3 - Backup

Estado: pendiente controlado.

Ya completado:

- Frontend exporta datos desde API/servidor.
- Frontend ya no genera backups de negocio desde `localStorage`.
- Backups legacy basados solo en `localStorage` quedan bloqueados.

Pendiente:

- Definir si el backup sera personal, institucional o ambos.
- Mover exportacion/importacion a backend de forma completa.
- Agregar validacion previa del payload.
- Ampliar los tests de restauracion y aislamiento; ya existe cobertura basica de transaccion y reemplazo.
- Evitar reemplazar datos globales compartidos salvo en modo institucional explicito.

Riesgo conocido:

- El restore backend actual puede reemplazar plantillas y formato DAT globales. No usar en datos reales sin copia previa de BD.

## Prioridad 4 - Pruebas De Flujo

- Golden tests con fixtures sinteticas.
- Fixtures reales anonimizadas.
- E2E del flujo: padron, identificadores, respuestas, claves, calificacion, historial y export.

## Prioridad 4.1 - Reportes Institucionales

Alcance acordado el 2026-07-15:

- Adecuar el sistema al Excel oficial de inscritos de 23 columnas.
- Generar verificación de hojas de identificación.
- Generar relaciones de postulantes por área y programa.
- Adecuar rankings, clasificados e ingresantes al formato institucional.
- Excluir fotografías, huellas y firmas digitalizadas.
- Mantener espacios institucionales para firmas manuales.

Completado:

- Modelo, API, backup e importador conservan los 23 campos oficiales.
- El encabezado `N° DOCUMENTO` se reconoce como DNI.
- Migración `convocatorias.0011_candidato_padron_oficial_fields` creada y aplicada localmente.
- Conciliación extraída a funciones de dominio testeables.
- La conciliación produce estados, códigos semánticos, archivo fuente y detalle por fila.

Pendiente:

- Definir equivalencia oficial de los códigos `[03]`, `[05]` y `[07]`.
- Implementar el PDF de verificación de hojas de identificación.
- Implementar relaciones generales, por área y por programa.
- Definir puntaje vocacional, empates, corte de vacantes y clasificados.
- Adecuar rankings e ingresantes.
- Centralizar reportes oficiales en backend.

## Prioridad 5 - Limpieza Frontend

- Extraer reconciliaciones desde `App.vue`.
- Reducir responsabilidad del orquestador principal.
- Mantener el motor de calificacion como dominio puro.
- Ya se mejoraron resultados y modal de calificacion para reducir ruido visual y reforzar estados operativos.
- Ya se alineo el camino del proceso desde la creacion hasta claves, ponderaciones, calificacion, resultados, historial y dashboard.
- Ya se implemento el stepper con estados, descripciones y acciones para los pasos 1 al 5.
- Ya se agregaron paneles de verificacion para padron, identificadores, respuestas, claves y resultados.
- Ya se mejoro el verificador manual como herramienta auxiliar independiente: pegado masivo, clave frecuente, validacion, resumen por curso, tabla en dos columnas, busqueda, duplicado y export CSV.
- Ya se agrego una cartilla visual en modal para Respuestas y Claves, separada del verificador manual y del core de calificacion.
- Pendiente inmediato: seguir afinando el modal si la densidad visual sigue alta en uso real.

## Prioridad 6 - Modelo De Convocatoria

Decision actual:

- Mantener areas/formato/plantillas globales y tratar proceso como unidad principal.
- Se eliminaron `useConvocatoria.js` y `ConvocatoriaPanel.vue` porque apuntaban a endpoints/modelos inexistentes.

Pendiente futuro:

- Reintroducir convocatoria solo si el negocio necesita aislar areas, formato DAT, plantillas, vacantes y procesos por convocatoria formal.

## Prioridad 7 - Confiabilidad Del Core (octubre 2026)

Origen: la calificacion de un simulacro real (179 hojas) destapo fallos silenciosos en el camino cargar - calificar - validar. Se corrigieron y se agregaron controles para que no vuelvan a ocurrir.

Completado (2026-10-22):

- Alineacion de respuestas: el parser decide la posicion por la columna tipo; el backend ya no recorta espacios (`docs/changelog/2026-10-22-fix-alineacion-respuestas.md`).
- Padron: fecha de nacimiento `DD/MM/YYYY` y libros Excel con tablas filtradas (`exceljs` 4.4).
- Auditoria al cargar y verificacion despues de guardar.
- Auditoria del core: avisos de hojas incompletas y recalculo independiente del puntaje (`docs/changelog/2026-10-22-auditoria-core-calificacion.md`).
- Pantalla de resultados: panel unico de Revision con pestanas, busqueda y paginacion (`docs/changelog/2026-10-22-rediseno-revision-resultados.md`).
- Hojas sin alumno: vista previa con DNI sugerido y confirmacion auditada que entra al ranking (`docs/changelog/2026-10-22-vista-previa-dni-sugerido.md`).
- Trazabilidad SHA-256 de archivos y de cada calculo (`docs/changelog/2026-10-22-trazabilidad-sha256.md`).
- Excepciones de pregunta y una unica funcion de puntaje (`docs/changelog/2026-10-22-excepciones-de-preguntas.md`).
- Documentacion de reglas (`docs/reglas-de-calificacion.md`) y analisis de ramas (`docs/integracion-ramas.md`).

Pendiente, por orden recomendado:

1. **Empates y corte de vacantes.** Definir con Admision la regla (puesto compartido, menos errores, alfabetico) y marcar el empate en la ultima vacante. Hoy las posiciones son siempre distintas.
2. **Modo convocatoria real con datos reales** (claves P/Q/R/S/T, cupos, ingresantes): revisarlo con la misma profundidad que el simulacro.
3. Mostrar la marca de DNI corregido y las excepciones en el Excel de convocatoria real y en el detalle del alumno de ese modo; listar excepciones en los PDF.
4. Bitacora de eventos y pruebas sinteticas previas al calculo (piezas de `feat/calificacion-pj`).
5. Ejecutable portable para Windows, si la oficina lo necesita (cambiando la contrasena por defecto del lanzador).
6. Pantalla de resultados: agrupar las acciones de la cabecera y revisar las tablas en pantallas pequenas.
7. Persistir en el historial la pestana de "Respuestas incompletas" y sus conteos.
8. Fusionar o descartar `feat/calificacion-pj` y limpiar ramas y worktrees ya fusionados (ver `docs/integracion-ramas.md`).
9. Configurar BMAD para el flujo de trabajo con agentes (idioma, contexto del dominio, visibilidad de las skills).
10. Importador de padron: validar otros formatos que pueda exportar SIAGIE.

## Punto De Pausa Actual

Trabajo actual:

- Camino del proceso definido al inicio: `Simulacro general`, `Simulacro por areas` o `Convocatoria real`.
- Claves, ponderaciones, modal de calificacion, resultados, historial y dashboard ya respetan ese camino.
- Stepper de pasos 1 al 5 ya muestra estados `Listo`, `Revisar` y `Pendiente`, con accion contextual.
- Paneles de verificacion ya resumen estado, observaciones y faltantes en padron, identificadores, respuestas, claves y resultados.
- Identificadores y respuestas ya separan en su panel los cierres del DAT, los cruces contra padron, duplicados y calidad de archivo.
- Verificador manual ya cuenta con mejoras visuales y operativas sin afectar el core del flujo principal.
- Tests unitarios agregados para stepper, paneles compartidos, insignia de camino, claves, respuestas, parsers y calculo.
- Padrón oficial de 5,555 inscritos analizado: estructura consistente, 5,555 DNI únicos, 44 programas y tres áreas.
- Importador adecuado para conservar las 23 columnas oficiales sin ampliar la tabla operativa visible.
- Conciliación de padrón, identificadores y respuestas fortalecida y lista para alimentar el reporte.

Nota (2026-10-22): el punto de pausa de abajo es de julio de 2026. El trabajo vigente esta en la Prioridad 7.

Siguiente paso recomendado (julio de 2026):

1. Implementar el reporte PDF de verificación usando `verificationRows` de la conciliación.
2. Confirmar con Admisión el significado de `[03]`, `[05]` y `[07]` antes de presentarlos como códigos oficiales.
3. Probar el reporte con fixtures anonimizadas y después con los 5,555 inscritos.
4. Continuar con relaciones de postulantes, rankings e ingresantes.
