# Calificador DAD

Sistema web para calificar examenes de admision de la Direccion de Admision. Procesa padron de postulantes, archivos `.dat` de identificadores y respuestas, claves oficiales, ponderaciones por materia y genera resultados, ranking, ingresantes e historial.

## Estado Actual

- Frontend: Vue 3 + Vite.
- Backend: Django + Django REST Framework.
- Autenticacion: JWT.
- Base de datos local: SQLite.
- Datos principales: API/DB como fuente principal; `localStorage` queda para preferencias, tokens y metadata liviana.
- Motor critico de calificacion: separado en funciones de dominio testeables.
- UI/UX en curso: pantalla de resultados, modal de calificacion y pasos 1 al 5 ya reorganizados para reforzar estados operativos y verificacion por etapa.
- CI: frontend tests/build y backend tests en GitHub Actions.

## Documentacion Vigente

- [Arquitectura](docs/arquitectura.md)
- [Backend](docs/backend.md)
- [Frontend](docs/frontend.md)
- [Operacion](docs/operacion.md)
- [Testing](docs/testing.md)
- [Roadmap](docs/roadmap.md)

Los documentos anteriores se conservaron en [docs/historico](docs/historico/). Son referencia historica y pueden estar desactualizados.

## Levantar En Desarrollo

Backend:

```bash
cd backend
python manage.py migrate
python manage.py createsuperuser
python manage.py runserver
```

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

Nota: la ultima iteracion funcional fue frontend (`fix: pasos 1 al 5`). El backend no cambio en esa iteracion.
