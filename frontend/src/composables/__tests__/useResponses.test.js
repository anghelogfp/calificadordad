import { computed, ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useResponses } from '../useResponses'

vi.mock('@/utils/apiFetch', () => ({
  apiFetch: vi.fn(),
}))

vi.mock('exceljs', () => ({
  default: {
    Workbook: vi.fn(),
  },
}))

vi.mock('file-saver', () => ({
  saveAs: vi.fn(),
}))

vi.mock('jspdf', () => ({
  default: vi.fn(),
}))

vi.mock('jspdf-autotable', () => ({
  default: vi.fn(),
}))

function makeAnswers(char = 'A', length = 60) {
  return char.repeat(length)
}

function makeSubject({ identifiers = [] } = {}) {
  const identifierRows = ref(identifiers)
  const identifierLookup = computed(() => {
    const map = new Map()
    identifierRows.value.forEach((row) => {
      const litho = String(row.litho || '').replace(/\D/g, '')
      const indicator = String(row.indicator || '').trim().toUpperCase()
      const folio = String(row.folio || '').trim()
      map.set(`${litho}|${indicator}|${folio}`, row)
    })
    return map
  })
  const identifierLookupByLitho = computed(() => {
    const map = new Map()
    identifierRows.value.forEach((row) => {
      const litho = String(row.litho || '').replace(/\D/g, '')
      if (litho && !map.has(litho)) map.set(litho, row)
    })
    return map
  })

  return useResponses(identifierLookup, identifierLookupByLitho)
}

beforeEach(() => {
  localStorage.clear()
  vi.clearAllMocks()
})

describe('useResponses.applyIdentifierDataToResponseRow', () => {
  it('vincula por match exacto litho, indicador y folio', () => {
    const responses = makeSubject({
      identifiers: [
        {
          litho: '654321',
          indicator: 'A',
          folio: '77',
          dni: '12345678',
          tipo: 'P',
          aula: '101',
        },
      ],
    })
    const row = {
      litho: '654321',
      indicator: 'A',
      folio: '77',
      dni: '',
      tipo: '',
      aula: '',
      answers: makeAnswers('A'),
      observaciones: 'DNI no vinculado',
    }

    responses.applyIdentifierDataToResponseRow(row)

    expect(row).toMatchObject({
      dni: '12345678',
      tipo: 'P',
      aula: '101',
      observaciones: 'Sin observaciones',
    })
  })

  it('prefiere match exacto sobre fallback por litho', () => {
    const responses = makeSubject({
      identifiers: [
        {
          litho: '654321',
          indicator: 'B',
          folio: '88',
          dni: '99999999',
          tipo: 'Q',
          aula: '999',
        },
        {
          litho: '654321',
          indicator: 'A',
          folio: '77',
          dni: '12345678',
          tipo: 'P',
          aula: '101',
        },
      ],
    })
    const row = {
      litho: '654321',
      indicator: 'A',
      folio: '77',
      answers: makeAnswers('A'),
    }

    responses.applyIdentifierDataToResponseRow(row)

    expect(row).toMatchObject({
      dni: '12345678',
      tipo: 'P',
      aula: '101',
      observaciones: 'Sin observaciones',
    })
  })

  it('usa fallback por litho cuando no hay match exacto', () => {
    const responses = makeSubject({
      identifiers: [
        {
          litho: '654321',
          indicator: 'B',
          folio: '88',
          dni: '87654321',
          tipo: 'Q',
          aula: '202',
        },
      ],
    })
    const row = {
      litho: '654321',
      indicator: 'A',
      folio: '77',
      dni: '',
      tipo: '',
      aula: '',
      answers: makeAnswers('B'),
    }

    responses.applyIdentifierDataToResponseRow(row)

    expect(row).toMatchObject({
      dni: '87654321',
      tipo: 'Q',
      aula: '202',
      observaciones: 'Sin observaciones',
    })
  })

  it('normaliza DNI y tipo cuando no encuentra identificador', () => {
    const responses = makeSubject({ identifiers: [] })
    const row = {
      litho: '654321',
      indicator: 'A',
      folio: '77',
      dni: 'DNI 12345678',
      tipo: ' p-extra',
      answers: makeAnswers('A'),
      observaciones: '',
    }

    responses.applyIdentifierDataToResponseRow(row)

    expect(row).toMatchObject({
      dni: '12345678',
      tipo: 'P',
      observaciones: 'Sin observaciones',
    })
  })

  it('mantiene observaciones cuando la respuesta queda sin vínculo útil', () => {
    const responses = makeSubject({ identifiers: [] })
    const row = {
      litho: '123',
      indicator: 'A',
      folio: '77',
      dni: '',
      tipo: '',
      answers: '',
      observaciones: 'Sin observaciones',
    }

    responses.applyIdentifierDataToResponseRow(row)

    expect(row).toMatchObject({
      dni: '',
      tipo: '',
    })
    expect(row.observaciones).toContain('DNI no vinculado')
    expect(row.observaciones).toContain('Tipo no vinculado')
    expect(row.observaciones).toContain('Litho incompleto')
    expect(row.observaciones).toContain('Sin respuestas marcadas')
  })
})

describe('useResponses.responsesByDni', () => {
  it('agrupa respuestas por DNI normalizado e ignora filas sin DNI', () => {
    const responses = makeSubject()
    responses.rows.value = [
      { id: '1', dni: 'DNI 12345678', answers: makeAnswers('A') },
      { id: '2', dni: '12345678', answers: makeAnswers('B') },
      { id: '3', dni: '', answers: makeAnswers('C') },
    ]

    expect(responses.responsesByDni.value.get('12345678')).toHaveLength(2)
    expect(responses.responsesByDni.value.has('')).toBe(false)
  })
})
