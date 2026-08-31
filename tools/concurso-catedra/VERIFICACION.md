# Verificación contra el acta oficial

**Fecha:** 2026-08-31
**Insumo de referencia:** `calificadodeOtro.pdf` — acta oficial de resultados de
la prueba de conocimientos del Concurso Público de Cátedra 2026‑II (48 páginas,
una por escuela profesional), calificada por otra persona.

## Método

1. **Reconstrucción del algoritmo** a partir de los 6 archivos de entrada
   (`escuelas.csv`, `data_Catedra.csv`, `claveid.dat`, `claveresp.dat`,
   `id100.dat`, `resp100.dat`) sin conocer las reglas de antemano.
2. **Calificador de referencia independiente** (script aparte, otra
   implementación) para descartar errores de un solo código.
3. **Diff automático campo por campo** de los 253 postulantes calificables:
   se transcribieron las 48 páginas del acta oficial a un CSV y se compararon
   `DNI`, `Apellidos y Nombres` y `Condición` contra la salida del script.
   La comparación de nombres se hizo en mayúsculas y sin tildes (el acta es un
   escaneo; el OCR no distingue con certeza `É` de `E`).

## Resultado

```
acta oficial : 253 registros
script       : 253 registros
DNI solo en acta   : []      (ninguno)
DNI solo en script : []      (ninguno)

DIFERENCIAS DE CONDICIÓN (APTO / NO APTO) : 0
DIFERENCIAS DE NOMBRE                      : 0
```

**253/253 registros idénticos.**  Totales: **51 APTO · 202 NO APTO.**

Casos límite confirmados (15 aciertos = NO APTO, 16 = APTO), escuelas con
pregunta anulada (5 y 28) y secciones que usan la clave de su escuela matriz
(54→10, 55→14, 56→14): todos coinciden con el acta.

## Fuera de alcance (igual en ambos documentos)

| Caso | Detalle |
|---|---|
| `SIN_IDENTIFICAR` | Hojas `001616` y `001571`: con respuestas, sin DNI marcado. No calificadas. |
| `NO_RINDIO` | DNI `42156189` (INCACUTIPA LIMACHI — Sociología) y `70014100` (FLORES LOPEZ — Ing. Electrónica): en el padrón, sin hoja. No calificados. |

## Diferencias deliberadas frente al acta oficial (por diseño / pedido)

- Orden de filas: por **puntaje descendente** (el acta va alfabético por apellido).
- Columnas extra: `ACIERTOS`, `PTS/30`, `NOTA/20`.
- Orientación A4 vertical, encabezado propio, banda de escuela, cebra en la tabla.
- Sin los bloques de firma del acta oficial.

## Supuesto de fondo

El script confía en que `resp100.dat` y `claveresp.dat` reflejan fielmente el
escaneo óptico. Un error de captura en el archivo fuente se propagaría — pero es
**el mismo insumo** que usó el acta oficial, y el resultado coincide al 100%.

El umbral APTO (16 aciertos = nota ≈ 11) se dedujo de los datos; es inequívoco
para este dataset porque todas las claves tienen 30 preguntas. Conviene
contrastarlo con las bases del concurso antes de un uso oficial.
