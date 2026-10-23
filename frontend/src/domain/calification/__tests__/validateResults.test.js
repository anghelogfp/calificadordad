import { describe, expect, it } from 'vitest'
import { validateCalificationResult } from '../validateResults'
import { calculateAreaResults } from '../calculateResults'
import { keyFingerprint } from '../questionExceptions'

function makeAnswers(char, length = 60) {
  return char.repeat(length)
}

function makeResult(overrides = {}) {
  return {
    results: [
      {
        dni: '11111111',
        score: 600,
        position: 1,
        positionInPrograma: 1,
        isIngresante: false,
        programa: 'Civil',
        answersRaw: makeAnswers('A'),
        correctAnswersRaw: makeAnswers('A'),
      },
      {
        dni: '22222222',
        score: 300,
        position: 2,
        positionInPrograma: 2,
        isIngresante: false,
        programa: 'Civil',
        answersRaw: makeAnswers('B'),
        correctAnswersRaw: makeAnswers('A'),
      },
    ],
    summary: {
      answersLength: 60,
      totalCandidates: 2,
      noCalificados: [],
    },
    ...overrides,
  }
}

describe('validateCalificationResult', () => {
  it('acepta un resultado consistente', () => {
    const validation = validateCalificationResult({
      result: makeResult(),
      processType: 'simulacro',
    })

    expect(validation).toEqual({
      valid: true,
      errors: [],
      warnings: [],
    })
  })

  it('detecta puntajes, longitudes y posiciones inválidas', () => {
    const validation = validateCalificationResult({
      result: makeResult({
        results: [
          {
            dni: '11111111',
            score: Number.NaN,
            position: 1,
            answersRaw: makeAnswers('A', 59),
            correctAnswersRaw: makeAnswers('A'),
          },
          {
            dni: '22222222',
            score: 10,
            position: 3,
            answersRaw: makeAnswers('B'),
            correctAnswersRaw: makeAnswers('A', 61),
          },
        ],
        summary: {
          answersLength: 60,
          totalCandidates: 2,
          noCalificados: [],
        },
      }),
    })

    expect(validation.valid).toBe(false)
    expect(validation.errors.map((error) => error.code)).toEqual(expect.arrayContaining([
      'SCORE_INVALID',
      'ANSWERS_RAW_LENGTH_INVALID',
      'CORRECT_ANSWERS_RAW_LENGTH_INVALID',
      'POSITION_SEQUENCE_INVALID',
    ]))
  })

  it('detecta DNI presente en resultados y no calificados', () => {
    const validation = validateCalificationResult({
      result: makeResult({
        summary: {
          answersLength: 60,
          totalCandidates: 3,
          noCalificados: [
            { dni: '11111111', motivo: 'Respuesta duplicada' },
          ],
        },
      }),
    })

    expect(validation.valid).toBe(false)
    expect(validation.errors).toEqual(expect.arrayContaining([
      expect.objectContaining({
        code: 'DNI_IN_RESULT_AND_REJECTED',
        context: { dnis: ['11111111'] },
      }),
    ]))
  })

  it('detecta resumen con total de candidatos inconsistente', () => {
    const validation = validateCalificationResult({
      result: makeResult({
        summary: {
          answersLength: 60,
          totalCandidates: 99,
          noCalificados: [],
        },
      }),
    })

    expect(validation.valid).toBe(false)
    expect(validation.errors).toEqual(expect.arrayContaining([
      expect.objectContaining({
        code: 'TOTAL_CANDIDATES_MISMATCH',
      }),
    ]))
  })

  it('detecta trazabilidad por pregunta incompleta o con puntaje inconsistente', () => {
    const validation = validateCalificationResult({
      result: makeResult({
        results: [
          {
            dni: '11111111',
            score: 20,
            position: 1,
            answersRaw: 'AB ',
            correctAnswersRaw: 'AAC',
            questionDetails: [
              { number: 1, score: 20 },
              { number: 2, score: -2 },
            ],
          },
        ],
        summary: {
          answersLength: 3,
          totalCandidates: 1,
          noCalificados: [],
        },
      }),
    })

    expect(validation.valid).toBe(false)
    expect(validation.errors.map((error) => error.code)).toEqual(expect.arrayContaining([
      'QUESTION_DETAILS_LENGTH_INVALID',
      'QUESTION_DETAILS_SCORE_MISMATCH',
    ]))
  })

  it('detecta trazabilidad por materia con puntaje inconsistente', () => {
    const validation = validateCalificationResult({
      result: makeResult({
        results: [
          {
            dni: '11111111',
            score: 20,
            position: 1,
            answersRaw: 'AB ',
            correctAnswersRaw: 'AAC',
            subjectBreakdown: [
              { subject: 'Matemática', score: 18 },
            ],
          },
        ],
        summary: {
          answersLength: 3,
          totalCandidates: 1,
          noCalificados: [],
        },
      }),
    })

    expect(validation.valid).toBe(false)
    expect(validation.errors).toEqual(expect.arrayContaining([
      expect.objectContaining({
        code: 'SUBJECT_BREAKDOWN_SCORE_MISMATCH',
      }),
    ]))
  })

  it('valida posiciones por programa e ingresantes en modo real', () => {
    const validation = validateCalificationResult({
      processType: 'real',
      vacantesPrograma: { Civil: 1 },
      result: makeResult({
        results: [
          {
            dni: '11111111',
            score: 600,
            position: 1,
            positionInPrograma: 1,
            isIngresante: true,
            programa: 'Civil',
            answersRaw: makeAnswers('A'),
            correctAnswersRaw: makeAnswers('A'),
          },
          {
            dni: '22222222',
            score: 300,
            position: 2,
            positionInPrograma: 3,
            isIngresante: true,
            programa: 'Civil',
            answersRaw: makeAnswers('B'),
            correctAnswersRaw: makeAnswers('A'),
          },
        ],
      }),
    })

    expect(validation.valid).toBe(false)
    expect(validation.errors.map((error) => error.code)).toEqual(expect.arrayContaining([
      'PROGRAM_POSITION_SEQUENCE_INVALID',
      'INGRESANTE_OUT_OF_QUOTA',
    ]))
  })

  it('advierte si un simulacro marca ingresantes', () => {
    const validation = validateCalificationResult({
      processType: 'simulacro',
      result: makeResult({
        results: [
          {
            dni: '11111111',
            score: 600,
            position: 1,
            isIngresante: true,
            answersRaw: makeAnswers('A'),
            correctAnswersRaw: makeAnswers('A'),
          },
        ],
        summary: {
          answersLength: 60,
          totalCandidates: 1,
          noCalificados: [],
        },
      }),
    })

    expect(validation.valid).toBe(true)
    expect(validation.warnings).toEqual([
      expect.objectContaining({
        code: 'INGRESANTES_IN_SIMULACRO',
      }),
    ])
  })
})

describe('recálculo independiente del puntaje', () => {
  const KEY = 'ABCDE'.repeat(12)

  function engineResult(answers, questionExceptions = []) {
    const sheet = { dni: '12345678', tipo: 'P', answers, litho: '100001' }
    return calculateAreaResults({
      area: 'General',
      plantilla: {
        id: 'tpl', name: 'Plantilla', questionTotal: 60,
        items: [{ subject: 'A', questionCount: 30, ponderation: 1 }, { subject: 'B', questionCount: 30, ponderation: 2 }],
      },
      correctValue: 10, incorrectValue: 0, blankValue: 2,
      processType: 'simulacro', simulacroScope: 'general', answersLength: 60,
      archiveRows: [{ dni: '12345678', paterno: 'A' }],
      responsesRows: [sheet],
      answerKeyRows: [{ area: '', tipo: 'P', answers: KEY }],
      responsesByDni: new Map([['12345678', [sheet]]]),
      answerKeyLookupByAreaTipo: new Map(),
      answerKeyFallbackByArea: new Map(),
      areaList: ['Biomédicas', 'Sociales', 'Ingeniería'],
      vacantesPrograma: {},
      questionExceptions,
    })
  }

  // Mezcla de aciertos, errores, múltiples y blancos, con pesos distintos.
  const MIXED = KEY.slice(0, 20) + 'E'.repeat(10) + '*' + ' '.repeat(9) + KEY.slice(40, 60)

  it('un resultado del motor pasa el recálculo', () => {
    expect(validateCalificationResult({ result: engineResult(MIXED) })).toMatchObject({ valid: true, errors: [] })
  })

  it('detecta un puntaje alterado aunque el detalle por pregunta siga sumando igual', () => {
    const result = engineResult(MIXED)
    result.results[0].score += 10

    const codes = validateCalificationResult({ result }).errors.map((e) => e.code)
    expect(codes).toContain('SCORE_RECOMPUTE_MISMATCH')
  })

  it('detecta una pregunta marcada como correcta cuando la respuesta no coincide con la clave', () => {
    const result = engineResult(MIXED)
    const row = result.results[0]
    const index = row.questionDetails.findIndex((q) => q.status === 'incorrect')
    row.questionDetails[index] = { ...row.questionDetails[index], status: 'correct', score: row.questionDetails[index].weight * 10 }
    row.score += row.questionDetails[index].weight * 10
    row.subjectBreakdown = null

    const errors = validateCalificationResult({ result }).errors
    expect(errors.map((e) => e.code)).toContain('QUESTION_STATUS_MISMATCH')
    expect(errors.find((e) => e.code === 'QUESTION_STATUS_MISMATCH').context.questions).toContain(index + 1)
  })

  it('detecta si las respuestas guardadas no son las que se calificaron (desplazamiento)', () => {
    const result = engineResult(MIXED)
    const row = result.results[0]
    row.answersRaw = ' ' + row.answersRaw.slice(0, 59)

    expect(validateCalificationResult({ result }).errors.map((e) => e.code)).toContain('SCORE_RECOMPUTE_MISMATCH')
  })

  it('no recalcula cuando faltan los valores de calificación del resumen', () => {
    const result = engineResult(MIXED)
    delete result.summary.correctValue

    expect(validateCalificationResult({ result }).errors.map((e) => e.code)).not.toContain('SCORE_RECOMPUTE_MISMATCH')
  })

  describe('con excepciones de pregunta', () => {
    const exception = (overrides = {}) => ({
      id: 1, area: '', tipo: 'P', questionNumber: 5, type: 'ANULADA_OTORGAR', validAnswers: '',
      reason: 'Mal formulada', documentRef: '', keySha256: keyFingerprint(KEY), ...overrides,
    })
    const codes = (result) => validateCalificationResult({ result }).errors.map((e) => e.code)

    it('un resultado con excepciones de los tres tipos pasa la auditoría', () => {
      const result = engineResult(MIXED, [
        exception(),
        exception({ id: 2, questionNumber: 11, type: 'ANULADA_EXCLUIR' }),
        exception({ id: 3, questionNumber: 30, type: 'CLAVE_MULTIPLE', validAnswers: 'AB' }),
      ])
      expect(validateCalificationResult({ result })).toMatchObject({ valid: true, errors: [] })
    })

    it('detecta si a una hoja se le quitó una excepción que sí estaba registrada', () => {
      const result = engineResult(MIXED, [exception()])
      result.results[0].exceptionsApplied = []

      expect(codes(result)).toContain('EXCEPTION_NOT_APPLIED')
    })

    it('detecta una excepción aplicada que no está registrada en el resumen', () => {
      const result = engineResult(MIXED, [exception()])
      result.results[0].exceptionsApplied.push({ questionNumber: 9, type: 'ANULADA_OTORGAR', validAnswers: '' })

      expect(codes(result)).toContain('EXCEPTION_NOT_REGISTERED')
    })

    it('detecta un puntaje que no refleja la excepción', () => {
      const result = engineResult(' '.repeat(60), [exception()])
      const row = result.results[0]
      // Se anuló la pregunta 5, pero el puntaje quedó como si el blanco valiera su valor normal.
      row.score -= 8

      expect(codes(result)).toContain('SCORE_RECOMPUTE_MISMATCH')
    })

    it('detecta un máximo posible que no descuenta la pregunta excluida', () => {
      const result = engineResult(MIXED, [exception({ type: 'ANULADA_EXCLUIR' })])
      result.results[0].maxScore = 600

      expect(codes(result)).toContain('MAX_SCORE_MISMATCH')
    })

    it('una excepción desactualizada no se exige ni se aplica', () => {
      const result = engineResult(MIXED, [exception({ keySha256: keyFingerprint('E' + KEY.slice(1)) })])
      expect(validateCalificationResult({ result })).toMatchObject({ valid: true, errors: [] })
    })
  })
})
