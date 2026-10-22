import { stripDigits } from '@/utils/helpers'

/**
 * Aplica las correcciones de DNI ya confirmadas: cada hoja corregida pasa a llevar el DNI
 * del alumno confirmado. No modifica las filas originales; devuelve copias marcadas con
 * `dniCorregido` y `dniOriginal` para que el resultado quede identificado.
 *
 * @param {object[]} responsesRows
 * @param {{ litho: string, correctedDni: string }[]} corrections
 * @returns {{ responsesRows: object[], responsesByDni: Map<string, object[]>, applied: number }}
 */
export function applyDniCorrections(responsesRows, corrections = []) {
  const byLitho = new Map(
    corrections.map((item) => [String(item.litho), stripDigits(item.correctedDni)]),
  )

  let applied = 0
  const corrected = responsesRows.map((row) => {
    const dni = byLitho.get(String(row.litho))
    if (!dni) return row
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
