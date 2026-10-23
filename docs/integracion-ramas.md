# Integracion De Ramas

Analisis hecho el 2026-10-22 de las ramas que tienen trabajo que `main` no tiene, y estado de lo que se fue trayendo.

## Ramas

| Rama | Contenido | Decision |
|---|---|---|
| `feat/calificacion-pj` | Adaptacion completa al concurso del Poder Judicial (CSJ Puno): `processType` nuevo, 27 codigos de examen, 59 puestos, actas, verificador de 30 preguntas, empaquetado Windows. 7 commits en GitHub que `main` no tiene. | **No se fusiona entera.** Se traen piezas genericas una por una. |
| `ELMER_V1` | De agosto de 2026. Casi todas sus lineas son chats autoguardados de una herramienta (`.codely-cli`), no codigo; lo real es un redisenio de estructura de interfaz (`HomeLayout`, `ProcessLayout`) sobre una base muy anterior. | **No se fusiona.** Si se quiere esa idea de interfaz, se rehace sobre el estado actual. |
| `anghelogfp/saludo-terminal-check` | Rama de trabajo ya fusionada en `main`. | Se puede borrar. |

## Estado de `feat/calificacion-pj`

- Esta sana: sus 197 pruebas de frontend y sus 53 de backend pasan y el build compila.
- Fusion de prueba contra `main` (2026-10-22): 4 archivos en conflicto directo (`calculateResults.js`, `useCalification.js` y los `tests.py` de `convocatorias` y `resultados`) y migraciones duplicadas (`convocatorias/0012` y `resultados/0008` distintas en cada rama). Git fusiono solo varios archivos que tambien cambiaron en `main` (parsers, validacion, preflight); eso no garantiza que el resultado sea correcto.
- **Aviso:** esa rama usa los mismos nombres de campo que ya existen en `main` (`sha256`, `file_size`, `config_sha256`). Si se fusionara entera, sus migraciones chocarian con las de `main`.
- **La base de datos de desarrollo es propia de cada rama.** Una base creada con `feat/calificacion-pj` tiene columnas obligatorias (`aula_padron`, `file_size`...) que `main` no conoce y rechaza guardar datos con error 500. Al cambiar de rama, usar una base distinta o hacer copia antes. El 2026-10-22 la base de esa rama se respaldo en `~/Documents/admision_work/respaldos-db/`.

## Piezas genericas y estado

| Pieza | Valor para admision | Estado |
|---|---|---|
| Trazabilidad SHA-256 (archivos y huella de calculo) | Alto | **Hecho** (`docs/changelog/2026-10-22-trazabilidad-sha256.md`). Se mejoro: hash de bytes, no de texto; nunca un hash falso; se agrego huella de datos. |
| Excepciones de pregunta (anulada con punto, anulada sin contar, varias respuestas) | Alto | **Hecho** (`docs/changelog/2026-10-22-excepciones-de-preguntas.md`). Diseno propio: ligadas a la clave por hash, auditoria independiente, una sola funcion de puntaje. |
| Empates y corte de vacantes (puesto compartido, menos errores, alfabetico, marca de empate en la ultima vacante) | Alto en convocatoria real | **Pendiente.** Requiere decision institucional de la regla (ver `docs/reglas-de-calificacion.md`, seccion 5). |
| Pruebas sinteticas previas al calculo (5 pruebas obligatorias) | Medio | Pendiente. En esa rama dependen del codigo del Poder Judicial; habria que desacoplarlas. |
| Ejecutable Windows (PyInstaller + flujo de GitHub) | Medio, si la oficina usa Windows | Pendiente. El lanzador de esa rama crea el usuario `admin` con contrasena `admin123`; habria que cambiarlo. |
| Bitacora de eventos (`EventoBitacora`) | Medio | Pendiente. Cubriria quien hizo cada accion; hoy hay auditoria por correccion y por excepcion. |
| Backup ampliado y Verificador (+196 y +1,800 lineas) | Por revisar | Sin analizar a fondo. |
| Actas del Poder Judicial y `ActasPjView` (4,000 lineas) | Bajo para admision | No se trae: es otro producto. |
| Motor de 27 examenes y 59 puestos (`calculatePjResults`) | No aplica | No se trae. |

## Como retomarlo

1. Elegir la siguiente pieza (recomendada: empates y corte, una vez definida la regla).
2. Leer su implementacion con `git show origin/feat/calificacion-pj:<ruta>`.
3. Portarla sobre `main` con su diseno y pruebas, sin traer el `processType` del Poder Judicial.
4. Actualizar la tabla de arriba.
