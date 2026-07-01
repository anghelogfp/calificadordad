import { ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  buildAnswerKeyObservation,
  createAnswerKeyRow,
  useAnswerKeys,
} from '../useAnswerKeys'

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

const HEADER = '123456789012345678901'

function makeAnswers(char = 'A', length = 60) {
  return char.repeat(length)
}

function buildDatLine({ examCode = '2024', folio = '77', indicator = 'A', payload = '' } = {}) {
  return `${HEADER}${examCode}#${folio}${indicator}${payload}`
}

function makeFile(name, text) {
  return {
    name,
    text: async () => text,
  }
}

function makeIdentifierLine({
  litho = '654321',
  tipo = 'P',
  dni = '12345678',
  aula = '101',
  folio = '77',
  indicator = 'A',
} = {}) {
  return buildDatLine({
    folio,
    indicator,
    payload: `${litho}${tipo}${dni}${aula}${makeAnswers('C')}`,
  })
}

function makeResponseLine({
  litho = '654321',
  tipo = 'P',
  answers = makeAnswers('A'),
  folio = '77',
  indicator = 'A',
} = {}) {
  return buildDatLine({
    folio,
    indicator,
    payload: `${litho}${tipo}${answers}`,
  })
}

function makeSubject(archiveRows = []) {
  return useAnswerKeys(ref(archiveRows))
}

beforeEach(() => {
  localStorage.clear()
  vi.clearAllMocks()
})

describe('answer key row helpers', () => {
  it('crea clave general sin área y no exige tipo', () => {
    const row = createAnswerKeyRow({
      area: '',
      tipo: '',
      litho: '654321',
      answers: makeAnswers('A'),
    })

    expect(row).toMatchObject({
      area: '',
      scope: 'general',
      tipo: '',
      observaciones: 'Sin observaciones',
    })
  })

  it('normaliza área y exige tipo para claves por área', () => {
    const row = createAnswerKeyRow({
      area: 'ingenieria',
      tipo: '',
      litho: '654321',
      answers: makeAnswers('A'),
    })

    expect(row.area).toBe('Ingeniería')
    expect(row.scope).toBe('area')
    expect(row.observaciones).toContain('Tipo no informado')
  })

  it('detecta litho y respuestas inválidas', () => {
    const observation = buildAnswerKeyObservation({
      area: 'Ingeniería',
      scope: 'area',
      tipo: 'P',
      litho: '123',
      answers: `${makeAnswers('A', 10)}X${makeAnswers('B', 49)}`,
    })

    expect(observation).toContain('Litho incompleto')
    expect(observation).toContain('Respuestas con marcas no válidas')
  })

  it('detecta respuestas vacías o incompletas', () => {
    expect(buildAnswerKeyObservation({
      area: '',
      scope: 'general',
      litho: '654321',
      answers: '',
    })).toContain('Sin respuestas registradas')

    expect(buildAnswerKeyObservation({
      area: '',
      scope: 'general',
      litho: '654321',
      answers: makeAnswers('A', 59),
    })).toContain('Cadena incompleta')
  })
})

describe('useAnswerKeys imports', () => {
  it('importa una clave general desde archivo de respuestas', async () => {
    const answerKeys = makeSubject()
    const file = makeFile('clave-general.dat', makeResponseLine({
      litho: '111111',
      tipo: 'P',
      answers: makeAnswers('B'),
    }))

    await answerKeys.readGeneralAnswerKeyFile(file)

    expect(answerKeys.rows.value).toHaveLength(1)
    expect(answerKeys.rows.value[0]).toMatchObject({
      area: '',
      scope: 'general',
      tipo: 'P',
      litho: '111111',
      answers: makeAnswers('B'),
      observaciones: 'Sin observaciones',
    })
    expect(answerKeys.sources.value[0]).toMatchObject({
      name: 'clave-general.dat',
      area: 'General',
      scope: 'general',
      validRows: 1,
    })
  })

  it('importa claves por área usando match exacto con identificador', async () => {
    const answerKeys = makeSubject()
    const identificationFile = makeFile('ids.dat', makeIdentifierLine({
      litho: '222222',
      tipo: 'Q',
      folio: '88',
      indicator: 'B',
    }))
    const responsesFile = makeFile('claves.dat', makeResponseLine({
      litho: '222222',
      tipo: 'P',
      folio: '88',
      indicator: 'B',
      answers: makeAnswers('C'),
    }))

    await answerKeys.readAnswerKeyFiles('Ingeniería', identificationFile, responsesFile)

    expect(answerKeys.rows.value).toHaveLength(1)
    expect(answerKeys.rows.value[0]).toMatchObject({
      area: 'Ingeniería',
      scope: 'area',
      tipo: 'Q',
      litho: '222222',
      answers: makeAnswers('C'),
      observaciones: 'Sin observaciones',
    })
    expect(answerKeys.sources.value[0]).toMatchObject({
      name: 'claves.dat',
      identificationName: 'ids.dat',
      area: 'Ingeniería',
      validRows: 1,
      responseErrors: 0,
      identificationErrors: 0,
    })
  })

  it('usa fallback por litho cuando no coincide indicador o folio', async () => {
    const answerKeys = makeSubject()
    const identificationFile = makeFile('ids.dat', makeIdentifierLine({
      litho: '333333',
      tipo: 'R',
      folio: '11',
      indicator: 'A',
    }))
    const responsesFile = makeFile('claves.dat', makeResponseLine({
      litho: '333333',
      tipo: 'P',
      folio: '99',
      indicator: 'Z',
      answers: makeAnswers('D'),
    }))

    await answerKeys.readAnswerKeyFiles('Sociales', identificationFile, responsesFile)

    expect(answerKeys.rows.value[0]).toMatchObject({
      area: 'Sociales',
      tipo: 'R',
      litho: '333333',
      answers: makeAnswers('D'),
      observaciones: 'Sin observaciones',
    })
  })

  it('agrega observación cuando una clave por área no tiene coincidencia en identificador', async () => {
    const answerKeys = makeSubject()
    const identificationFile = makeFile('ids.dat', makeIdentifierLine({
      litho: '444444',
      tipo: 'S',
    }))
    const responsesFile = makeFile('claves.dat', makeResponseLine({
      litho: '555555',
      tipo: 'P',
      answers: makeAnswers('E'),
    }))

    await answerKeys.readAnswerKeyFiles('Biomédicas', identificationFile, responsesFile)

    expect(answerKeys.rows.value[0]).toMatchObject({
      area: 'Biomédicas',
      tipo: '',
      litho: '555555',
      answers: makeAnswers('E'),
    })
    expect(answerKeys.rows.value[0].observaciones).toContain('Tipo no informado')
    expect(answerKeys.rows.value[0].observaciones).toContain('Sin coincidencia en identificador')
  })

  it('expone lookup por área/tipo y fallback por área', async () => {
    const answerKeys = makeSubject()
    answerKeys.rows.value = [
      createAnswerKeyRow({
        area: 'Ingeniería',
        tipo: 'P',
        litho: '111111',
        answers: makeAnswers('A'),
      }),
      createAnswerKeyRow({
        area: 'Ingeniería',
        tipo: '',
        litho: '222222',
        answers: makeAnswers('B'),
      }),
    ]

    expect(answerKeys.answerKeyLookupByAreaTipo.value.get('Ingeniería|P').answers).toBe(makeAnswers('A'))
    expect(answerKeys.answerKeyFallbackByArea.value.get('Ingeniería').answers).toBe(makeAnswers('A'))
  })
})
