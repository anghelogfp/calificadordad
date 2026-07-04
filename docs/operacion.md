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
3. Crear un proceso y elegir su camino: `Simulacro general`, `Simulacro por areas` o `Convocatoria real`.
4. Cargar padron.
5. Cargar identificadores.
6. Cargar respuestas.
7. Cargar claves segun el camino elegido.
8. Revisar ponderaciones.
9. Configurar vacantes si aplica.
10. Calificar.
11. Revisar no calificados.
12. Guardar historial.
13. Exportar reportes.

## Puntos De UI Que Ya Deben Verse Claros

- El stepper superior debe mostrar cinco pasos operativos con estado `Listo`, `Revisar` o `Pendiente`.
- Cada paso debe mostrar una descripcion breve y la accion esperada, por ejemplo cargar padron, revisar cruces, corregir faltantes o calcular puntajes.
- Padron, identificadores, respuestas, claves y resultados deben mostrar un panel de verificacion con resumen, chips y observaciones relevantes.
- En resultados, el bloque principal debe mostrar estado, no calificados e incidencias antes del detalle tecnico.
- El modal de calificacion debe mostrar contexto superior, configuracion, salida y validacion sin parecer cuatro tarjetas aisladas.
- Si falta informacion para calificar, el click debe dar feedback visible y no quedarse silencioso.
- El boton `Calcular Puntajes` debe seguir abriendo el modal aun cuando haya datos incompletos; el bloqueo real se explica dentro del flujo.
- El camino elegido al crear el proceso debe verse igual en claves, ponderaciones, calculo, resultados, historial y dashboard.
- `Simulacro por areas` debe cargar claves por area; no queda cubierto por una clave general.
- Las respuestas con menos marcas al final deben aparecer como `Blancos finales asumidos`, no como error critico de cadena incompleta.

## Cuidados

- No usar restauracion de backup en datos reales sin copia previa de la base.
- Los backups validos deben exportarse desde el servidor. Backups antiguos basados solo en `localStorage` no se restauran automaticamente.
- El restore de backup es una operacion delicada de admin. Actualmente puede reemplazar plantillas y formato DAT globales.
- Hasta endurecer el backend, tratar restore como operacion institucional y no como accion diaria de usuario.
- Confirmar entorno activo antes de correr migraciones.
- Validar el flujo completo despues de cambios en persistencia o calificacion.
