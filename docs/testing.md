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
- Parsers `.dat`.
- Vinculacion de respuestas con identificadores.
- Importacion y validacion de claves.
- Preflight.
- Calculo puro.
- Validacion posterior de resultados.
- Componentes principales de tablas/resultados.
- Stepper, paneles de verificacion y badge del camino del proceso.
- Tratamiento de blancos finales asumidos en parser, resumen de observaciones y detalle de calificacion.
- Cierres de conciliacion y resumen de observaciones para identificadores y respuestas.
- Backend: autenticacion, usuarios, aislamiento por usuario, bulk replace, procesos, verificador, ponderaciones, areas y formato DAT.
- Backend: restauracion de backup con validacion de payload, transaccion y reemplazo basico de datos.

## Ultima Verificacion Local

Fecha: 2026-07-10.

- Frontend: ultima iteracion registrada en commit `5c3a977 fix` (2026-07-06), que refino la conciliacion visual de identificadores y respuestas.
- Frontend: `169` pruebas pasando en `21` archivos; build de produccion exitoso.
- Backend: `48` pruebas pasando y `python manage.py check` sin incidencias. El backend no cambio desde la iteracion de frontend indicada.

Notas del entorno:

- Se instalo `frontend/node_modules` con `npm install`.
- Se creo `.venv` local y se instalaron dependencias Python desde `requirements.txt`.
- `npm ci` fallo previamente porque `package-lock.json` no estaba sincronizado; `npm install` actualizo el lockfile y CI usa `npm ci`.
- Vite/Vitest requirieron ejecucion fuera del sandbox local por `spawn EPERM`.
- En esta iteracion se corrigio un error de render del modal al tratar `processAreas` como arreglo directo en vez de `ref/computed`.
- La documentacion fue contrastada con el codigo y las validaciones locales el 2026-07-10.

## Brechas Importantes

- Golden tests con fixtures completas.
- Fixtures `.dat` reales o semirreales.
- Flujo E2E completo en navegador.
- Backup export/import con datos representativos, aislamiento de datos globales y casos de error complejos.
- Política institucional de empates, corte de vacantes y publicación oficial de resultados.
- Prueba de carga con miles de postulantes.

## Recomendacion

Antes de nuevas refactorizaciones grandes:

1. Instalar dependencias localmente.
2. Ejecutar test/build backend y frontend.
3. Probar flujo completo con datos representativos.
4. Crear fixtures anonimizadas para repetir el flujo.
