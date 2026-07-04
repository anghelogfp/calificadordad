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
- Por usuario: `Candidato`, `IdentifierSource`, `IdentifierRow`, `ResponseSource`, `ResponseRow`, `AnswerKeySource`, `AnswerKeyRow`, `ProgramaVacante`, `CalificationConfig`, `ProcesoCalificacion`, `VerificadorSesion`.

Decision vigente: el proceso de calificacion es la unidad operativa principal. No existe entidad fuerte de convocatoria. Si el negocio necesita convocatorias completamente independientes, debe reintroducirse como rediseño explicito.

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
- Debe tener pruebas especificas antes de usarse en produccion real.

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
- Agregar pruebas de restauracion y aislamiento.
- Preparar configuracion formal para despliegue.
