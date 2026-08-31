# Calificador — Concurso Público de Cátedra (UNAP)

Script standalone para calificar la **prueba de conocimientos** del Concurso
Público de Cátedra 2026‑II. Es independiente de la app web; sirve además como
especificación viva del motor de calificación para cuando se integre como una
modalidad más del sistema.

> **Contexto:** distinto a la admisión. Aquí se agrupa por **escuela profesional**
> (48 con postulantes, 1 clave por escuela), no hay ponderaciones ni ranking, y el
> resultado es binario **APTO / NO APTO** por un umbral fijo de aciertos.

## Requisitos

```
pip install -r requirements.txt      # openpyxl, reportlab (+ pytest, pypdf para tests)
```

## Entrada

Una carpeta con estos 6 archivos (los que entrega la unidad de cómputo):

| Archivo | Contenido |
|---|---|
| `escuelas.csv` | `id,nombre` de cada escuela profesional |
| `data_Catedra.csv` | Padrón: `N°,salon,dni,apellido_paterno,apellido_materno,nombres,escuela_id,escuela_profesional,facultad_id,facultad,facultad_sigla,plaza,plaza_adicional` |
| `claveid.dat` | Hoja óptica de cada clave: mapea `litho → escuela_id` |
| `claveresp.dat` | Respuestas correctas (30) por `litho` de clave |
| `id100.dat` | Identificadores de postulantes: `litho → DNI` |
| `resp100.dat` | Respuestas marcadas (30) por `litho` de postulante |

### Anatomía de una línea `.dat` (ancho fijo, sin carácter de "tipo")

```
col 1‑3    tipo de registro (227 = identificación, 228 = respuestas)
col 4‑9    correlativo
col 10‑40  constantes del lote (…001010102001…5310…#0001…N)
col 41‑46  litho (folio óptico, 6 dígitos)   ← clave de cruce
col 47‑…   payload:
             id100.dat     → " " + DNI (8 díg.) + "001"
             resp100.dat   → 30 marcas A–E (los espacios = respuesta en blanco)
             claveid.dat   → escuela_id (3 díg.) con relleno de espacios
             claveresp.dat → 30 respuestas correctas (un espacio = pregunta anulada)
```

Cruce de datos:
`resp100.litho → id100.litho → DNI` · `DNI → data_Catedra.escuela_id` ·
`escuela_id → claveid.litho → claveresp` (30 claves).

## Uso

```
python calificar_catedra.py --data "RUTA/data_catedra" --out "RUTA/salida" [--umbral 16]
```

| Opción | Descripción |
|---|---|
| `--data` | Carpeta con los 6 archivos de entrada (obligatorio). |
| `--out` | Carpeta de salida (obligatorio; se crea si no existe). |
| `--umbral N` | Aciertos mínimos para **APTO**. Default **16** (= nota 10.667 ≈ 11). |
| `--overrides archivo.csv` | Filas `litho,dni` para identificar a mano hojas sin DNI marcado. |
| `--logo ruta.png` | Insignia para el encabezado del PDF. Default: `frontend/public/unap.png`. |

## Reglas de calificación (reconstruidas y validadas contra el acta oficial)

- Cada escuela tiene su **clave de 30 preguntas**. Las **secciones** (Azángaro /
  Juli) sin clave propia usan la clave de su **escuela matriz** — la deducción es
  por nombre (`"X - Sección Y"` → escuela `"X"`). En este dataset: `54→10`,
  `55→14`, `56→14`.
- **Acierto** = la marca coincide con la clave.
- **Pregunta anulada** = casilla de la clave en blanco → cuenta como **acierto
  para todos**. En este dataset: escuela 5 (Med. Veterinaria) P24, escuela 28
  (Educ. Física) P23.
- **Respuesta en blanco** del postulante = 0, **no penaliza**; tampoco hay
  penalización por error.
- `Puntaje /30` = aciertos.  `Puntaje /20` = `aciertos / 30 * 20` (3 decimales).
- **APTO** si `aciertos ≥ umbral`.

## Salida (en `--out`)

| Archivo | Contenido |
|---|---|
| `resultados_catedra.csv` | Tabla plana de todos los calificados. |
| `resultados_catedra.xlsx` | Hojas **Resultados** (Condición con color verde/rojo), **Resumen** por escuela (con fila TOTAL), **Incidencias**. |
| `resultados_catedra.pdf` | Una página por escuela profesional (A4 vertical, insignia UNAP a ambos lados, nombre de la escuela en banda destacada, cebra en la tabla), columnas `N° · DNI · APELLIDOS Y NOMBRES · ACIERTOS · PTS/30 · NOTA/20 · CONDICIÓN`. |

Dentro de cada escuela las filas van **de mayor a menor puntaje** (desempate por
apellido). Si el PDF de destino está abierto en un visor, el script escribe una
copia con sufijo de hora en vez de abortar.

### Incidencias que reporta (no las resuelve solo — requieren decisión humana)

| Tipo | Significado |
|---|---|
| `SIN_IDENTIFICAR` | Hoja con respuestas pero sin DNI marcado. No calificable; usar `--overrides`. |
| `NO_RINDIO` | Persona del padrón sin hoja de identificación. |
| `SIN_CLAVE` | Escuela sin clave propia ni escuela matriz detectable. |
| `DNI_FUERA_DE_PADRON` | DNI en `id100.dat` que no está en el padrón. |

## Arquitectura

| Archivo | Rol |
|---|---|
| `catedra_core.py` | Parsing de `.dat`/CSV, motor de calificación, armado del reporte (`build_report`). Sin I/O de salida. |
| `catedra_report.py` | Generadores CSV / XLSX / PDF. |
| `calificar_catedra.py` | CLI: lee la carpeta, orquesta y escribe las 3 salidas. |
| `test_*.py` | Suite pytest (parsers, calificación, secciones, incidencias, writers, end‑to‑end). |

## Tests

```
python -m pytest        # desde tools/concurso-catedra/
```

## Verificación

El resultado se comparó campo por campo contra las 48 páginas del acta oficial
(`calificadodeOtro.pdf`): **253/253 registros idénticos en DNI, apellidos y
nombres, y condición APTO/NO APTO.** Detalle en [`VERIFICACION.md`](VERIFICACION.md).

## Nota sobre datos

Los archivos de entrada y las salidas contienen datos personales (DNI, nombres) y
**no se versionan** en este repo. Solo se guarda el código y la documentación.
