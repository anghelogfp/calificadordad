import { describe, expect, it } from 'vitest'
import { EXCEPTION_TYPES, parseValidAnswers, roundScore, scoreAnswerSheet } from '../scoreAnswerSheet'

// Fórmula anterior del motor, copiada tal cual: sirve de oráculo para comprobar que, sin
// excepciones, la función única da exactamente lo mismo que antes.
function referenceScore({ answersRaw, correctAnswersRaw, plan, correctValue, incorrectValue, blankValue }) {
  const answers = String(answersRaw).toUpperCase().padEnd(plan.length, ' ').slice(0, plan.length)
  const correctAnswers = String(correctAnswersRaw).toUpperCase().padEnd(plan.length, ' ').slice(0, plan.length)
  let total = 0
  const statuses = []
  const scores = []
  for (let index = 0; index < plan.length; index += 1) {
    const weight = Number(plan[index].weight) || 0
    const responseChar = answers[index] || ' '
    const correctChar = correctAnswers[index] || ' '
    const isCorrectCharValid = /^[A-E]$/.test(correctChar)
    const isResponseCharValid = /^[A-E]$/.test(responseChar)
    if (!isCorrectCharValid) throw new Error(`La clave oficial contiene una respuesta inválida en la pregunta ${index + 1}.`)
    let contribution = 0
    let status = 'blank'
    if (isResponseCharValid && responseChar === correctChar) { contribution = correctValue * weight; status = 'correct' }
    else if (isResponseCharValid) { contribution = incorrectValue * weight; status = 'incorrect' }
    else if (responseChar === '*') { contribution = 0; status = 'multiple' }
    else { contribution = blankValue * weight }
    total += contribution
    statuses.push(status)
    scores.push(Math.round(contribution * 1000) / 1000)
  }
  return { total: Math.round(total * 1000) / 1000, statuses, scores }
}

function seededRandom(seed) {
  let state = seed
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296
    return state / 4294967296
  }
}

const plan60 = (weights = [1]) => Array.from({ length: 60 }, (_, i) => ({ subject: `M${i % 3}`, weight: weights[i % weights.length] }))
const KEY = 'ABCDE'.repeat(12)

function score(overrides = {}) {
  return scoreAnswerSheet({
    answersRaw: KEY, correctAnswersRaw: KEY, plan: plan60(), correctValue: 10, incorrectValue: 0, blankValue: 2, ...overrides,
  })
}

describe('scoreAnswerSheet sin excepciones', () => {
  it('da exactamente lo mismo que la fórmula anterior en 3000 hojas aleatorias', () => {
    const random = seededRandom(20261022)
    const marks = 'ABCDE*  '
    for (let n = 0; n < 3000; n += 1) {
      const length = Math.floor(random() * 70) // incluye hojas cortas y largas
      const answersRaw = Array.from({ length }, () => marks[Math.floor(random() * marks.length)]).join('')
      const key = Array.from({ length: 60 }, () => 'ABCDE'[Math.floor(random() * 5)]).join('')
      const values = {
        correctValue: [10, 1, 5.5][n % 3], incorrectValue: [0, -1, -0.25][n % 3], blankValue: [2, 0, 0.5][n % 3],
      }
      const plan = plan60([1, 2.5, 3, 0.333])

      const expected = referenceScore({ answersRaw, correctAnswersRaw: key, plan, ...values })
      const actual = scoreAnswerSheet({ answersRaw, correctAnswersRaw: key, plan, ...values })

      expect(actual.total, `hoja ${n}`).toBe(expected.total)
      expect(actual.questionDetails.map((q) => q.status), `hoja ${n}`).toEqual(expected.statuses)
      expect(actual.questionDetails.map((q) => q.score), `hoja ${n}`).toEqual(expected.scores)
    }
  })

  it('lanza el mismo error cuando la clave oficial tiene una letra inválida', () => {
    expect(() => score({ correctAnswersRaw: KEY.slice(0, 9) + '?' + KEY.slice(10) }))
      .toThrow('La clave oficial contiene una respuesta inválida en la pregunta 10.')
    expect(() => score({ correctAnswersRaw: KEY.slice(0, 59) })).toThrow('pregunta 60')
  })

  it('cuenta aciertos, errores, múltiples y blancos', () => {
    const result = score({ answersRaw: 'AB*  ' + KEY.slice(5) })
    expect(result.counts).toEqual({ correct: 57, incorrect: 0, multiple: 1, blank: 2, awarded: 0, excluded: 0 })
    expect(result.total).toBe(57 * 10 + 0 + 2 * 2)
  })

  it('informa cuántos blancos finales se asumieron', () => {
    const result = score({ answersRaw: KEY.slice(0, 57) })
    expect(result).toMatchObject({ originalAnswersLength: 57, assumedBlankCount: 3 })
    expect(result.questionDetails.slice(57).every((q) => q.blankSource === 'assumed-final')).toBe(true)
  })

  it('el puntaje máximo posible es el de acertar todo', () => {
    expect(score().maxPossible).toBe(600)
  })
})

describe('excepciones de pregunta', () => {
  const exception = (questionNumber, type, validAnswers = '') => ({ questionNumber, type, validAnswers })

  describe('ANULADA_OTORGAR: todos reciben el punto', () => {
    it('da el puntaje completo a quien marcó otra letra, dejó en blanco o marcó varias', () => {
      for (const mark of ['E', ' ', '*']) {
        const answers = KEY.slice(0, 4) + mark + KEY.slice(5)
        const result = score({ answersRaw: answers, exceptions: [exception(5, EXCEPTION_TYPES.AWARD)] })
        expect(result.questionDetails[4]).toMatchObject({ status: 'awarded', score: 10, exception: 'ANULADA_OTORGAR' })
        expect(result.total, `marca "${mark}"`).toBe(600)
      }
    })

    it('respeta el peso de la pregunta', () => {
      const plan = plan60([1, 3])
      const result = score({ plan, answersRaw: ' '.repeat(60), exceptions: [exception(2, EXCEPTION_TYPES.AWARD)] })
      expect(result.questionDetails[1].score).toBe(30)
    })

    it('no exige que la clave tenga una letra válida en esa pregunta', () => {
      const result = score({ correctAnswersRaw: KEY.slice(0, 4) + '?' + KEY.slice(5), exceptions: [exception(5, EXCEPTION_TYPES.AWARD)] })
      expect(result.questionDetails[4].status).toBe('awarded')
    })

    it('quien ya acertó recibe lo mismo y el resto de preguntas no cambia', () => {
      const withException = score({ answersRaw: ' '.repeat(60), exceptions: [exception(5, EXCEPTION_TYPES.AWARD)] })
      const without = score({ answersRaw: ' '.repeat(60) })
      expect(withException.total - without.total).toBe(10 - 2)
    })
  })

  describe('ANULADA_EXCLUIR: no cuenta para nadie', () => {
    it('aporta 0 aunque haya acertado, y baja el máximo posible', () => {
      const result = score({ exceptions: [exception(5, EXCEPTION_TYPES.EXCLUDE)] })
      expect(result.questionDetails[4]).toMatchObject({ status: 'excluded', score: 0 })
      expect(result.total).toBe(590)
      expect(result.maxPossible).toBe(590)
    })

    it('aporta 0 también a quien erró o dejó en blanco (no se le suma el blanco)', () => {
      const blank = score({ answersRaw: KEY.slice(0, 4) + ' ' + KEY.slice(5), exceptions: [exception(5, EXCEPTION_TYPES.EXCLUDE)] })
      expect(blank.total).toBe(590)
    })

    it('no reescala el puntaje: los demás puntos valen lo mismo', () => {
      const result = score({ exceptions: [exception(5, EXCEPTION_TYPES.EXCLUDE)] })
      expect(result.questionDetails[0].score).toBe(10)
    })
  })

  describe('CLAVE_MULTIPLE: varias respuestas válidas', () => {
    const multi = exception(5, EXCEPTION_TYPES.MULTIPLE_KEY, 'BD')

    it('acepta cualquiera de las letras válidas', () => {
      for (const mark of ['B', 'D']) {
        const result = score({ answersRaw: KEY.slice(0, 4) + mark + KEY.slice(5), exceptions: [multi] })
        expect(result.questionDetails[4]).toMatchObject({ status: 'correct', score: 10, validAnswers: 'BD' })
      }
    })

    it('la letra original de la clave solo vale si está en el conjunto', () => {
      // La clave dice E en la pregunta 5; el conjunto es BD: marcar E ya no es correcto.
      const result = score({ answersRaw: KEY, exceptions: [multi] })
      expect(result.questionDetails[4].status).toBe('incorrect')
    })

    it('una letra fuera del conjunto es incorrecta, un blanco sigue siendo blanco y * sigue siendo múltiple', () => {
      expect(score({ answersRaw: KEY.slice(0, 4) + 'A' + KEY.slice(5), exceptions: [multi] }).questionDetails[4].status).toBe('incorrect')
      expect(score({ answersRaw: KEY.slice(0, 4) + ' ' + KEY.slice(5), exceptions: [multi] }).questionDetails[4].status).toBe('blank')
      expect(score({ answersRaw: KEY.slice(0, 4) + '*' + KEY.slice(5), exceptions: [multi] }).questionDetails[4].status).toBe('multiple')
    })

    it('una sola letra funciona como corrección de la clave', () => {
      const result = score({ answersRaw: KEY.slice(0, 4) + 'C' + KEY.slice(5), exceptions: [exception(5, EXCEPTION_TYPES.MULTIPLE_KEY, 'C')] })
      expect(result.questionDetails[4].status).toBe('correct')
    })

    it('normaliza el conjunto: mayúsculas, sin repetidos ni caracteres ajenos', () => {
      expect(parseValidAnswers('d, b b')).toBe('BD')
      expect(parseValidAnswers('XYZ')).toBe('')
    })
  })

  it('las excepciones solo afectan a su pregunta', () => {
    const result = score({ answersRaw: ' '.repeat(60), exceptions: [exception(7, EXCEPTION_TYPES.AWARD)] })
    expect(result.counts).toMatchObject({ awarded: 1, blank: 59 })
  })

  it('combina varias excepciones en la misma hoja', () => {
    const result = score({
      answersRaw: KEY.slice(0, 2) + 'AAA' + KEY.slice(5),
      exceptions: [exception(3, EXCEPTION_TYPES.AWARD), exception(4, EXCEPTION_TYPES.EXCLUDE), exception(5, EXCEPTION_TYPES.MULTIPLE_KEY, 'AE')],
    })
    expect(result.counts).toMatchObject({ awarded: 1, excluded: 1 })
    expect(result.questionDetails.map((q) => q.status).slice(2, 5)).toEqual(['awarded', 'excluded', 'correct'])
    // 600 posibles, menos los 10 de la pregunta 4 que no cuenta.
    expect(result.total).toBe(590)
  })

  it('el desglose por materia cuenta las preguntas anuladas', () => {
    const result = score({ exceptions: [exception(1, EXCEPTION_TYPES.AWARD), exception(4, EXCEPTION_TYPES.EXCLUDE)] })
    const m0 = result.subjectBreakdown.find((s) => s.subject === 'M0')
    expect(m0).toMatchObject({ awarded: 1, excluded: 1 })
    expect(result.subjectBreakdown.reduce((sum, s) => sum + s.score, 0)).toBeCloseTo(result.total, 3)
  })

  it('ignora excepciones mal formadas en lugar de romper', () => {
    const result = score({ exceptions: [null, {}, { questionNumber: 0, type: 'X' }, { questionNumber: 99, type: EXCEPTION_TYPES.AWARD }] })
    expect(result.total).toBe(600)
  })
})

describe('roundScore', () => {
  it('redondea a 3 decimales', () => {
    expect(roundScore(1.23456)).toBe(1.235)
  })
})
