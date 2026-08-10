# Padrón oficial y conciliación — 2026-07-15

## Objetivo

Preparar el sistema para usar el Excel oficial de inscritos y generar los reportes institucionales observados en los PDF de referencia.

El alcance acordado excluye fotografías, huellas y firmas digitalizadas. Los reportes podrán conservar espacios para firmas manuales.

## Archivos de referencia analizados

Directorio externo de trabajo: `C:\Users\DAD-987\Desktop\data_calificacion_real`.

- `15-07-2026_10-29-52_lista_postulantes.xlsx`
- `reporte_verificacion.pdf`
- `huellas.pdf`

No se copiaron al repositorio ni se importaron datos personales a la base durante esta sesión.

## Hallazgos del Excel oficial

- Una hoja: `LISTA DE POSTULANTES`.
- 5,555 registros y 23 columnas.
- 5,555 DNI únicos, válidos y sin duplicados.
- 44 programas de estudios.
- Áreas: Sociales 2,550; Ingenierías 1,619; Biomédicas 1,386.
- Modalidad única: CEPREUNA.
- Relaciones código/programa, código/modalidad y programa/área consistentes.
- Un único dato vacío en `EGRESO`, no bloqueante para calificación.
- El sistema no reconocía `N° DOCUMENTO` como DNI antes de esta iteración.

## Cambios implementados

### Padrón oficial

`Candidato` conserva ahora:

- Fecha de inscripción.
- Código y nombre de programa.
- Área.
- Código y nombre de modalidad.
- DNI, apellidos y nombres.
- Sexo, fecha de nacimiento y edad.
- Ubigeo, departamento, provincia y distrito de residencia.
- Año de egreso.
- Código modular del colegio.
- Ubigeo, departamento, provincia y distrito del colegio.
- Observaciones internas.

Se actualizaron modelo, serializer, backup e importador. Las siete columnas operativas continúan siendo las únicas visibles en la tabla principal.

La migración agregada es:

`backend/convocatorias/migrations/0011_candidato_padron_oficial_fields.py`

### Importador

- Se agregó `ARCHIVE_SCHEMA_FIELDS` para separar persistencia completa de presentación operativa.
- Se agregaron alias para las 23 columnas oficiales.
- `N° DOCUMENTO`, `Nº DOCUMENTO` y variantes se reconocen como DNI.
- Fecha de inscripción se normaliza a formato ISO.
- Fechas y edad opcionales se envían como `null`, manteniendo compatibilidad con padrones antiguos.

### Conciliación

La lógica que estaba dentro de `App.vue` se extrajo a:

`frontend/src/domain/reconciliation/buildReconciliation.js`

La conciliación de identificadores detecta:

- Postulantes sin identificador.
- Identificadores fuera del padrón.
- DNI no leído o inválido.
- DNI duplicado en padrón o identificadores.
- Claves físicas litho/indicador/folio duplicadas.
- Archivo DAT de procedencia.

La conciliación de respuestas detecta:

- Postulantes sin respuesta.
- Respuestas fuera del padrón.
- Respuestas sin DNI vinculado.
- Respuestas duplicadas.
- Identificadores sin respuesta.
- Archivo DAT de procedencia.

Cada fila detallada incluye estado y códigos semánticos internos. Estos códigos todavía no deben mostrarse como equivalentes oficiales de `[03]`, `[05]` y `[07]` hasta confirmar su significado con Admisión.

## Verificación realizada

- Frontend: 177/177 pruebas aprobadas en 22 archivos.
- Backend: 49/49 pruebas aprobadas.
- Build de producción exitoso.
- Django check sin incidencias.
- Sin migraciones de código pendientes.
- Migración 0011 aplicada localmente.

## Estado del plan

Completado:

1. Ampliación del modelo para el padrón oficial.
2. Adecuación del importador.
3. Conciliación robusta entre padrón, identificadores y respuestas.

Siguiente tarea:

1. Construir el reporte PDF de verificación a partir de `identifierReconciliation.verificationRows`.
2. Usar nombres semánticos para incidencias mientras no exista equivalencia oficial de códigos.
3. Añadir pruebas del contenido, paginación, totales y registros observados.
4. Continuar después con relaciones de postulantes, rankings, clasificados e ingresantes.

## Cambios pendientes de versionar

Los cambios de código, migración, pruebas y esta documentación quedaron en el árbol de trabajo. No se creó commit durante la sesión.
