# Operacion

## Requisitos

- Node.js compatible con el proyecto.
- Python compatible con Django configurado.
- Dependencias instaladas en `frontend` y en el entorno Python usado por `backend`.

## Instalacion Local

Frontend:

```bash
cd frontend
npm install
```

Backend:

```bash
pip install -r requirements.txt
cd backend
python manage.py migrate
python manage.py createsuperuser
```

## Ejecutar

Backend:

```bash
cd backend
python manage.py runserver
```

Frontend:

```bash
cd frontend
npm run dev
```

URL local: `http://localhost:5173`

## Variables De Entorno

Backend:

- `DJANGO_DEBUG`
- `DJANGO_SECRET_KEY`
- `DJANGO_ALLOWED_HOSTS`
- `DJANGO_CORS_ALLOWED_ORIGINS`
- `DJANGO_SECURE_SSL_REDIRECT`
- `DJANGO_SECURE_HSTS_SECONDS`

Frontend:

- `VITE_API_BASE_URL`

## Flujo Operativo Sugerido

1. Iniciar backend y frontend.
2. Entrar con usuario creado.
3. Cargar padron.
4. Cargar identificadores.
5. Cargar respuestas.
6. Cargar claves.
7. Revisar ponderaciones.
8. Configurar vacantes si aplica.
9. Calificar.
10. Revisar no calificados.
11. Guardar historial.
12. Exportar reportes.

## Cuidados

- No usar restauracion de backup en datos reales sin copia previa de la base.
- Los backups validos deben exportarse desde el servidor. Backups antiguos basados solo en `localStorage` no se restauran automaticamente.
- El restore de backup es una operacion delicada de admin. Actualmente puede reemplazar plantillas y formato DAT globales.
- Hasta endurecer el backend, tratar restore como operacion institucional y no como accion diaria de usuario.
- Confirmar entorno activo antes de correr migraciones.
- Validar el flujo completo despues de cambios en persistencia o calificacion.
