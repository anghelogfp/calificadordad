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

const HEADER = '123456789012345678901'

function buildDatLine({ examCode = '2024', folio = '77', indicator = 'A', payload = '' } = {}) {
  return `${HEADER}${examCode}#${folio}${indicator}${payload}`
}

function makeFile(name, text) {
  return {
    name,
    text: async () => text,
  }
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
      if (!litho) return
      if (map.has(litho)) map.set(litho, null)
      else map.set(litho, row)
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

  it('no usa fallback por litho cuando el litho es ambiguo', () => {
    const responses = makeSubject({
      identifiers: [
        { litho: '654321', indicator: 'B', folio: '88', dni: '87654321', tipo: 'Q', aula: '202' },
        { litho: '654321', indicator: 'C', folio: '99', dni: '99999999', tipo: 'R', aula: '303' },
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

    expect(row.dni).toBe('')
    expect(row.tipo).toBe('')
    expect(row.observaciones).toContain('Litho ambiguo en identificadores')
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

describe('useResponses.readResponseFiles', () => {
  it('importa respuestas sin tipo usando el tipo del identificador y offset 6', async () => {
    const answers = 'ABCDE'.repeat(12)
    const responses = makeSubject({
      identifiers: [
        {
          litho: '076279',
          indicator: 'A',
          folio: '77',
          dni: '72583820',
          tipo: 'P',
          aula: '101',
        },
      ],
    })
    const file = makeFile('resp101.dat', buildDatLine({
      payload: `076279${answers}`,
    }))

    await responses.readResponseFiles([file])

    expect(responses.rows.value).toHaveLength(1)
    expect(responses.rows.value[0]).toMatchObject({
      dni: '72583820',
      tipo: 'P',
      litho: '076279',
      answers,
      detectedAnswersOffset: 6,
      tipoSource: 'identifier',
      observaciones: 'Sin observaciones',
    })
  })
})

describe('useResponses.observationSummary', () => {
  it('agrupa blancos finales asumidos sin perder el total de posiciones', () => {
    const responses = makeSubject()
    responses.rows.value = [
      { id: '1', observaciones: 'Blancos finales asumidos (5)' },
      { id: '2', observaciones: 'Blancos finales asumidos (2)' },
      { id: '3', observaciones: 'Tipo no vinculado' },
    ]

    expect(responses.observationSummary.value).toEqual(expect.arrayContaining([
      { label: 'Blancos finales asumidos (7 posiciones)', count: 2, informational: true },
      { label: 'Tipo no vinculado', count: 1, informational: false },
    ]))
  })

  it('no trata blancos finales asumidos como observacion accionable', () => {
    const responses = makeSubject()
    responses.rows.value = [
      { id: '1', observaciones: 'Blancos finales asumidos (5)' },
      { id: '2', observaciones: 'Tipo no vinculado' },
      { id: '3', observaciones: 'Sin observaciones' },
    ]

    expect(responses.observationCount.value).toBe(2)
    expect(responses.actionableObservationCount.value).toBe(1)
    expect(responses.observationByRowId.value.has('1')).toBe(false)
    expect(responses.observationByRowId.value.has('2')).toBe(true)
  })
})
