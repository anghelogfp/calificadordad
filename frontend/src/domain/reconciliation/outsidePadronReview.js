import { stripDigits } from '@/utils/helpers'
import { suggestCandidatesForDni } from '@/domain/calification/provisionalMatches'
import { isSameSheet } from '@/domain/calification/dniCorrections'

function emptySummary() {
  return { total: 0, outside: 0, incomplete: 0, confirmed: 0, withViableSuggestion: 0, withoutSuggestion: 0 }
}

/**
 * Fichas (identificadores o respuestas) cuyo DNI no coincide con ningún alumno del padrón,
 * con una pista de solo lectura sobre quién podría ser. No modifica nada: corregir el DNI
 * sigue siendo una decisión humana (edición de la ficha, o confirmación auditada en Resultados).
 *
 * - `outside`: DNI de 8 dígitos que no está en el padrón.
 * - `incomplete`: DNI con 1 a 7 dígitos.
 * Las fichas sin DNI no se incluyen: no hay nada que comparar.
 *
 * @param {object} input
 * @param {object[]} input.rows - Fichas (cada una con id, dni, litho, aula)
 * @param {object[]} input.candidates - Padrón
 * @param {{ litho: string, correctedDni: string, originalDni?: string }[]} [input.corrections] - Correcciones ya confirmadas
 * @returns {{ items: object[], summary: object }}
 */
export function buildOutsidePadronReview({ rows = [], candidates = [], corrections = [] } = {}) {
  const padronDnis = new Set(
    candidates.map((candidate) => stripDigits(candidate.dni)).filter((dni) => dni.length === 8),
  )
  // Sin padrón cargado todo parecería "fuera del padrón": no hay con qué comparar.
  if (padronDnis.size === 0) return { items: [], summary: emptySummary() }

  const dniCounts = new Map()
  rows.forEach((row) => {
    const dni = stripDigits(row.dni)
    if (dni) dniCounts.set(dni, (dniCounts.get(dni) || 0) + 1)
  })
  const correctionByLitho = new Map(corrections.map((item) => [String(item.litho), item]))

  const items = []
  rows.forEach((row) => {
    const dniRead = stripDigits(row.dni)
    if (!dniRead) return
    if (dniRead.length === 8 && padronDnis.has(dniRead)) return

    const confirmed = correctionByLitho.get(String(row.litho))
    const confirmedDni = confirmed && isSameSheet(row, confirmed) ? stripDigits(confirmed.correctedDni) : ''

    const suggestions = suggestCandidatesForDni(dniRead, candidates).map((candidate) => {
      const dni = stripDigits(candidate.dni)
      return {
        dni,
        paterno: candidate.paterno || '',
        materno: candidate.materno || '',
        nombres: candidate.nombres || '',
        // Ese alumno ya tiene su propia ficha: es poco probable que esta sea suya.
        taken: (dniCounts.get(dni) || 0) > 0,
      }
    })

    items.push({
      rowId: row.id,
      litho: row.litho || '',
      aula: row.aula || '',
      dniRead,
      reason: dniRead.length === 8 ? 'outside' : 'incomplete',
      suggestions,
      confirmedDni,
    })
  })

  items.sort((a, b) => String(a.litho).localeCompare(String(b.litho), 'es', { numeric: true }))

  return {
    items,
    summary: {
      total: items.length,
      outside: items.filter((item) => item.reason === 'outside').length,
      incomplete: items.filter((item) => item.reason === 'incomplete').length,
      confirmed: items.filter((item) => item.confirmedDni).length,
      withViableSuggestion: items.filter((item) => !item.confirmedDni && item.suggestions.some((s) => !s.taken)).length,
      withoutSuggestion: items.filter((item) => !item.confirmedDni && item.suggestions.length === 0).length,
    },
  }
}
