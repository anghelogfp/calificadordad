# Operacion

## Requisitos

- Node.js 22 recomendado, alineado con CI.
- Python 3.13 recomendado, alineado con CI y Django 6.
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
- `DJANGO_SECURE_HSTS_INCLUDE_SUBDOMAINS`
- `DJANGO_SECURE_HSTS_PRELOAD`

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

En convocatoria real, `0` vacantes significa que el programa no tiene cupos y no generará ingresantes. Para un simulacro general debe existir una única clave sin área; las claves de área no se usan como reemplazo.

En las tablas de Respuestas y Claves tambien existe una vista de cartilla en modal para revisar la cadena cargada antes de seguir con el proceso.

## Padron Excel

El Paso 1 lee la primera hoja del `.xlsx` y usa la primera fila como encabezados. Las columnas pueden venir en distinto orden.

Columnas reconocidas:

- DNI: `dni`, `documento`, `numdoc`, `número de documento`.
- Apellido paterno: `paterno`, `apellido paterno`, `apellido_paterno`, `apellidos paterno`, `apellidos_paterno`, `ape_pat`, `ap_paterno`.
- Apellido materno: `materno`, `apellido materno`, `apellido_materno`, `apellidos materno`, `apellidos_materno`, `ape_mat`, `ap_materno`.
- Nombres: `nombres`, `nombre`, `nombres completos`.
- Observaciones: `observaciones`, `observacione`, `obs`.
- Area: `area`, `área`, `especialidad`, `desarea`, `des_area`, `area_des`, `descripcion area`, `descripción área`, `areades`, `cod_area`, `codarea`, `area de postulacion`, `área de postulación`.
- Programa: `programa`, `desprograma`, `des_programa`, `carrera`, `escuela`, `programa de estudios`, `prog`.

Columnas extra como `nro` o `sede` no bloquean la importacion; se ignoran mientras no exista un campo operativo para ellas.

## Puntos De UI Que Ya Deben Verse Claros

- El stepper superior debe mostrar cinco pasos operativos con estado `Listo`, `Revisar` o `Pendiente`.
- Cada paso debe mostrar una descripcion breve y la accion esperada, por ejemplo cargar padron, revisar cruces, corregir faltantes o calcular puntajes.
- Padron, identificadores, respuestas, claves y resultados deben mostrar un panel de verificacion con resumen, chips y observaciones relevantes.
- En identificadores y respuestas, el panel debe separar los cierres del DAT y del padron, los duplicados y la calidad del archivo; los totales deben ser conciliables entre si.
- En resultados, el bloque principal debe mostrar estado, no calificados e incidencias antes del detalle tecnico.
- El modal de calificacion debe mostrar contexto superior, configuracion, salida y validacion sin parecer cuatro tarjetas aisladas.
- Si falta informacion para calificar, el click debe dar feedback visible y no quedarse silencioso.
- El boton `Calcular Puntajes` debe seguir abriendo el modal aun cuando haya datos incompletos; el bloqueo real se explica dentro del flujo.
- El camino elegido al crear el proceso debe verse igual en claves, ponderaciones, calculo, resultados, historial y dashboard.
- `Simulacro por areas` debe cargar claves por area; no queda cubierto por una clave general.
- `Simulacro general` requiere exactamente una clave sin área; una clave de área no reemplaza la clave general.
- Las claves duplicadas para la misma área y tipo bloquean el cálculo hasta que se conserve una sola.
- En convocatoria real, las respuestas con tipo distinto de `P`, `Q`, `R`, `S` o `T` quedan observadas y no se califican.
- `0` vacantes significa que el programa no tiene vacantes y no marcará ingresantes.
- Las respuestas con menos marcas al final deben aparecer como `Blancos finales asumidos`, no como error critico de cadena incompleta.

## Cuidados

- No usar restauracion de backup en datos reales sin copia previa de la base.
- Los backups validos deben exportarse desde el servidor. Backups antiguos basados solo en `localStorage` no se restauran automaticamente.
- El restore de backup es una operacion delicada de admin. Actualmente puede reemplazar plantillas y formato DAT globales.
- Hasta endurecer el backend, tratar restore como operacion institucional y no como accion diaria de usuario.
- Confirmar entorno activo antes de correr migraciones.
- Validar el flujo completo despues de cambios en persistencia o calificacion.
