import { normalizeArea, stripDigits } from './helpers'

export const REAL_TEST_TYPES = ['P', 'Q', 'R', 'S', 'T']
export const GENERAL_SIMULACRO_AREA = 'General'

export function buildDniCounts(rows) {
  const counts = new Map()
  rows.forEach((row) => {
    const dni = stripDigits(row.dni)
    if (!dni) return
    counts.set(dni, (counts.get(dni) || 0) + 1)
  })
  return counts
}

export function getCandidateDniIssue(candidate, dniCounts) {
  const dni = stripDigits(candidate.dni)
  if (!dni) return 'DNI vacío'
  if (dni.length !== 8) return `DNI incompleto (${dni.length}/8)`
  if ((dniCounts.get(dni) || 0) > 1) return 'DNI duplicado'
  return ''
}

export function getExactAnswerKey(rows, area, tipo, areaList) {
  const normalizedArea = normalizeArea(area, areaList)
  const normalizedTipo = (tipo || '').trim().toUpperCase().slice(0, 1)
  if (!normalizedTipo) return undefined
  return rows.find(
    (row) =>
      row.area?.trim() &&
      normalizeArea(row.area, areaList) === normalizedArea &&
      (row.tipo || '').trim().toUpperCase().slice(0, 1) === normalizedTipo
  )
}