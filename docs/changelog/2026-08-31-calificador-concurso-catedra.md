# Calificador del Concurso Público de Cátedra — 2026-08-31

## Objetivo

Calificar la **prueba de conocimientos** del Concurso Público de Cátedra 2026‑II
a partir de los archivos que entrega la unidad de cómputo, y dejar el motor de
calificación listo para integrarse más adelante como una modalidad de la app.

Es un flujo distinto al de admisión: se agrupa por **escuela profesional** (una
clave por escuela), no hay ponderaciones ni ranking, y el resultado es binario
**APTO / NO APTO** por un umbral fijo de aciertos.

## Entregable

Script standalone en `tools/concurso-catedra/` (no toca la app web):

| Archivo | Rol |
|---|---|
| `catedra_core.py` | Parsing de `.dat`/CSV, motor de calificación, `build_report`. |
| `catedra_report.py` | Generadores CSV / XLSX / PDF. |
| `calificar_catedra.py` | CLI. |
| `test_*.py` | 38 pruebas pytest. |
| `README.md`, `VERIFICACION.md`, `requirements.txt` | Documentación y dependencias. |

Uso:

```
python calificar_catedra.py --data "RUTA/data_catedra" --out "RUTA/salida" [--umbral 16]
```

## Archivos de referencia analizados

Directorio externo: `C:\Users\DAD-987\Desktop\calificacionConcursoCatedra2026`.

- `calificadodeOtro.pdf` — acta oficial de resultados (48 páginas), usada como
  referencia de verificación.
- `data_catedra/` — `escuelas.csv`, `data_Catedra.csv`, `claveid.dat`,
  `claveresp.dat`, `id100.dat`, `resp100.dat`.

No se copiaron al repositorio ni se importaron datos personales. El script y su
documentación son lo único versionado.

## Formato de datos

Línea `.dat` de ancho fijo, **sin carácter de "tipo"**:

```
col 41‑46  litho (folio óptico)         ← clave de cruce
col 47‑…   payload:
             id100.dat     → " " + DNI (8) + "001"
             resp100.dat   → 30 marcas A–E
             claveid.dat   → escuela_id (3) con relleno
             claveresp.dat → 30 respuestas correctas
```

Cruce: `resp100.litho → id100.litho → DNI → data_Catedra.escuela_id →
claveid.litho → claveresp`.

## Reglas de calificación (reconstruidas y validadas)

- Clave de **30 preguntas** por escuela. Secciones (Azángaro/Juli) sin clave
  propia usan la de su escuela matriz: `54→10`, `55→14`, `56→14`.
- Acierto = marca == clave.
- **Pregunta anulada** = casilla de clave en blanco → acierto para todos
  (escuela 5 P24, escuela 28 P23).
- Blanco del postulante = 0, sin penalización por error.
- `Puntaje /30` = aciertos.  `Puntaje /20` = `aciertos / 30 * 20`.
- **APTO** si `aciertos ≥ 16` (nota ≈ 11); umbral configurable con `--umbral`.

## Salidas

- `resultados_catedra.csv` — tabla plana.
- `resultados_catedra.xlsx` — hojas Resultados (color APTO/NO APTO), Resumen por
  escuela con TOTAL, Incidencias.
- `resultados_catedra.pdf` — A4 vertical, una página por escuela, insignia UNAP a
  ambos lados, nombre de escuela en banda destacada, cebra en la tabla, filas de
  mayor a menor puntaje, columnas `N° · DNI · APELLIDOS Y NOMBRES · ACIERTOS ·
  PTS/30 · NOTA/20 · CONDICIÓN`.

### Incidencias (requieren decisión humana, no se resuelven solas)

- `SIN_IDENTIFICAR` — hojas `001616`, `001571`: con respuestas, sin DNI marcado.
- `NO_RINDIO` — DNI `42156189` y `70014100`: en el padrón, sin hoja.
- `SIN_CLAVE`, `DNI_FUERA_DE_PADRON` — no se presentaron en este dataset.

El acta oficial trató estos 4 casos igual (no calificados).

## Verificación

- 38/38 pruebas pytest.
- Calificador de referencia independiente: 0 diferencias sobre los 253.
- **Diff automático campo por campo contra las 48 páginas del acta oficial:
  253/253 registros idénticos en DNI, apellidos y nombres, y condición.**
- Totales: **51 APTO · 202 NO APTO**.

Detalle en `tools/concurso-catedra/VERIFICACION.md`.

## Siguiente paso (pendiente, no iniciado)

Diseñar la integración como modalidad "Concurso de Cátedra" dentro de la app
(parser `.dat` nuevo, clave‑como‑hoja‑óptica, agrupación por escuela, salida
APTO/NO APTO con puntajes /30 y /20, persistencia e historial). Estimación previa:
~6–9 sesiones. El script actual sirve de especificación viva del motor.
