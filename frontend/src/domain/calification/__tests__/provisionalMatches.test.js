import { describe, expect, it } from 'vitest'
import {
  buildProvisionalPreview,
  findOrphanResponses,
  isSingleEditApart,
  suggestCandidatesForDni,
} from '../provisionalMatches'
import { calculateAreaResults } from '../calculateResults'

const KEY = 'A'.repeat(60)

function makeScoreParams() {
  return {
    area: 'Sociales',
    plantilla: {
      id: 'tpl',
      name: 'Plantilla',
      questionTotal: 60,
      items: [{ subject: 'General', questionCount: 60, ponderation: 1 }],
    },
    correctValue: 10,
    incorrectValue: 0,
    blankValue: 2,
    processType: 'simulacro',
    simulacroScope: 'general',
    answersLength: 60,
    answerKeyRows: [{ area: '', tipo: 'P', answers: KEY }],
    answerKeyLookupByAreaTipo: new Map(),
    answerKeyFallbackByArea: new Map(),
    areaList: ['Biomédicas', 'Sociales', 'Ingeniería'],
    vacantesPrograma: {},
  }
}

const candidate = (dni, paterno = 'X') => ({ dni, paterno, materno: 'Y', nombres: 'Z', area: '', programa: '' })
const sheet = (dni, litho, answers = KEY) => ({ dni, litho, tipo: 'P', aula: '101', answers })

describe('isSingleEditApart', () => {
  it('detecta un dígito cambiado, de más, de menos o intercambiado', () => {
    expect(isSingleEditApart('63735500', '63737500')).toBe(true)
    expect(isSingleEditApart('8088022', '81088022')).toBe(true)
    expect(isSingleEditApart('123456789', '12345678')).toBe(true)
    expect(isSingleEditApart('12345687', '12345678')).toBe(true)
  })

  it('rechaza iguales o distintos en más de una edición', () => {
    expect(isSingleEditApart('12345678', '12345678')).toBe(false)
    expect(isSingleEditApart('12345678', '12345699')).toBe(false)
    expect(isSingleEditApart('1234567', '12345890')).toBe(false)
    expect(isSingleEditApart('12345678', '21436587')).toBe(false)
  })
})

describe('suggestCandidatesForDni', () => {
  const padron = [candidate('63737500'), candidate('81088022'), candidate('11111111')]

  it('sugiere los DNI del padrón a una edición de distancia', () => {
    expect(suggestCandidatesForDni('63735500', padron).map(c => c.dni)).toEqual(['63737500'])
    expect(suggestCandidatesForDni('8088022', padron).map(c => c.dni)).toEqual(['81088022'])
  })

  it('no sugiere nada con un DNI muy corto o sin parecido', () => {
    expect(suggestCandidatesForDni('', padron)).toEqual([])
    expect(suggestCandidatesForDni('63735', padron)).toEqual([])
    expect(suggestCandidatesForDni('99999999', padron)).toEqual([])
  })
})

describe('findOrphanResponses', () => {
  it('devuelve solo las hojas cuyo DNI no está en el padrón', () => {
    const padron = [candidate('11111111')]
    const hojas = [sheet('11111111', '1'), sheet('22222222', '2'), sheet('333', '3'), sheet('', '4')]
    expect(findOrphanResponses(hojas, padron).map(h => h.litho)).toEqual(['2', '3', '4'])
  })
})

describe('buildProvisionalPreview', () => {
  const padron = [candidate('63737500', 'SUCAPUCA'), candidate('11111111', 'OFICIAL')]

  it('calcula el puntaje provisional con el motor oficial', () => {
    const orphan = sheet('63735500', '000910', 'A'.repeat(30) + 'B'.repeat(30))
    const { rows, summary } = buildProvisionalPreview({
      archiveRows: padron,
      responsesRows: [orphan, sheet('11111111', '000001')],
      scoreParams: makeScoreParams(),
      officialScores: [600, 300],
    })

    expect(summary).toEqual({ orphanSheets: 1, withViableSuggestion: 1, onlyBlockedSuggestions: 0, withoutSuggestion: 0 })
    const [row] = rows
    expect(row).toMatchObject({ litho: '000910', dniRead: '63735500', reason: 'not-in-padron' })
    const [suggestion] = row.suggestions
    expect(suggestion).toMatchObject({ dni: '63737500', status: 'ok', provisionalScore: 300, wouldRank: 2 })

    const official = calculateAreaResults({
      ...makeScoreParams(),
      archiveRows: [candidate('63737500')],
      responsesRows: [{ ...orphan, dni: '63737500' }],
      responsesByDni: new Map([['63737500', [{ ...orphan, dni: '63737500' }]]]),
    })
    expect(suggestion.provisionalScore).toBe(official.results[0].score)
  })

  it('marca como incompleta una hoja con DNI de 7 dígitos', () => {
    const { rows } = buildProvisionalPreview({
      archiveRows: [candidate('81088022')],
      responsesRows: [sheet('8088022', '000950')],
      scoreParams: makeScoreParams(),
    })
    expect(rows[0].reason).toBe('incomplete')
    expect(rows[0].suggestions[0]).toMatchObject({ dni: '81088022', status: 'ok' })
  })

  it('bloquea la sugerencia si ese alumno ya tiene su propia hoja', () => {
    const { rows, summary } = buildProvisionalPreview({
      archiveRows: padron,
      responsesRows: [sheet('63735500', '000910'), sheet('63737500', '000005')],
      scoreParams: makeScoreParams(),
    })
    expect(rows[0].suggestions[0]).toMatchObject({ status: 'blocked-has-sheet', provisionalScore: null })
    expect(summary).toMatchObject({ withViableSuggestion: 0, onlyBlockedSuggestions: 1 })
  })

  it('marca conflicto si dos hojas sugieren al mismo alumno', () => {
    const { rows } = buildProvisionalPreview({
      archiveRows: padron,
      responsesRows: [sheet('63735500', '000910'), sheet('63737400', '000911')],
      scoreParams: makeScoreParams(),
    })
    expect(rows.map(r => r.suggestions[0].status)).toEqual(['conflict', 'conflict'])
    expect(rows[0].suggestions[0].conflictWith).toEqual(['000911'])
  })

  it('una hoja sin sugerencia queda listada sin puntaje', () => {
    const { rows, summary } = buildProvisionalPreview({
      archiveRows: padron,
      responsesRows: [sheet('99999999', '000999')],
      scoreParams: makeScoreParams(),
    })
    expect(rows[0].suggestions).toEqual([])
    expect(summary.withoutSuggestion).toBe(1)
  })

  it('no modifica el padrón ni las hojas de entrada', () => {
    const archive = [candidate('63737500')]
    const responses = [sheet('63735500', '000910')]
    const before = JSON.stringify({ archive, responses })
    buildProvisionalPreview({ archiveRows: archive, responsesRows: responses, scoreParams: makeScoreParams() })
    expect(JSON.stringify({ archive, responses })).toBe(before)
  })

  it('reporta el error del motor en lugar de romper la vista previa', () => {
    const { rows } = buildProvisionalPreview({
      archiveRows: padron,
      responsesRows: [sheet('63735500', '000910')],
      scoreParams: makeScoreParams(),
      calculate: () => { throw new Error('clave inválida') },
    })
    expect(rows[0].suggestions[0]).toMatchObject({ status: 'not-scored', error: 'clave inválida' })
  })
})
