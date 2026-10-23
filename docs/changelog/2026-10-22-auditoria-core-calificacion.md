# Auditoría del core de calificación — 2026-10-22

Revisión del camino cargar → calificar → validar, buscando fallos silenciosos como los que ya se encontraron (alineación de respuestas, espacios, fechas).

## Hallazgos

1. **Hojas con respuestas incompletas pasaban sin aviso.** El motor rellenaba con blancos las respuestas que faltaban al final (y recortaba las que sobraban). El dato `blankSource: 'assumed-final'` se calculaba pero nada lo leía, y la auditoría comparaba el largo después de rellenar, por lo que siempre daba 60. Una hoja con la pregunta 60 perdida (el fallo original) se calificaba sin ninguna señal.
2. **La auditoría no era independiente.** Comprobaba que el detalle por pregunta sumara el puntaje, pero ese detalle sale del mismo código que calcula el puntaje.

## Cambios

- `calculateResults.js`: cada resultado trae `answersReadLength` y `assumedBlankCount`; el resumen trae `sheetsWithAssumedBlanks` y `sheetsTruncated`.
- `validateResults.js`:
  - Avisos (no errores) `ANSWERS_PADDED` y `ANSWERS_TRUNCATED`.
  - Recálculo independiente: para cada hoja recalcula el puntaje y el estado de cada pregunta leyendo directamente las respuestas contra la clave, con los pesos y valores usados. Errores `SCORE_RECOMPUTE_MISMATCH` y `QUESTION_STATUS_MISMATCH`. Se omite si el resumen no trae los valores de calificación.
- `parsers.js` (`auditParsedResponses`): al cargar un archivo avisa de las hojas con menos de 60 respuestas.
- Pantalla de resultados: nueva pestaña "Respuestas incompletas" en el panel de revisión, con hoja, DNI, alumno y "57 de 60 respuestas leídas"; buscable y paginada.

## Pruebas

- 4 pruebas del motor, 5 del recálculo independiente (incluye alterar un puntaje, un estado de pregunta y desplazar las respuestas), 2 del panel y 1 del parser.
- Con el simulacro real (152 calificados): la auditoría sigue válida, sin errores ni avisos, y los 5 archivos de respuestas no generan avisos nuevos.
- Suite: 276 pruebas y `vite build` correctos.

## Límites conocidos

- La pestaña y los conteos nuevos no se guardan en el historial: al abrir un proceso guardado no aparecen (requiere otra migración).
- Los avisos no bloquean el cálculo: una hoja con blancos asumidos se califica igual, pero queda señalada.
