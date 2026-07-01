import { describe, expect, it } from 'vitest'
import { validateCalificationResult } from '../validateResults'

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
