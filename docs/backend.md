# Backend

## Stack

- Django.
- Django REST Framework.
- Simple JWT.
- SQLite en desarrollo.

## Apps

- `usuarios`: login, refresh, sesion actual y administracion de usuarios.
- `convocatorias`: nombre historico de la app Django; actualmente contiene areas, formato DAT, padron, identificadores, respuestas, claves, vacantes y configuracion de calificacion. No existe un modelo vigente `Convocatoria`.
- `ponderaciones`: ponderaciones legacy y plantillas de ponderacion.
- `resultados`: procesos de calificacion, resultados y verificador manual.
- `config`: settings, rutas API, CORS y backup.

## Modelo Vigente

La implementacion actual usa varias entidades globales y varias entidades aisladas por usuario:

- Globales: `Area`, `DatFormatConfig`, `PlantillaPonderacion`.
- Por usuario: `Candidato`, `IdentifierSource`, `IdentifierRow`, `ResponseSource`, `ResponseRow`, `AnswerKeySource`, `AnswerKeyRow`, `ProgramaVacante`, `CalificationConfig`, `DniCorrection`, `QuestionException`, `ProcesoCalificacion`, `VerificadorSesion`.

Decision vigente: el proceso de calificacion es la unidad operativa principal. No existe entidad fuerte de convocatoria. Si el negocio necesita convocatorias completamente independientes, debe reintroducirse como rediseño explicito.

## Correcciones De DNI

`DniCorrection` (`/api/correcciones-dni/`, por usuario) registra que una hoja sin alumno en el padron fue atribuida a un DNI sugerido y confirmada. No modifica la hoja ni el padron: el frontend aplica la correccion al calcular, de modo que la hoja entra al ranking oficial marcada como "DNI corregido".

- El DNI original lo deriva el servidor de la hoja; el cliente solo envia `litho` y `correctedDni`.
- Valida contra los datos del propio usuario: la hoja existe y no tiene alumno en el padron, el DNI corregido esta en el padron y no tiene hoja propia, y no esta asignado a otra hoja.
- Deshacer revoca (`revoked_at`) en lugar de borrar, para conservar la auditoria. Hay restricciones unicas solo entre correcciones activas.
- Backup: el export incluye `dniCorrections` (solo las activas). La restauracion las reemplaza junto con el resto de los datos; un backup anterior sin esa clave deja al usuario sin correcciones. Se rechazan formatos invalidos y repetidos sin tocar nada.

## Excepciones De Preguntas

`QuestionException` (`/api/excepciones-pregunta/`, por usuario) registra una decision de la comision sobre una pregunta de una clave: anulada dando el punto a todos (`ANULADA_OTORGAR`), anulada sin contar (`ANULADA_EXCLUIR`) o varias respuestas validas (`CLAVE_MULTIPLE`).

- Se liga a una clave por area y tipo; el servidor deriva `key_sha256` (SHA-256 de la clave en mayusculas) de la clave cargada. Si la clave cambia, la excepcion deja de aplicarse en el calculo.
- Valida: la clave existe y es unica, la pregunta esta dentro de la clave, el motivo es obligatorio, las letras validas son A-E, y no hay otra excepcion activa para la misma pregunta de la misma clave.
- Deshacer revoca (`revoked_at`) en lugar de borrar.
- El resultado guarda el resumen de excepciones del calculo (`AreaCalificacion.question_exceptions`) y las aplicadas a cada hoja (`ResultadoCandidato.exceptions_applied`), tambien en el backup.
- Backup: el export incluye `questionExceptions` (solo activas); la restauracion las reemplaza y rechaza formatos invalidos o repetidos sin tocar nada.

## Seguridad Y Permisos

- Permiso global DRF: usuario autenticado por defecto.
- Endpoints de login/refresh permiten acceso anonimo.
- Configuracion global suele usar lectura autenticada y escritura solo admin.
- Datos operativos se filtran por `created_by`.

## Backup

Existe endpoint backend para restauracion de backup. Debe tratarse como zona sensible:

- Debe ejecutarse en transaccion.
- Debe validar payload completo antes de borrar datos.
- Debe evitar borrar datos globales o compartidos sin una decision explicita.
- Tiene pruebas basicas de transaccion y reemplazo; antes de usarlo en produccion real requiere ampliar las pruebas de aislamiento y de datos globales.

Estado actual:

- Exportacion desde frontend usa datos del servidor.
- Restore backend esta restringido a admin.
- Restore reemplaza datos del usuario autenticado para padron, identificadores, respuestas, claves, vacantes, configuracion de calificacion y procesos.
- Restore tambien puede reemplazar datos globales como `DatFormatConfig` y plantillas de ponderacion.

Decision vigente:

- No endurecer restore todavia.
- Mantenerlo como pendiente controlado hasta decidir si el backup sera personal, institucional o ambos.
- No usar restore en datos reales sin copia previa de la base.

## Pendientes Tecnicos

- Revisar en una fase futura si `Area`, `DatFormatConfig` y plantillas deben seguir globales o pasar a depender de un proceso/convocatoria reintroducida.
- Endurecer backup con export/import backend completo cuando se defina el alcance personal/institucional.
- Ampliar las pruebas de restauracion y aislamiento, en especial para datos globales y errores de payload complejos.
- Preparar configuracion formal para despliegue.
