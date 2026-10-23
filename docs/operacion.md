# Operacion

## Requisitos

- Node.js 22 recomendado, alineado con CI.
- Python 3.13 recomendado, alineado con CI y Django 6.
- Dependencias instaladas en `frontend` y en el entorno Python usado por `backend`.
- Entorno virtual de Python: `venv/` en la raiz del repositorio (`venv/bin/python` en macOS y Linux, `venv/Scripts/python.exe` en Windows). Esta ignorado por git.

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

Con el entorno de la raiz, desde `backend/`:

```bash
../venv/bin/python manage.py migrate
../venv/bin/python manage.py runserver 8000
```

### Base de datos de desarrollo

`backend/db.sqlite3` esta ignorada por git y **pertenece a la rama con la que se creo**. Una base creada con otra rama puede tener columnas obligatorias que esta no conoce y rechazar guardar datos con error 500 (el padron o las respuestas parecen cargar, pero solo quedan en memoria del navegador). Si pasa, usar una base nueva (`rm backend/db.sqlite3` y `python manage.py migrate`, guardando antes una copia) y crear un usuario:

```bash
python manage.py createsuperuser
```

Despues de aplicar migraciones nuevas, reiniciar el servidor de desarrollo.

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

- La fecha de nacimiento se acepta como `DD/MM/YYYY`, `DD-MM-YYYY` o `YYYY-MM-DD` y se guarda en formato ISO. Una fecha imposible o desconocida se descarta sin bloquear el padron completo (antes, el formato `13/01/2014` hacia que la API rechazara las 281 filas y el padron solo quedara en memoria).
- Se admiten libros exportados con una tabla con filtros aplicados (por ejemplo, los de SIAGIE): la lectura usa `exceljs` 4.4. Se lee siempre la primera hoja del libro.

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
- La alineacion de las respuestas depende de la columna tipo: una letra P-T indica que la columna existe, una letra A-E indica que no existe, y un espacio (tipo sin marcar) se resuelve con la disposicion del resto del archivo. Un blanco al inicio o al final de la hoja nunca cambia la posicion de las preguntas.
- Las respuestas se guardan en la API sin recortar espacios (`trim_whitespace=False`): cada espacio es una pregunta en blanco.

## Ubicar Fichas Con DNI Desconocido (pasos 2 y 3)

En Identificadores y en Respuestas, cuando hay padron cargado y alguna ficha trae un DNI que no coincide con ningun alumno, aparece el boton **Ver DNI sin alumno (N)** junto a "Ver observados":

1. Al pulsarlo, la tabla muestra solo esas fichas, resaltadas, y un panel con la hoja, el aula, el DNI leido y el **posible alumno** (un digito de diferencia). Indica si ese alumno ya tiene su propia ficha y si la hoja ya tiene una correccion confirmada.
2. La sugerencia es una pista: **verificar con la hoja fisica o con el colegio**.
3. Para corregir: editar el DNI en la tabla (error evidente de lectura optica) o, despues de calificar, confirmar la correccion en Resultados > Revision (queda auditada y se puede deshacer).
4. "Ver todos" regresa a la tabla completa. Si ya no queda ninguna ficha por revisar, el filtro se apaga solo.

## Revision Despues De Calificar

En Resultados, bajo la franja de estado (calificados, ingresantes, promedio), el panel **Revision** resume lo que requiere atencion. Empieza colapsado y tiene pestanas con busqueda y paginacion:

| Pestana | Que muestra | Tono |
|---|---|---|
| Hojas sin alumno | Hojas cuyo DNI no esta en el padron, con DNI sugerido y puntaje provisional | Requiere accion |
| Respuestas incompletas | Hojas calificadas con menos respuestas de las esperadas ("57 de 60 leidas") | Requiere accion |
| Otras incidencias | DNI invalido o duplicado, sin clave, sin programa, tipo invalido, con "que hacer" | Requiere accion |
| Alumnos sin hoja | Alumnos del padron sin hoja de respuestas | Informativo |

"Descargar revision (Excel)" exporta solo la revision (alumnos sin hoja, otras incidencias y hojas sin alumno con sus sugerencias).

En un simulacro por colegios es normal que haya alumnos sin hoja (faltaron o no marcaron su DNI): por eso es informativo y no un error.

## Corregir El DNI De Una Hoja

Para hojas cuyo DNI esta mal marcado:

1. Abrir Revision > **Hojas sin alumno**.
2. Cada fila muestra el DNI marcado, el alumno sugerido (DNI a una edicion de distancia), el puntaje que tendria y la posicion.
3. **Verificar fuera del sistema** (hoja fisica o el colegio): un DNI parecido no prueba quien es el alumno.
4. **Confirmar**, y despues "Si, confirmar". Pide confirmacion en pantalla y explica que la hoja entrara al ranking.
5. El ranking se recalcula; el alumno aparece con la marca verde **DNI corregido** (el cursor muestra el DNI que traia la hoja).
6. **Deshacer** revoca la correccion y el alumno sale del ranking.

Sugerencias bloqueadas (no se pueden confirmar): el alumno ya tiene su propia hoja, ya fue confirmado con otra hoja, o la hoja sugiere al mismo alumno que otra.

**Antes de enviar resultados oficiales:** confirmar una hoja cambia los puestos de todos los demas. Si ya se envio un ranking, el nuevo debe enviarse como version actualizada indicando que reemplaza al anterior.

## Excepciones De Preguntas

En Resultados, panel **Excepciones de preguntas**:

1. Elegir la **clave** (area y tipo de prueba), el **numero de pregunta** y la **accion**: anular dando el punto a todos, anular sin contar, o aceptar varias respuestas.
2. Escribir el **motivo** (obligatorio) y, si existe, el documento de sustento.
3. El panel muestra la materia y el peso de la pregunta y como respondieron los postulantes. Si casi nadie marco la clave, avisa: puede que la clave sea la equivocada.
4. Confirmar en pantalla. El ranking se recalcula.
5. **Deshacer** revoca la excepcion.

En convocatoria real hay que registrar la excepcion por cada tipo de prueba (P, Q, R, S, T), cada uno con su numeracion. Si la clave cambia (otro examen), las excepciones viejas quedan **sin efecto** y se avisa; no se aplican. Las reglas completas estan en `docs/reglas-de-calificacion.md`.

## Trazabilidad De Los Archivos

Cada archivo cargado muestra el inicio de su SHA-256 (completo al pasar el cursor). Para comprobar que es el mismo archivo:

```bash
shasum -a 256 RESP_COLEGIO_01.dat        # macOS / Linux
Get-FileHash RESP_COLEGIO_01.dat         # Windows (PowerShell)
```

Cada resultado guarda la huella de configuracion y la de datos (Resultados > Detalles tecnicos del calculo, y la hoja Resumen del Excel). Con las mismas claves, valores, plantilla, correcciones, excepciones, padron y hojas, las huellas son identicas.

## Solucion De Problemas

| Sintoma | Causa probable | Que hacer |
|---|---|---|
| Despues de actualizar el codigo, los resultados siguen mal | La pestana del navegador sigue ejecutando el codigo anterior | Recarga forzada (Cmd+Shift+R) y volver a cargar padron, identificadores, respuestas y claves |
| El padron "carga" pero al recargar la pagina desaparece | La API rechazo el guardado (error 500 o 400) | Revisar la consola del navegador y el log del backend; ver "Base de datos de desarrollo" |
| Al cargar respuestas aparece un aviso de hojas distintas a lo guardado | Algo altero las respuestas entre el archivo y la base | Recargar con Cmd+Shift+R y volver a cargar el archivo |
| "Hojas sin alumno" no baja aunque corregi el padron | El DNI de la hoja sigue sin estar en el padron | Corregir el padron o confirmar una correccion de DNI |
| Una excepcion aparece "sin efecto" | La clave cargada cambio desde que se registro | Registrar la excepcion de nuevo sobre la clave actual, o deshacerla |
| El calculo se bloquea con un error de excepcion | Dos excepciones para la misma pregunta de la misma clave, o datos invalidos | Deshacer la que sobra |
| No deja calcular en convocatoria real | Faltan claves P/Q/R/S/T, programa o vacantes | Ver el preflight en el modal de calificacion |

## Cuidados

- No usar restauracion de backup en datos reales sin copia previa de la base.
- Los backups validos deben exportarse desde el servidor. Backups antiguos basados solo en `localStorage` no se restauran automaticamente.
- El restore de backup es una operacion delicada de admin. Actualmente puede reemplazar plantillas y formato DAT globales.
- Hasta endurecer el backend, tratar restore como operacion institucional y no como accion diaria de usuario.
- Confirmar entorno activo antes de correr migraciones.
- Validar el flujo completo despues de cambios en persistencia o calificacion.
- Las correcciones de DNI y las excepciones de pregunta se incluyen en el backup y se reemplazan al restaurarlo. Un backup anterior sin esas secciones deja al usuario sin correcciones ni excepciones.
- Registrar una correccion de DNI o una excepcion cambia puntajes y puestos oficiales: hacerlo solo con respaldo documental.
