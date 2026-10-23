import { stripDigits } from '@/utils/helpers'

/** La hoja es la misma con la que se confirmó si conserva el DNI original (si se conoce). */
export function isSameSheet(row, correction) {
  if (correction.originalDni === undefined) return true
  return stripDigits(row.dni) === stripDigits(correction.originalDni)
}

/**
 * Aplica las correcciones de DNI ya confirmadas: cada hoja corregida pasa a llevar el DNI
 * del alumno confirmado. No modifica las filas originales; devuelve copias marcadas con
 * `dniCorregido` y `dniOriginal` para que el resultado quede identificado.
 *
 * @param {object[]} responsesRows
 * Una corrección solo se aplica si la hoja sigue trayendo el DNI con el que se confirmó
 * (`originalDni`): los números de hoja (litho) se repiten entre exámenes y una corrección
 * vieja no debe reasignar una hoja distinta de otro proceso.
 *
 * @param {{ litho: string, correctedDni: string, originalDni?: string }[]} corrections
 * @returns {{ responsesRows: object[], responsesByDni: Map<string, object[]>, applied: number }}
 */
export function applyDniCorrections(responsesRows, corrections = []) {
  const byLitho = new Map(corrections.map((item) => [String(item.litho), item]))

  let applied = 0
  const corrected = responsesRows.map((row) => {
    const correction = byLitho.get(String(row.litho))
    if (!correction || !isSameSheet(row, correction)) return row
    const dni = stripDigits(correction.correctedDni)
    applied += 1
    return { ...row, dni, dniOriginal: row.dni || '', dniCorregido: true }
  })

  const responsesByDni = new Map()
  corrected.forEach((row) => {
    const dni = stripDigits(row.dni)
    if (!dni) return
    if (!responsesByDni.has(dni)) responsesByDni.set(dni, [])
    responsesByDni.get(dni).push(row)
  })

  return { responsesRows: corrected, responsesByDni, applied }
}
