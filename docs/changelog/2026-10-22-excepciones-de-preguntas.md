# Excepciones de preguntas — 2026-10-22

Permite que la comisión corrija el resultado de una pregunta mal formulada o con la clave equivocada, de forma auditable y sin tocar los archivos originales.

## Qué se puede hacer

| Excepción | Efecto |
|---|---|
| **Anular y dar el punto a todos** (`ANULADA_OTORGAR`) | Todos los postulantes de esa clave reciben el punto de la pregunta (valor de correcta × peso), hayan marcado una letra, la dejaran en blanco o marcaran varias. |
| **Anular y que no cuente para nadie** (`ANULADA_EXCLUIR`) | La pregunta aporta 0 a todos y baja el puntaje máximo posible. **No se reescalan** los demás puntos. |
| **Aceptar varias respuestas** (`CLAVE_MULTIPLE`) | Es correcta cualquiera de las letras indicadas (A a E). Con una sola letra sirve para corregir la clave. La letra original de la clave solo vale si se incluye. Un blanco sigue siendo blanco y `*` sigue siendo múltiple. |

Una pregunta anulada no exige que la clave tenga una letra válida en esa posición.

## Cómo se usa

En Resultados, panel **Excepciones de preguntas**: se elige la clave, el número de pregunta, la acción y el motivo (obligatorio; el documento de sustento es opcional). El panel muestra la materia y el peso de la pregunta y **cómo respondieron los postulantes** (por ejemplo, avisa si casi nadie marcó la clave, señal de que quizá la clave es la equivocada). Antes de guardar explica el efecto y pide confirmar en pantalla. Al registrar o deshacer, el ranking se recalcula.

## Reglas de seguridad

- **Cada excepción se liga al contenido de la clave** (SHA-256). Si en otro examen la clave es distinta, la excepción vieja no se aplica: queda como "sin efecto" y se avisa. Así no se anula por error otra pregunta de otro examen con el mismo número.
- **Alcance por clave.** Una excepción pertenece a un área y un tipo de prueba (P a T en convocatoria real); cada tipo tiene su propia numeración.
- **Ambigüedad = bloqueo.** Dos excepciones para la misma pregunta de la misma clave, o una con datos inválidos, bloquean el cálculo en lugar de aplicarse a medias.
- **Servidor.** Valida contra las claves del usuario y deriva él mismo la huella de la clave; deshacer revoca sin borrar (auditoría).
- **La huella de configuración** (`configSha256`) incluye las excepciones aplicadas.
- **La auditoría del cálculo** comprueba de forma independiente que el puntaje de cada hoja refleja exactamente las excepciones registradas (`EXCEPTION_NOT_REGISTERED`, `EXCEPTION_NOT_APPLIED`, `MAX_SCORE_MISMATCH`, además del recálculo de puntaje).

## Una sola fórmula de puntaje

Antes la clasificación de cada respuesta estaba copiada en 4 sitios (motor, detalle del alumno, exportaciones y verificador). Ahora existe una única función (`domain/calification/scoreAnswerSheet.js`) que usan todos, para que una regla o excepción no pueda aplicarse en un sitio y olvidarse en otro.

Esto corrigió de paso dos inconsistencias que ya existían:

- El detalle del alumno y el verificador mostraban `0.000` en toda respuesta incorrecta aunque el valor de incorrecta fuera negativo, mientras el ranking sí lo restaba.
- El detalle del alumno redondeaba a 2 decimales y el ranking a 3.

## Dónde se ve

- **Ranking y resumen:** `summary.questionExceptions` con cada excepción y su estado; cada hoja trae `exceptionsApplied` y `maxScore`.
- **Detalle del alumno:** las preguntas anuladas se muestran con "ANUL." (o las letras válidas) y un contador "Anuladas".
- **Excel de resultados:** columna "Observación" con las preguntas anuladas de cada hoja, fila de resumen con el total de preguntas anuladas y una hoja "Excepciones de preguntas" con qué se decidió, por qué, con qué documento y si se aplicó. Las columnas de correctas e incorrectas no cuentan las anuladas.
- **Verificador manual:** si la clave tecleada es la de una excepción registrada, la aplica y lo avisa, para reproducir el resultado oficial.
- **Historial y backup:** se guardan el resumen de excepciones y las aplicadas a cada hoja.

## Backend

`QuestionException` (`convocatorias/0014`), `AreaCalificacion.question_exceptions` y `ResultadoCandidato.exceptions_applied` (`resultados/0010`), endpoint `/api/excepciones-pregunta/` (listar, crear, deshacer). Ver `docs/backend.md`.

## Pruebas

- **Frontend (418):** función única con 3000 hojas aleatorias contra la fórmula anterior (sin excepciones el resultado es idéntico), 22 casos de excepciones, clasificación y huella de clave, motor (simulacro general, por áreas y real con varios tipos), auditoría, preflight, composable, panel, detalle del alumno, exportaciones y verificador.
- **Backend (107):** validaciones, huella derivada en el servidor, aislamiento por usuario, deshacer, historial y backup.
- **Con el simulacro real (152 alumnos):** ningún puntaje cambió sin excepciones; con cada tipo de excepción sobre una pregunta, el puntaje de cada alumno coincide con el efecto calculado por separado y la auditoría es válida.

## Decisiones de criterio (revisar con la comisión)

1. **Excluida no reescala.** Si se excluye una pregunta, el máximo baja y los demás puntos valen lo mismo. Si la norma exige reescalar al máximo original, habría que cambiarlo.
2. **Anulada con punto cuenta aparte.** En los conteos del Excel y del detalle, las anuladas no se suman a correctas ni a blancos.
3. **Excepciones por tipo.** En convocatoria real hay que registrarlas para cada tipo de prueba (P, Q, R, S, T) con su propio número de pregunta.

## Límites

- Los PDF de resultados no listan las excepciones.
- El Excel de convocatoria real por programa no trae la columna de observación ni la hoja de excepciones.
