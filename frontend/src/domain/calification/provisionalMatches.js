import { stripDigits } from '@/utils/helpers'
import { findOrphanResponses } from '@/utils/calificationHelpers'
import { calculateAreaResults } from './calculateResults'

export { findOrphanResponses }

const MIN_READ_LENGTH = 6

/**
 * True si `a` y `b` difieren en exactamente una edición: un dígito cambiado,
 * uno de más o de menos, o dos dígitos contiguos intercambiados.
 */
export function isSingleEditApart(a, b) {
  if (a === b) return false
  const lengthDiff = Math.abs(a.length - b.length)
  if (lengthDiff > 1) return false

  if (lengthDiff === 0) {
    const diffs = []
    for (let i = 0; i < a.length; i += 1) {
      if (a[i] !== b[i]) diffs.push(i)
      if (diffs.length > 2) return false
    }
    if (diffs.length === 1) return true
    return diffs.length === 2
      && diffs[1] === diffs[0] + 1
      && a[diffs[0]] === b[diffs[1]]
      && a[diffs[1]] === b[diffs[0]]
  }

  const [short, long] = a.length < b.length ? [a, b] : [b, a]
  let i = 0
  while (i < short.length && short[i] === long[i]) i += 1
  return short.slice(i) === long.slice(i + 1)
}

/** Postulantes del padrón cuyo DNI se parece (una edición) al DNI leído de la hoja. */
export function suggestCandidatesForDni(dniRead, candidates) {
  const read = stripDigits(dniRead)
  if (read.length < MIN_READ_LENGTH) return []
  return candidates.filter((candidate) => {
    const dni = stripDigits(candidate.dni)
    return dni.length === 8 && isSingleEditApart(read, dni)
  })
}

function rankAmong(officialScores, score) {
  return officialScores.filter((value) => Number(value) > score).length + 1
}

/**
 * Qué puntaje tendría cada hoja huérfana si el alumno sugerido fuera su dueño.
 *
 * Es una vista previa: no modifica filas, resultados ni la base. El puntaje sale del
 * mismo motor oficial (`calculate`), con los mismos parámetros de la calificación.
 *
 * @param {object} input
 * @param {object[]} input.archiveRows - Padrón
 * @param {object[]} input.responsesRows - Hojas de respuestas cargadas
 * @param {object} input.scoreParams - Parámetros de calculateAreaResults sin archiveRows/responsesRows/responsesByDni
 * @param {number[]} [input.officialScores] - Puntajes ya calificados, para estimar la posición
 * @param {{ litho: string, correctedDni: string }[]} [input.confirmedCorrections] - Correcciones ya confirmadas.
 *   Siguen fuera del ranking oficial: se muestran aparte con estado 'confirmed'.
 * @param {Function} [input.calculate]
 */
export function buildProvisionalPreview({
  archiveRows,
  responsesRows,
  scoreParams,
  officialScores = [],
  confirmedCorrections = [],
  calculate = calculateAreaResults,
}) {
  const orphans = findOrphanResponses(responsesRows, archiveRows)
  const dnisWithSheet = new Set(
    responsesRows.map((response) => stripDigits(response.dni)).filter((dni) => dni.length === 8),
  )

  const confirmedByLitho = new Map(
    confirmedCorrections.map((item) => [String(item.litho), stripDigits(item.correctedDni)]),
  )

  // Alumnos ya asignados a una hoja por una corrección confirmada.
  const assignedElsewhere = new Set(confirmedByLitho.values())

  const rows = orphans.map((response) => {
    const dniRead = stripDigits(response.dni)
    const confirmedDni = confirmedByLitho.get(String(response.litho))
    const candidatesForSheet = confirmedDni
      ? archiveRows.filter((candidate) => stripDigits(candidate.dni) === confirmedDni)
      : suggestCandidatesForDni(dniRead, archiveRows)

    const suggestions = candidatesForSheet.map((candidate) => {
      const dni = stripDigits(candidate.dni)
      const suggestion = {
        dni,
        paterno: candidate.paterno || '',
        materno: candidate.materno || '',
        nombres: candidate.nombres || '',
        programa: candidate.programa || '',
        status: 'ok',
        provisionalScore: null,
        wouldRank: null,
        error: '',
      }

      if (dnisWithSheet.has(dni)) {
        suggestion.status = 'blocked-has-sheet'
        return suggestion
      }
      if (!confirmedDni && assignedElsewhere.has(dni)) {
        suggestion.status = 'blocked-confirmed'
        return suggestion
      }

      try {
        const linked = { ...response, dni }
        const { results } = calculate({
          ...scoreParams,
          archiveRows: [candidate],
          responsesRows: [linked],
          responsesByDni: new Map([[dni, [linked]]]),
        })
        const score = results[0]?.score
        if (Number.isFinite(score)) {
          suggestion.provisionalScore = score
          suggestion.wouldRank = rankAmong(officialScores, score)
          if (confirmedDni) suggestion.status = 'confirmed'
        } else {
          suggestion.status = 'not-scored'
        }
      } catch (error) {
        suggestion.status = 'not-scored'
        suggestion.error = error?.message || String(error)
      }
      return suggestion
    })

    return {
      litho: response.litho || '',
      aula: response.aula || '',
      dniRead,
      reason: dniRead.length === 8 ? 'not-in-padron' : 'incomplete',
      answersRaw: response.answers || '',
      suggestions,
    }
  })

  // Un mismo alumno sugerido para dos hojas distintas no puede ser dueño de ambas.
  const claimedBy = new Map()
  rows.forEach((row) => {
    row.suggestions.forEach((suggestion) => {
      if (!claimedBy.has(suggestion.dni)) claimedBy.set(suggestion.dni, [])
      claimedBy.get(suggestion.dni).push(row.litho)
    })
  })
  rows.forEach((row) => {
    row.suggestions.forEach((suggestion) => {
      const others = claimedBy.get(suggestion.dni).filter((litho) => litho !== row.litho)
      if (others.length && suggestion.status === 'ok') {
        suggestion.status = 'conflict'
        suggestion.conflictWith = others
      }
    })
  })

  return {
    rows,
    summary: {
      orphanSheets: rows.length,
      confirmed: rows.filter((row) => row.suggestions.some((s) => s.status === 'confirmed')).length,
      withViableSuggestion: rows.filter((row) => row.suggestions.some((s) => s.status === 'ok')).length,
      onlyBlockedSuggestions: rows.filter((row) => row.suggestions.length > 0
        && row.suggestions.every((s) => s.status !== 'ok')).length,
      withoutSuggestion: rows.filter((row) => row.suggestions.length === 0).length,
    },
  }
}
