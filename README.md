# Calificador DAD

Sistema web para calificar examenes de admision de la Direccion de Admision. Procesa padron de postulantes, archivos `.dat` de identificadores y respuestas, claves oficiales, ponderaciones por materia y genera resultados, ranking, ingresantes e historial.

## Estado Actual

- Frontend: Vue 3 + Vite.
- Backend: Django + Django REST Framework.
- Autenticacion: JWT.
- Base de datos local: SQLite.
- Datos principales: API/DB como fuente principal; `localStorage` queda para preferencias, tokens y metadata liviana.
- Motor critico de calificacion: separado en funciones de dominio testeables, con una unica funcion de puntaje (`scoreAnswerSheet`) y una auditoria posterior que recalcula el resultado de forma independiente.
- Controles de integridad: la posicion de las respuestas se decide por la columna tipo, los espacios nunca se recortan, y cada calculo guarda huellas SHA-256 de su configuracion y sus datos (y cada archivo cargado la suya, sobre sus bytes originales).
- Resultados: panel de Revision (hojas sin alumno, respuestas incompletas, otras incidencias, alumnos sin hoja), confirmacion auditada del DNI de una hoja mal marcada y excepciones de pregunta (anulada con punto, anulada sin contar, varias respuestas validas).
- UI/UX: pantalla de resultados, modal de calificacion y pasos 1 al 5 reorganizados para reforzar estados operativos y verificacion por etapa; la revision de resultados se concentra en un unico panel.
- Respuestas y Claves incluyen un modal de cartilla visual para inspeccionar las cadenas cargadas sin salir de la tabla.
- El padrón oficial CEPREUNA de 23 columnas ya puede mapearse y conservarse completo; `N° DOCUMENTO` se reconoce como DNI.
- La conciliación entre padrón, identificadores y respuestas produce detalle por registro para el futuro reporte institucional de verificación.
- El verificador manual sigue siendo una herramienta auxiliar independiente del core principal.
- CI: frontend tests/build y backend tests en GitHub Actions.

## Documentacion Vigente

- [Arquitectura](docs/arquitectura.md)
- [Backend](docs/backend.md)
- [Frontend](docs/frontend.md)
- [Operacion](docs/operacion.md): instalacion, uso diario, revision de resultados, correcciones de DNI, excepciones y solucion de problemas
- [Reglas de calificacion](docs/reglas-de-calificacion.md): como se puntua una hoja y que controles protegen el resultado
- [Testing](docs/testing.md)
- [Roadmap](docs/roadmap.md)
- [Integracion de ramas](docs/integracion-ramas.md): que traer de `feat/calificacion-pj` y que no
- [BMAD](docs/bmad.md): agentes y flujos de trabajo, configuracion y uso desde Claude Code
- [Changelog](docs/changelog/README.md): registro de cambios por fecha

Los documentos anteriores se conservaron en [docs/historico](docs/historico/). Son referencia historica y pueden estar desactualizados.

## Levantar En Desarrollo

Backend (entorno virtual en `venv/` en la raiz; instalar con `pip install -r requirements.txt`):

```bash
cd backend
python manage.py migrate
python manage.py createsuperuser
python manage.py runserver
```

La base `backend/db.sqlite3` (ignorada por git) pertenece a la rama con la que se creo; ver [Operacion](docs/operacion.md#base-de-datos-de-desarrollo).

Frontend:

```bash
cd frontend
npm install
npm run dev
```

Abrir: `http://localhost:5173`

## Verificacion

Frontend:

```bash
cd frontend
npm run test
npm run build
```

Backend:

```bash
cd backend
python manage.py test
python manage.py check
```

Ultima verificacion local (2026-10-22): frontend 453 pruebas en 38 archivos y build correcto; backend 107 pruebas, `check` y `makemigrations --check` sin cambios pendientes. Detalle en [Testing](docs/testing.md).
