# Testing

## Comandos

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

CI:

- Frontend: `npm ci`, `npm run test`, `npm run build`.
- Backend: instala `requirements.txt` y ejecuta `python manage.py test`.

## Cobertura Actual

El repo contiene pruebas para:

- Helpers de normalizacion.
- Parsers `.dat`: posicion de respuestas por columna tipo (incluida una prueba aleatoria de 500 hojas), tipo sin marcar, blancos al inicio y al final, auditoria de archivos.
- Vinculacion de respuestas con identificadores.
- Importacion y validacion de claves; importacion del padron (formatos de fecha, libros con tablas filtradas).
- Preflight, calculo puro y auditoria posterior, incluido el recalculo independiente del puntaje.
- `scoreAnswerSheet`: 3,000 hojas aleatorias contra la formula anterior (sin excepciones el resultado es identico) y casos de cada excepcion.
- Excepciones de pregunta: clasificacion, huella de clave, motor (simulacro general, por areas y real con varios tipos), auditoria, preflight, composable, panel, detalle del alumno, exportaciones y verificador.
- Fichas con DNI desconocido en los pasos 2 y 3 (filtro, panel de pista, integracion en ambas pestanas).
- Correcciones de DNI: sugerencias, vista previa, bloqueos, conflictos, aplicacion en el ranking, proteccion contra numeros de hoja repetidos.
- Hojas con respuestas incompletas o excedentes.
- Huellas SHA-256: el algoritmo contra `crypto` de Node (vectores oficiales, limites de bloque, 200 contenidos aleatorios), hash de los bytes y no del texto, huellas de configuracion y datos.
- Componentes: tablas, resultados, panel de Revision, panel de excepciones, listas de archivos, detalle del alumno, verificador, stepper y paneles de verificacion.
- Exportaciones Excel y PDF (marcas de DNI corregido, excepciones, huellas).
- Cierres de conciliacion y resumen de observaciones.
- Backend: autenticacion, usuarios, aislamiento por usuario, bulk replace, procesos, verificador, ponderaciones, areas y formato DAT.
- Backend: conservacion de espacios en respuestas, correcciones de DNI, excepciones de pregunta (validaciones y aislamiento), huellas de archivos y resultados, marcas en el historial.
- Backend: restauracion de backup con validacion de payload, transaccion y reemplazo de datos, correcciones y excepciones.

## Ultima Verificacion Local

Fecha: 2026-10-22.

- Frontend: `453` pruebas pasando en `38` archivos.
- Frontend: build de produccion exitoso.
- Backend: `107` pruebas pasando.
- Backend: `python manage.py check` sin incidencias.
- Backend: `python manage.py makemigrations --check --dry-run` sin cambios pendientes.
- Migraciones aplicadas en la base local: `convocatorias.0012` a `0014` y `resultados.0008` a `0010`.
- Verificacion con datos reales (simulacro de 179 hojas): las respuestas guardadas coinciden con los archivos, los 152 puntajes no cambian tras refactorizar el puntaje, y los hashes de los 12 archivos `.dat` coinciden con `shasum`.

Notas del entorno:

- Dependencias del frontend con `npm ci`/`npm install`; `exceljs` esta en 4.4.0 (3.4 fallaba con libros con tablas filtradas).
- Entorno Python en `venv/` en la raiz.
- El build mantiene advertencias no bloqueantes de `exceljs` por `eval` y tamano del chunk de exportacion Excel.
- Algunas pruebas de componentes que usan `Teleport` leen del `document.body`.
- Las pruebas de algoritmos usan `crypto` de Node como referencia, por eso fijan `@vitest-environment node`.

## Brechas Importantes

- Golden tests con fixtures completas.
- Fixtures `.dat` reales o semirreales.
- Flujo E2E completo en navegador.
- Backup export/import con datos representativos, aislamiento de datos globales y casos de error complejos.
- Politica institucional de empates, corte de vacantes y publicacion oficial de resultados.
- Pruebas del modo convocatoria real con datos reales (claves P/Q/R/S/T, cupos, ingresantes): hasta ahora se ejercito con simulacros.
- Verificacion visual automatizada (las pantallas nuevas se revisaron con pruebas de componentes y capturas manuales, no con E2E).
- Prueba de carga con miles de postulantes.

## Recomendacion

Antes de nuevas refactorizaciones grandes:

1. Instalar dependencias localmente.
2. Ejecutar test/build backend y frontend.
3. Probar flujo completo con datos representativos.
4. Crear fixtures anonimizadas para repetir el flujo.
