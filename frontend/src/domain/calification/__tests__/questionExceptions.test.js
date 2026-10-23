import { describe, expect, it } from 'vitest'
import {
  classifyQuestionExceptions,
  exceptionsForKeyRow,
  keyFingerprint,
  keyIdentity,
  toAppliedSummary,
  validateQuestionException,
} from '../questionExceptions'
import { EXCEPTION_TYPES } from '../scoreAnswerSheet'

const KEY = 'ABCDE'.repeat(12)
const OTHER_KEY = 'EDCBA'.repeat(12)
const AREAS = ['Biomédicas', 'Sociales', 'Ingeniería']

const exc = (overrides = {}) => ({
  id: 1, area: '', tipo: 'P', questionNumber: 5, type: EXCEPTION_TYPES.AWARD, validAnswers: '',
  reason: 'Pregunta mal formulada', documentRef: 'Acta 3', keySha256: keyFingerprint(KEY), ...overrides,
})
const keyRow = (overrides = {}) => ({ area: '', tipo: 'P', answers: KEY, ...overrides })
const classify = (exceptions, keyRows = [keyRow()]) =>
  classifyQuestionExceptions({ exceptions, keyRows, answersLength: 60, areaList: AREAS })

describe('keyFingerprint', () => {
  it('es el SHA-256 de la clave en mayúsculas (el servidor calcula lo mismo)', () => {
    // sha256("ABC"): vector fijo, para detectar diferencias entre frontend y backend.
    expect(keyFingerprint('abc')).toBe('b5d4045c3f466fa91fe2cc6abe79232a1a57cdf104f7a26e716e0a1e2789df78')
    expect(keyFingerprint('ABC')).toBe(keyFingerprint('abc'))
  })

  it('cambia con una sola letra o con un espacio', () => {
    expect(keyFingerprint(KEY)).not.toBe(keyFingerprint('B' + KEY.slice(1)))
    expect(keyFingerprint(KEY)).not.toBe(keyFingerprint(KEY + ' '))
  })
})

describe('keyIdentity', () => {
  it('normaliza el área y el tipo', () => {
    expect(keyIdentity('', 'p', AREAS)).toBe('|P')
    expect(keyIdentity('  ', '', AREAS)).toBe('|')
    expect(keyIdentity('ingenieria', 'q', AREAS)).toBe(keyIdentity('INGENIERÍAS', 'Q', AREAS))
  })
})

describe('validateQuestionException', () => {
  const valid = exc()

  it('acepta una excepción completa', () => {
    expect(validateQuestionException(valid, { answersLength: 60 })).toEqual([])
  })

  it('rechaza un número de pregunta fuera del examen', () => {
    expect(validateQuestionException({ ...valid, questionNumber: 61 }, { answersLength: 60 })[0]).toMatch(/pregunta 61 no existe/)
    expect(validateQuestionException({ ...valid, questionNumber: 0 }, { answersLength: 60 })).not.toEqual([])
    expect(validateQuestionException({ ...valid, questionNumber: 1.5 }, { answersLength: 60 })).not.toEqual([])
  })

  it('exige letras válidas en el tipo de clave múltiple', () => {
    const multi = { ...valid, type: EXCEPTION_TYPES.MULTIPLE_KEY }
    expect(validateQuestionException({ ...multi, validAnswers: '' }, { answersLength: 60 })[0]).toMatch(/al menos una/)
    expect(validateQuestionException({ ...multi, validAnswers: 'XY' }, { answersLength: 60 })).not.toEqual([])
    expect(validateQuestionException({ ...multi, validAnswers: 'BD' }, { answersLength: 60 })).toEqual([])
  })

  it('exige el motivo (queda en la auditoría)', () => {
    expect(validateQuestionException({ ...valid, reason: '  ' }, { answersLength: 60 })[0]).toMatch(/motivo/)
  })

  it('rechaza un tipo desconocido', () => {
    expect(validateQuestionException({ ...valid, type: 'OTRA' }, { answersLength: 60 })).not.toEqual([])
  })
})

describe('classifyQuestionExceptions', () => {
  it('aplica la excepción cuya clave existe y no cambió', () => {
    expect(classify([exc()])[0]).toMatchObject({ status: 'applied', message: '' })
  })

  it('no aplica una excepción si la clave cambió (otro examen con las mismas llaves)', () => {
    const [result] = classify([exc()], [keyRow({ answers: OTHER_KEY })])
    expect(result.status).toBe('outdated')
    expect(result.message).toMatch(/clave cambió/)
  })

  it('no aplica una excepción si ya no hay clave de ese área y tipo', () => {
    expect(classify([exc()], [keyRow({ tipo: 'Q' })])[0].status).toBe('orphan')
    expect(classify([exc()], [])[0].status).toBe('orphan')
  })

  it('distingue las claves por tipo de prueba', () => {
    const keys = [keyRow({ tipo: 'P' }), keyRow({ tipo: 'Q', answers: OTHER_KEY })]
    const result = classify([exc({ tipo: 'P' }), exc({ id: 2, tipo: 'Q', keySha256: keyFingerprint(OTHER_KEY) })], keys)
    expect(result.map((r) => r.status)).toEqual(['applied', 'applied'])
  })

  it('marca como inválidas las dos excepciones duplicadas de la misma pregunta y clave, sin aplicar ninguna', () => {
    const result = classify([exc(), exc({ id: 2, type: EXCEPTION_TYPES.EXCLUDE })])
    expect(result.map((r) => r.status)).toEqual(['invalid', 'invalid'])
    expect(result[0].message).toMatch(/más de una excepción/)
  })

  it('la misma pregunta en otro tipo de prueba no es un duplicado', () => {
    const keys = [keyRow({ tipo: 'P' }), keyRow({ tipo: 'Q' })]
    const result = classify([exc({ tipo: 'P' }), exc({ id: 2, tipo: 'Q' })], keys)
    expect(result.map((r) => r.status)).toEqual(['applied', 'applied'])
  })

  it('marca como inválida una excepción mal formada', () => {
    expect(classify([exc({ questionNumber: 99 })])[0].status).toBe('invalid')
  })
})

describe('exceptionsForKeyRow', () => {
  it('devuelve solo las aplicadas a esa clave', () => {
    const classified = classify([exc(), exc({ id: 2, questionNumber: 9, tipo: 'Q' })], [keyRow(), keyRow({ tipo: 'Q' })])
    expect(exceptionsForKeyRow(classified, keyRow(), AREAS).map((e) => e.questionNumber)).toEqual([5])
  })

  it('no devuelve excepciones desactualizadas', () => {
    const classified = classify([exc()], [keyRow({ answers: OTHER_KEY })])
    expect(exceptionsForKeyRow(classified, keyRow({ answers: OTHER_KEY }), AREAS)).toEqual([])
  })

  it('sin clave no hay excepciones', () => {
    expect(exceptionsForKeyRow(classify([exc()]), undefined, AREAS)).toEqual([])
  })
})

describe('toAppliedSummary', () => {
  it('deja solo lo necesario para reproducir el puntaje, ordenado por pregunta', () => {
    const summary = toAppliedSummary([
      exc({ questionNumber: 9, type: EXCEPTION_TYPES.MULTIPLE_KEY, validAnswers: 'db' }),
      exc({ questionNumber: 2 }),
    ])
    expect(summary).toEqual([
      { questionNumber: 2, type: 'ANULADA_OTORGAR', validAnswers: '' },
      { questionNumber: 9, type: 'CLAVE_MULTIPLE', validAnswers: 'BD' },
    ])
  })
})
