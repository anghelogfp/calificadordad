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

## Endpoints

Todos exigen usuario autenticado (JWT) salvo login y refresh. Los datos operativos se filtran por `created_by`.

| Ruta | Recurso | Alcance |
|---|---|---|
| `/api/areas/`, `/api/dat-format-configs/`, `/api/plantillas/`, `/api/ponderaciones/` | Areas, formato DAT, plantillas | Global (lectura autenticada, escritura admin) |
| `/api/candidatos/` | Padron | Por usuario |
| `/api/identifier-sources/`, `/api/identificadores/` | Identificadores | Por usuario |
| `/api/response-sources/`, `/api/respuestas/` | Respuestas | Por usuario |
| `/api/answer-key-sources/`, `/api/answer-keys/` | Claves | Por usuario |
| `/api/programa-vacantes/`, `/api/calification-configs/` | Vacantes y configuracion | Por usuario |
| `/api/correcciones-dni/` | Correcciones de DNI (listar, crear, deshacer) | Por usuario |
| `/api/excepciones-pregunta/` | Excepciones de pregunta (listar, crear, deshacer) | Por usuario |
| `/api/procesos/` (`/{id}/full/`) | Procesos y resultados | Por usuario |
| `/api/verificador/` | Sesiones del verificador manual | Por usuario |
| `/api/backup/restore/` | Restauracion de backup | Solo admin |

Los recursos con `bulk_replace` (padron, identificadores, respuestas, claves) reemplazan el contenido completo del usuario.

## Huellas SHA-256

- `IdentifierSource`, `ResponseSource` y `AnswerKeySource` guardan `sha256` y `file_size` del archivo original (en claves, ademas `identification_sha256`). Son opcionales: los clientes anteriores no los envian y quedan vacios. Se validan como 64 caracteres hexadecimales en minuscula o vacio.
- `AreaCalificacion` guarda `config_sha256` y `data_sha256` del calculo. Un valor que no sea un SHA-256 valido no se guarda como huella (queda vacio); uno en mayusculas se normaliza a minuscula.

## Datos Guardados Con El Resultado

Ademas del puntaje, `AreaCalificacion` y `ResultadoCandidato` conservan lo necesario para auditar el calculo despues:

- `AreaCalificacion`: `sheets_without_candidate`, `dni_corrections_applied`, `question_exceptions` (excepciones del calculo con su estado), `config_sha256`, `data_sha256`.
- `ResultadoCandidato`: `dni_corregido`, `dni_original`, `exceptions_applied` (excepciones aplicadas a esa hoja).

No se persisten `questionDetails` ni la pestana de "Respuestas incompletas" del historial: al abrir un proceso guardado, el detalle por pregunta se recalcula con las respuestas, la clave y `exceptions_applied`.

## Migraciones

| App | Migracion | Cambio |
|---|---|---|
| `convocatorias` | `0011` | Campos del padron oficial |
| `convocatorias` | `0012_dnicorrection` | Correcciones de DNI |
| `convocatorias` | `0013_answerkeysource_file_size_and_more` | Huellas SHA-256 y tamano de las fuentes |
| `convocatorias` | `0014_questionexception` | Excepciones de pregunta |
| `resultados` | `0007_area_no_calificados` | No calificados por area |
| `resultados` | `0008_marca_dni_corregido` | Marca de DNI corregido y conteos de revision |
| `resultados` | `0009_areacalificacion_config_sha256_and_more` | Huellas del calculo |
| `resultados` | `0010_areacalificacion_question_exceptions_and_more` | Excepciones del calculo y por hoja |

`feat/calificacion-pj` tiene migraciones propias con los mismos numeros y nombres de campo; ver `docs/integracion-ramas.md`.

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
- Restore reemplaza datos del usuario autenticado para padron, identificadores, respuestas, claves, vacantes, configuracion de calificacion, correcciones de DNI, excepciones de pregunta y procesos (con sus huellas y marcas).
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
