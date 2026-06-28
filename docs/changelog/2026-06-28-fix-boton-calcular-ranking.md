# Fix: Botón "Calcular ranking general" no funcionaba

## Fecha
2026-06-28

## Síntoma
Al hacer clic en "Calcular ranking general" (modo simulacro general) no pasaba nada:
- Sin toasts de error
- Sin mensajes en consola
- Sin cierre del modal
- Sin resultados visibles
- El botón se veía habilitado y clickeable

## Causa raíz
El botón `type="submit"` estaba **fuera del `<form>`**.

En `CalificationModal.vue`, el `<form>` abría en la línea 82 (cubriendo solo `modal__body`) y cerraba en la línea 459. El `<footer>` con el botón de calcular empezaba en la línea 461, fuera del formulario.

En HTML, un `<button type="submit">` solo dispara el evento `submit` si es **hijo** del `<form>`. Al estar fuera, el navegador lo ignoraba completamente — `runCalification()` nunca se ejecutaba.

## Cambios realizados

### 1. `frontend/src/components/modals/CalificationModal.vue`
- **Línea 82**: Se agregó `novalidate` al `<form>` para que la validación la maneje JS, no el navegador.
- **Línea 485-493**: Se cambió el botón principal de:
  ```diff
  - type="submit"
  + type="button"
  + @click="runCalification"
  ```
  Esto elimina la dependencia de estar dentro del `<form>` y llama directamente a la función de calificación.

## Archivos modificados
- `frontend/src/components/modals/CalificationModal.vue` (2 cambios)
