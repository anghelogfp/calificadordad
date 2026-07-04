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
- Backend: autenticacion, usuarios, aislamiento por usuario, bulk replace, procesos, verificador, ponderaciones, areas y formato DAT.

## Ultima Verificacion Local

Fecha: 2026-07-04.

- Frontend: ultima iteracion registrada en commit `6b61871 fix: pasos 1 al 5`.
- Frontend: se agregaron pruebas para `StepNav`, `StepVerificationPanel`, `ProcessPathBadge`, respuestas, parsers y calculo.
- Backend: no cambio en la iteracion `fix: pasos 1 al 5`.
- Backend: `48` tests pasando en la ultima verificacion completa registrada anterior.

Notas del entorno:

- Se instalo `frontend/node_modules` con `npm install`.
- Se creo `.venv` local y se instalaron dependencias Python desde `requirements.txt`.
- `npm ci` fallo previamente porque `package-lock.json` no estaba sincronizado; `npm install` actualizo el lockfile y CI usa `npm ci`.
- Vite/Vitest requirieron ejecucion fuera del sandbox local por `spawn EPERM`.
- En esta iteracion se corrigio un error de render del modal al tratar `processAreas` como arreglo directo en vez de `ref/computed`.
- La documentacion fue actualizada despues del commit `6b61871`; no se ejecuto una nueva corrida completa de tests durante esta actualizacion documental.

## Brechas Importantes

- Golden tests con fixtures completas.
- Fixtures `.dat` reales o semirreales.
- Flujo E2E completo en navegador.
- Backup export/import con datos representativos.
- Prueba de carga con miles de postulantes.

## Recomendacion

Antes de nuevas refactorizaciones grandes:

1. Instalar dependencias localmente.
2. Ejecutar test/build backend y frontend.
3. Probar flujo completo con datos representativos.
4. Crear fixtures anonimizadas para repetir el flujo.
