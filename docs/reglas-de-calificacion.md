# Reglas De Calificacion

Referencia de como se califica una hoja y que controles protegen el resultado. Es la fuente a consultar ante un reclamo o una duda de puntaje. El codigo vive en `frontend/src/domain/calification/`; este documento describe el comportamiento, no reemplaza a las pruebas.

## 1. Puntaje de una hoja

Una unica funcion calcula el puntaje por pregunta: `scoreAnswerSheet` (`domain/calification/scoreAnswerSheet.js`). La usan el motor de calificacion, el detalle del alumno, las exportaciones y el verificador manual. Ningun componente calcula puntajes por su cuenta.

Por cada pregunta:

| Situacion | Puntos |
|---|---|
| Marca igual a la clave | `valor de correcta × peso` |
| Otra letra A-E | `valor de incorrecta × peso` |
| `*` (marca multiple) | `0` siempre |
| Blanco (espacio) | `valor de blanco × peso` |

- El peso de cada pregunta sale de la plantilla de ponderacion (materia y peso por pregunta). La suma de preguntas de la plantilla debe coincidir con la longitud de la clave.
- Valores oficiales de admision en uso: correcta `10`, incorrecta `0`, blanco `2`. Se configuran en el modal de calificacion.
- El puntaje por pregunta se redondea a 3 decimales y el total tambien. No se reescala nada.
- Si la clave oficial tiene una letra invalida en una pregunta sin excepcion, el calculo se detiene con el error `La clave oficial contiene una respuesta invalida en la pregunta N`.

### Respuestas con longitud distinta de la esperada

- Menos respuestas: las que faltan al final se cuentan como blancos (`blankSource: assumed-final`). La hoja se califica, pero se senala en la pestana "Respuestas incompletas" y con la advertencia `ANSWERS_PADDED`.
- Mas respuestas: se descarta el excedente y se registra `ANSWERS_TRUNCATED`.
- Cada resultado trae `answersReadLength` y `assumedBlankCount`; el resumen trae `sheetsWithAssumedBlanks` y `sheetsTruncated`.

## 2. Lectura de los archivos `.dat`

Cada linea es de ancho fijo: encabezado numerico de 21 caracteres, codigo de examen, folio, indicador, y luego `litho(6)`, `tipo(1)`, y las 60 respuestas.

- La posicion de las respuestas la decide la columna tipo: una letra `P` a `T` indica que la columna existe; una letra `A` a `E` o `*` indica que no existe; un espacio (tipo sin marcar) se resuelve con la disposicion del resto del archivo. Un blanco al inicio o al final de la hoja nunca cambia la posicion de las preguntas.
- Cada espacio es una pregunta en blanco. Por eso las respuestas **nunca se recortan** en ningun punto (parser, API, base de datos, backup).
- El byte `0x1A` de fin de archivo que escribe ScanTools se descarta al leer el texto. El hash SHA-256 del archivo se calcula sobre los bytes originales, no sobre el texto.
- Al cargar un archivo se audita: disposiciones de columna tipo mezcladas, caracteres que no son respuestas, hojas con mas o menos de 60 respuestas. Despues de guardar se relee lo guardado y se compara con lo cargado.

## 3. Vinculo hoja - alumno

La hoja se une con el alumno del padron por **DNI**. El DNI de la hoja viene del archivo de identificadores y se une con las respuestas por `litho`.

Una hoja cuyo DNI no esta en el padron (mal marcado o incompleto) **no se califica** y queda en "Hojas sin alumno". Un alumno del padron sin hoja queda en "Alumnos sin hoja" (no calificado).

### Correcciones de DNI

Permiten atribuir una hoja sin alumno a un alumno del padron, de forma auditada.

- El sistema sugiere alumnos cuyo DNI difiere en una sola edicion (un digito cambiado, de mas, de menos o dos contiguos intercambiados). Una sugerencia **no confirma** quien es el alumno: la decision es humana (hoja fisica o colegio).
- Solo se puede confirmar una sugerencia viable: el alumno sugerido no debe tener ya su propia hoja ni estar asignado a otra, y la hoja no debe tener ya un alumno valido.
- Antes de confirmar se muestra el puntaje provisional y la posicion que tendria. Al confirmar, la hoja **entra al ranking oficial** marcada como "DNI corregido"; el ranking se recalcula.
- Una correccion solo se aplica si la hoja sigue trayendo el DNI con el que se confirmo: los numeros de hoja (litho) se repiten entre examenes y una correccion vieja no debe reasignar otra hoja.
- Deshacer revoca la correccion (queda registrada) y el alumno sale del ranking.
- Cambia la huella de configuracion (ver seccion 6) y se guarda en el historial, el backup y las exportaciones.

## 4. Excepciones de preguntas

Decisiones de la comision sobre una pregunta de una clave. Se registran en Resultados, con motivo obligatorio y documento de sustento opcional.

| Excepcion | Efecto |
|---|---|
| `ANULADA_OTORGAR` | Todos reciben `valor de correcta × peso` por esa pregunta, hayan marcado una letra, la dejaran en blanco o marcaran varias. |
| `ANULADA_EXCLUIR` | La pregunta aporta 0 a todos y se descuenta del puntaje maximo posible. **No se reescalan** los demas puntos. |
| `CLAVE_MULTIPLE` | Es correcta cualquiera de las letras indicadas (A-E). La letra original solo vale si se incluye. Blanco sigue siendo blanco y `*` sigue siendo multiple. |

Reglas:

- Una pregunta anulada no exige que la clave tenga una letra valida en esa posicion.
- Cada excepcion pertenece a una **clave** (area + tipo de prueba) y se **liga al contenido de esa clave** (SHA-256). Si la clave cambia, la excepcion queda "sin efecto" y se avisa; no se aplica a otra pregunta por casualidad.
- En convocatoria real cada tipo (P, Q, R, S, T) tiene su propia numeracion: hay que registrar la excepcion para cada tipo.
- Dos excepciones para la misma pregunta de la misma clave, o una con datos invalidos, **bloquean** el calculo.
- Las anuladas no se suman a correctas ni a blancos en los conteos del Excel y del detalle del alumno.
- Deshacer revoca (no borra). El resumen del calculo y cada hoja guardan que excepciones se aplicaron.

## 5. Ranking

- Se ordena por puntaje descendente y, a igual puntaje, por apellidos y nombres. Las posiciones son siempre secuenciales (no hay posiciones compartidas).
- Convocatoria real: se ordena ademas por programa y se marcan ingresantes hasta cubrir las vacantes del programa. `0` vacantes significa que el programa no tiene cupos.
- **Pendiente de decision institucional:** empates, empate en el corte de vacantes y regla de desempate (ver `docs/integracion-ramas.md`).

## 6. Controles antes y despues de calcular

### Antes (preflight, `preflight.js`)

Bloquean el calculo (error): sin postulantes, sin claves, area desconocida, clave general no unica, claves duplicadas para un area y tipo, excepciones de pregunta invalidas.
Avisan (advertencia): DNI observado en el padron, alumnos sin respuesta, respuestas duplicadas, respuestas sin postulante, respuestas sin DNI, tipo invalido o faltante, programa faltante, excepciones sin efecto.

### Despues (auditoria, `validateResults.js`)

Un resultado que no pasa la auditoria **no se acepta**. Comprueba, entre otras cosas:

- Que el detalle por pregunta y por materia sume el puntaje.
- **Recalculo independiente (`SCORE_RECOMPUTE_MISMATCH`, `QUESTION_STATUS_MISMATCH`, `MAX_SCORE_MISMATCH`):** vuelve a calcular el puntaje y el estado de cada pregunta leyendo directamente las respuestas contra la clave, sin reutilizar el codigo del motor.
- **Excepciones (`EXCEPTION_NOT_REGISTERED`, `EXCEPTION_NOT_APPLIED`):** que cada hoja aplico exactamente las excepciones registradas para su clave.
- Posiciones secuenciales, ningun DNI a la vez calificado y no calificado, total de candidatos coherente, e ingresantes dentro del cupo en convocatoria real.
- Advertencias (no bloquean): `ANSWERS_PADDED`, `ANSWERS_TRUNCATED`, `INGRESANTES_IN_SIMULACRO`.

## 7. Trazabilidad (SHA-256)

- **Cada archivo cargado** (identificadores, respuestas, claves) guarda su `sha256` y tamano, calculados sobre los bytes originales. Coincide con `shasum -a 256 archivo.dat` (macOS/Linux) o `Get-FileHash archivo.dat` (Windows).
- **Cada resultado** guarda dos huellas:
  - `configSha256`: tipo de proceso, valores de calificacion, plantilla (con su orden), claves del area calculada, correcciones de DNI y excepciones de pregunta aplicadas.
  - `dataSha256`: padron y hojas de respuestas tal como se cargaron.
- Las huellas no dependen del orden de carga. Cambiar una letra de la clave, un peso, un valor, un blanco de una hoja, confirmar una correccion o registrar una excepcion las cambia.
- Se ven en Resultados ("Detalles tecnicos del calculo"), en el Excel de resumen, en las listas de archivos cargados, en el historial y en el backup.
- Los resultados guardados antes de que existieran las huellas muestran "No disponible".
- El padron no guarda la huella del archivo Excel (no tiene tabla de fuentes); su contenido queda cubierto por `dataSha256`.

## 8. Decisiones de criterio vigentes

Estas decisiones las tomo el desarrollo con un criterio razonable y conviene validarlas con la comision:

1. Una pregunta excluida baja el maximo y **no reescala** los demas puntos.
2. Marca multiple (`*`) vale 0, igual que un error.
3. Las posiciones del ranking son siempre distintas (sin empates compartidos).
4. En convocatoria real, una excepcion de pregunta se registra por tipo de prueba.
