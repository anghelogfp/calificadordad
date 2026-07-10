import { describe, expect, it } from 'vitest'
import { calculateAreaResults } from '../calculateResults'
import { validateCalificationResult } from '../validateResults'

function makeAnswers(char, length = 60) {
  return char.repeat(length)
}

function makePlantilla(overrides = {}) {
  return {
    id: 'tpl',
    name: 'Plantilla',
    questionTotal: 60,
    items: [
      {
        subject: 'General',
        questionCount: 60,
        ponderation: 1,
      },
    ],
    ...overrides,
  }
}

function makeInput(overrides = {}) {
  return {
    area: 'Ingeniería',
    plantilla: makePlantilla(),
    correctValue: 10,
    incorrectValue: 0,
    blankValue: 2,
    processType: 'simulacro',
    simulacroScope: 'areas',
    answersLength: 60,
    archiveRows: [
      { dni: '12345678', area: 'Ingeniería', programa: 'Civil', paterno: 'A' },
    ],
    responsesRows: [
      { dni: '12345678', tipo: 'P', answers: makeAnswers('A'), litho: '100001' },
    ],
    answerKeyRows: [
      { area: 'Ingeniería', tipo: 'P', answers: makeAnswers('A') },
    ],
    responsesByDni: new Map([
      ['12345678', [{ dni: '12345678', tipo: 'P', answers: makeAnswers('A'), litho: '100001' }]],
    ]),
    answerKeyLookupByAreaTipo: new Map([
      ['Ingeniería|P', { area: 'Ingeniería', tipo: 'P', answers: makeAnswers('A') }],
    ]),
    answerKeyFallbackByArea: new Map(),
    areaList: ['Biomédicas', 'Sociales', 'Ingeniería'],
    vacantesPrograma: {},
    timestamp: '2026-07-01T12:00:00.000Z',
    ...overrides,
  }
}

describe('calculateAreaResults', () => {
  it('calcula resultados puros sin depender de Vue', () => {
    const result = calculateAreaResults(makeInput())

    expect(result.results).toEqual([
      expect.objectContaining({
        dni: '12345678',
        area: 'INGENIERÍAS',
        score: 600,
        position: 1,
        answersRaw: makeAnswers('A'),
        correctAnswersRaw: makeAnswers('A'),
      }),
    ])
    expect(result.summary).toMatchObject({
      area: 'INGENIERÍAS',
      timestamp: '2026-07-01T12:00:00.000Z',
      totalCandidates: 1,
      totalWeight: 60,
      noCalificados: [],
    })
    expect(validateCalificationResult({ result })).toMatchObject({ valid: true })
  })

  it('no asigna áreas desconocidas a la primera área disponible', () => {
    expect(() => calculateAreaResults(makeInput({
      area: 'Biomédicas',
      archiveRows: [
        { dni: '12345678', area: 'Area Desconocida', programa: 'Civil', paterno: 'A' },
      ],
      answerKeyRows: [
        { area: 'Biomédicas', tipo: 'P', answers: makeAnswers('A') },
      ],
      answerKeyLookupByAreaTipo: new Map([
        ['Biomédicas|P', { area: 'Biomédicas', tipo: 'P', answers: makeAnswers('A') }],
      ]),
    }))).toThrow('No hay postulantes registrados')
  })

  it('desempata por orden alfabético y luego DNI', () => {
    const result = calculateAreaResults(makeInput({
      archiveRows: [
        { dni: '22222222', area: 'Ingeniería', programa: 'Civil', paterno: 'Zeta', materno: 'B', nombres: 'Ana' },
        { dni: '11111111', area: 'Ingeniería', programa: 'Civil', paterno: 'Alfa', materno: 'C', nombres: 'Luis' },
        { dni: '33333333', area: 'Ingeniería', programa: 'Civil', paterno: 'Alfa', materno: 'C', nombres: 'Luis' },
      ],
      responsesRows: [
        { dni: '22222222', tipo: 'P', answers: makeAnswers('A') },
        { dni: '11111111', tipo: 'P', answers: makeAnswers('A') },
        { dni: '33333333', tipo: 'P', answers: makeAnswers('A') },
      ],
      responsesByDni: new Map([
        ['22222222', [{ dni: '22222222', tipo: 'P', answers: makeAnswers('A') }]],
        ['11111111', [{ dni: '11111111', tipo: 'P', answers: makeAnswers('A') }]],
        ['33333333', [{ dni: '33333333', tipo: 'P', answers: makeAnswers('A') }]],
      ]),
    }))

    expect(result.results.map(row => row.dni)).toEqual(['11111111', '33333333', '22222222'])
    expect(result.results.map(row => row.position)).toEqual([1, 2, 3])
  })

  it('en simulacro por áreas prioriza la clave única del área sin tipo', () => {
    const result = calculateAreaResults(makeInput({
      area: 'Sociales',
      archiveRows: [
        { dni: '11111111', area: 'Sociales', paterno: 'A' },
        { dni: '22222222', area: 'Sociales', paterno: 'B' },
      ],
      responsesRows: [
        { dni: '11111111', tipo: 'P', answers: makeAnswers('A') },
        { dni: '22222222', tipo: 'Q', answers: makeAnswers('A') },
      ],
      answerKeyRows: [
        { area: 'Sociales', tipo: '', answers: makeAnswers('A') },
        { area: 'Sociales', tipo: 'P', answers: makeAnswers('B') },
      ],
      responsesByDni: new Map([
        ['11111111', [{ dni: '11111111', tipo: 'P', answers: makeAnswers('A') }]],
        ['22222222', [{ dni: '22222222', tipo: 'Q', answers: makeAnswers('A') }]],
      ]),
      answerKeyLookupByAreaTipo: new Map([
        ['SOCIALES|P', { area: 'Sociales', tipo: 'P', answers: makeAnswers('B') }],
      ]),
      answerKeyFallbackByArea: new Map([
        ['SOCIALES', { area: 'Sociales', tipo: '', answers: makeAnswers('A') }],
      ]),
    }))

    expect(result.results.map(row => row.score)).toEqual([600, 600])
    expect(result.results.every(row => row.correctAnswersRaw === makeAnswers('A'))).toBe(true)
  })

  it('en simulacro por áreas no usa clave general accidentalmente', () => {
    const result = calculateAreaResults(makeInput({
      answerKeyRows: [
        { area: '', tipo: '', answers: makeAnswers('A') },
      ],
      answerKeyLookupByAreaTipo: new Map(),
      answerKeyFallbackByArea: new Map(),
    }))

    expect(result.results).toHaveLength(0)
    expect(result.summary.noCalificados[0]).toMatchObject({
      dni: '12345678',
      motivo: 'Sin clave',
    })
  })

  it('exige exactamente una clave general en simulacro general', () => {
    expect(() => calculateAreaResults(makeInput({
      processType: 'simulacro',
      simulacroScope: 'general',
      archiveRows: [{ dni: '12345678', area: '' }],
      answerKeyRows: [{ area: 'Ingeniería', tipo: 'P', answers: makeAnswers('A') }],
    }))).toThrow('exactamente una clave general')
  })

  it('rechaza plantillas que no cubren todas las preguntas', () => {
    expect(() => calculateAreaResults(makeInput({
      plantilla: makePlantilla({
        items: [{ subject: 'General', questionCount: 59, ponderation: 1 }],
      }),
    }))).toThrow('cubre 59 preguntas')
  })

  it('rechaza claves oficiales con respuestas inválidas', () => {
    expect(() => calculateAreaResults(makeInput({
      answerKeyRows: [
        { area: 'Ingeniería', tipo: 'P', answers: `${makeAnswers('A', 10)}X${makeAnswers('A', 49)}` },
      ],
      answerKeyLookupByAreaTipo: new Map([
        ['Ingeniería|P', { area: 'Ingeniería', tipo: 'P', answers: `${makeAnswers('A', 10)}X${makeAnswers('A', 49)}` }],
      ]),
    }))).toThrow('pregunta 11')
  })

  it('incluye trazabilidad por pregunta y por materia', () => {
    const result = calculateAreaResults(makeInput({
      plantilla: makePlantilla({
        questionTotal: 3,
        items: [
          { subject: 'Matemática', questionCount: 2, ponderation: 2 },
          { subject: 'Verbal', questionCount: 1, ponderation: 1 },
        ],
      }),
      answersLength: 3,
      correctValue: 10,
      incorrectValue: -1,
      blankValue: 2,
      responsesRows: [
        { dni: '12345678', tipo: 'P', answers: 'AB', litho: '100001' },
      ],
      answerKeyRows: [
        { area: 'Ingeniería', tipo: 'P', answers: 'AAC' },
      ],
      responsesByDni: new Map([
        ['12345678', [{ dni: '12345678', tipo: 'P', answers: 'AB', litho: '100001' }]],
      ]),
      answerKeyLookupByAreaTipo: new Map([
        ['Ingeniería|P', { area: 'Ingeniería', tipo: 'P', answers: 'AAC' }],
      ]),
    }))

    expect(result.results[0]).toMatchObject({
      score: 20,
      answersRaw: 'AB ',
      correctAnswersRaw: 'AAC',
      questionDetails: [
        {
          number: 1,
          subject: 'Matemática',
          weight: 2,
          answer: 'A',
          correctAnswer: 'A',
          status: 'correct',
          score: 20,
        },
        {
          number: 2,
          subject: 'Matemática',
          weight: 2,
          answer: 'B',
          correctAnswer: 'A',
          status: 'incorrect',
          score: -2,
        },
        {
          number: 3,
          subject: 'Verbal',
          weight: 1,
          answer: '',
          blankSource: 'assumed-final',
          correctAnswer: 'C',
          status: 'blank',
          score: 2,
        },
      ],
      subjectBreakdown: [
        {
          subject: 'Matemática',
          questions: 2,
          correct: 1,
          incorrect: 1,
          blank: 0,
          score: 18,
          totalWeight: 4,
        },
        {
          subject: 'Verbal',
          questions: 1,
          correct: 0,
          incorrect: 0,
          blank: 1,
          score: 2,
          totalWeight: 1,
        },
      ],
    })
    expect(validateCalificationResult({ result })).toMatchObject({ valid: true })
  })

  it('califica asterisco como marca múltiple con puntaje cero', () => {
    const result = calculateAreaResults(makeInput({
      plantilla: makePlantilla({
        questionTotal: 3,
        items: [
          { subject: 'General', questionCount: 3, ponderation: 1 },
        ],
      }),
      answersLength: 3,
      correctValue: 10,
      incorrectValue: -1,
      blankValue: 2,
      responsesRows: [
        { dni: '12345678', tipo: 'P', answers: 'A* ', litho: '100001' },
      ],
      answerKeyRows: [
        { area: 'Ingeniería', tipo: 'P', answers: 'ABC' },
      ],
      responsesByDni: new Map([
        ['12345678', [{ dni: '12345678', tipo: 'P', answers: 'A* ', litho: '100001' }]],
      ]),
      answerKeyLookupByAreaTipo: new Map([
        ['Ingeniería|P', { area: 'Ingeniería', tipo: 'P', answers: 'ABC' }],
      ]),
    }))

    expect(result.results[0]).toMatchObject({
      score: 12,
      questionDetails: [
        expect.objectContaining({ number: 1, status: 'correct', score: 10 }),
        expect.objectContaining({ number: 2, answer: '*', status: 'multiple', score: 0 }),
        expect.objectContaining({ number: 3, status: 'blank', score: 2 }),
      ],
      subjectBreakdown: [
        expect.objectContaining({
          correct: 1,
          incorrect: 0,
          multiple: 1,
          blank: 1,
          score: 12,
        }),
      ],
    })
    expect(validateCalificationResult({ result })).toMatchObject({ valid: true })
  })

  it('marca ingresantes por programa en proceso real', () => {
    const answerKeyRows = ['P', 'Q', 'R', 'S', 'T'].map((tipo) => ({
      area: 'Ingeniería',
      tipo,
      answers: makeAnswers('A'),
    }))

    const result = calculateAreaResults(makeInput({
      processType: 'real',
      archiveRows: [
        { dni: '11111111', area: 'Ingeniería', programa: 'Civil' },
        { dni: '22222222', area: 'Ingeniería', programa: 'Civil' },
      ],
      responsesRows: [
        { dni: '11111111', tipo: 'P', answers: makeAnswers('A') },
        { dni: '22222222', tipo: 'Q', answers: makeAnswers('B') },
      ],
      answerKeyRows,
      responsesByDni: new Map([
        ['11111111', [{ dni: '11111111', tipo: 'P', answers: makeAnswers('A') }]],
        ['22222222', [{ dni: '22222222', tipo: 'Q', answers: makeAnswers('B') }]],
      ]),
      answerKeyLookupByAreaTipo: new Map(),
      vacantesPrograma: { Civil: 1 },
    }))

    expect(result.results.map((row) => ({
      dni: row.dni,
      position: row.position,
      positionInPrograma: row.positionInPrograma,
      isIngresante: row.isIngresante,
    }))).toEqual([
      { dni: '11111111', position: 1, positionInPrograma: 1, isIngresante: true },
      { dni: '22222222', position: 2, positionInPrograma: 2, isIngresante: false },
    ])
    expect(validateCalificationResult({
      result,
      processType: 'real',
      vacantesPrograma: { Civil: 1 },
    })).toMatchObject({ valid: true })
  })

  it('no marca ingresantes cuando el programa tiene cero vacantes', () => {
    const answerKeyRows = ['P', 'Q', 'R', 'S', 'T'].map((tipo) => ({
      area: 'Ingeniería', tipo, answers: makeAnswers('A'),
    }))

    const result = calculateAreaResults(makeInput({
      processType: 'real',
      archiveRows: [{ dni: '11111111', area: 'Ingeniería', programa: 'Civil' }],
      responsesRows: [{ dni: '11111111', tipo: 'P', answers: makeAnswers('A') }],
      responsesByDni: new Map([
        ['11111111', [{ dni: '11111111', tipo: 'P', answers: makeAnswers('A') }]],
      ]),
      answerKeyRows,
      answerKeyLookupByAreaTipo: new Map(),
      vacantesPrograma: { Civil: 0 },
    }))

    expect(result.results[0]).toMatchObject({ positionInPrograma: 1, isIngresante: false })
    expect(validateCalificationResult({
      result,
      processType: 'real',
      vacantesPrograma: { Civil: 0 },
    })).toMatchObject({ valid: true })
  })

  it('desempata alfabéticamente dentro del ranking por programa en proceso real', () => {
    const answerKeyRows = ['P', 'Q', 'R', 'S', 'T'].map((tipo) => ({
      area: 'Ingeniería',
      tipo,
      answers: makeAnswers('A'),
    }))

    const result = calculateAreaResults(makeInput({
      processType: 'real',
      archiveRows: [
        { dni: '22222222', area: 'Ingeniería', programa: 'Civil', paterno: 'Zeta', materno: '', nombres: 'Ana' },
        { dni: '11111111', area: 'Ingeniería', programa: 'Civil', paterno: 'Alfa', materno: '', nombres: 'Luis' },
      ],
      responsesRows: [
        { dni: '22222222', tipo: 'P', answers: makeAnswers('A') },
        { dni: '11111111', tipo: 'P', answers: makeAnswers('A') },
      ],
      answerKeyRows,
      responsesByDni: new Map([
        ['22222222', [{ dni: '22222222', tipo: 'P', answers: makeAnswers('A') }]],
        ['11111111', [{ dni: '11111111', tipo: 'P', answers: makeAnswers('A') }]],
      ]),
      vacantesPrograma: { Civil: 1 },
    }))

    expect(result.results.map(row => ({ dni: row.dni, positionInPrograma: row.positionInPrograma, isIngresante: row.isIngresante }))).toEqual([
      { dni: '11111111', positionInPrograma: 1, isIngresante: true },
      { dni: '22222222', positionInPrograma: 2, isIngresante: false },
    ])
  })
})
