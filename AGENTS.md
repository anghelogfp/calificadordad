<!-- bmad:context -->
<!-- Verificado el 2026-10-09 contra 76000e4c9b0b14816f6849d0dde7962e3f93b481.
Gestionado por bmad-project-context. -->

## Referencias de trabajo

- Usa docs/arquitectura.md y docs/operacion.md para el flujo del calificador; trata docs/historico/ como referencia histórica.
- Al modificar backups, consulta docs/backend.md y backend/config/backup_views.py: la restauración también reemplaza plantillas globales.
- Trata tools/concurso-catedra/ como herramienta independiente; sus reglas de APTO/NO APTO no son reglas de admisión.

## Ejecución y verificación

- Para Django local, desde backend/, usa ../venv/Scripts/python.exe manage.py; dev.bat utiliza ese entorno.
- Para reproducir CI, usa Node 22 y Python 3.13; consulta .github/workflows/ci.yml para las comprobaciones.

## Reglas entre componentes

- Mantén API/BD como fuente de datos de negocio; respeta una respuesta vacía y no recuperes tablas antiguas de localStorage.
- Mantén la lógica de calificación en frontend/src/domain/calification/; no la dupliques en componentes Vue.
- Conserva el preflight y la auditoría posterior al cálculo antes de aceptar resultados; verifica los cambios con las pruebas de dominio.
- Conserva el aislamiento por created_by y las comprobaciones de propiedad en los datos operativos; distingue los recursos globales compartidos.

<!-- /bmad:context -->
