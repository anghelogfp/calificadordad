/**
 * Calificación de UNA hoja contra una clave. Es la única implementación del puntaje por
 * pregunta: la usan el motor de calificación, el detalle del alumno, las exportaciones y el
 * verificador, de modo que una regla (o una excepción) no pueda aplicarse en un sitio y
 * olvidarse en otro.
 */

export const EXCEPTION_TYPES = {
  AWARD: 'ANULADA_OTORGAR',
  EXCLUDE: 'ANULADA_EXCLUIR',
  MULTIPLE_KEY: 'CLAVE_MULTIPLE',
}

const VALID_MARK = /^[A-E]$/

export function roundScore(value) {
  return Math.round(value * 1000) / 1000
}

/** Letras A-E de una lista de respuestas válidas, sin repetir y en orden. */
export function parseValidAnswers(value) {
  const letters = String(value ?? '').toUpperCase().replace(/[^A-E]/g, '')
  return [...new Set(letters)].sort().join('')
}

function buildExceptionMap(exceptions) {
  const byQuestion = new Map()
  for (const exception of exceptions || []) {
    const number = Number(exception?.questionNumber)
    if (Number.isInteger(number) && number >= 1 && exception?.type) byQuestion.set(number, exception)
  }
  return byQuestion
}

/**
 * @param {object} params
 * @param {string} params.answersRaw - Respuestas del postulante (cada espacio es un blanco)
 * @param {string} params.correctAnswersRaw - Clave oficial
 * @param {{subject: string, weight: number}[]} params.plan - Materia y peso por pregunta
 * @param {number} params.correctValue
 * @param {number} params.incorrectValue
 * @param {number} params.blankValue
 * @param {{questionNumber: number, type: string, validAnswers?: string}[]} [params.exceptions]
 *   Excepciones que aplican a la clave usada (números de pregunta desde 1)
 * @param {boolean} [params.strictKey=true] Si es false, una letra inválida en la clave no lanza error:
 *   esa pregunta simplemente no puede acertarse (para exportar o mostrar datos ya guardados)
 * @returns {{
 *   total: number, maxPossible: number, answers: string, correctAnswers: string,
 *   originalAnswersLength: number, assumedBlankCount: number,
 *   questionDetails: object[], subjectBreakdown: object[],
 *   counts: {correct: number, incorrect: number, multiple: number, blank: number, awarded: number, excluded: number}
 * }}
 */
export function scoreAnswerSheet({
  answersRaw = '',
  correctAnswersRaw = '',
  plan = [],
  correctValue = 0,
  incorrectValue = 0,
  blankValue = 0,
  exceptions = [],
  strictKey = true,
} = {}) {
  const rawAnswers = String(answersRaw ?? '').toUpperCase()
  const rawKey = String(correctAnswersRaw ?? '').toUpperCase()
  const originalAnswersLength = rawAnswers.length
  const answers = rawAnswers.padEnd(plan.length, ' ').slice(0, plan.length)
  const correctAnswers = rawKey.padEnd(plan.length, ' ').slice(0, plan.length)
  const exceptionByQuestion = buildExceptionMap(exceptions)

  let total = 0
  let maxPossible = 0
  const questionDetails = []
  const subjects = new Map()
  const counts = { correct: 0, incorrect: 0, multiple: 0, blank: 0, awarded: 0, excluded: 0 }

  for (let index = 0; index < plan.length; index += 1) {
    const planItem = plan[index] || {}
    const subject = String(planItem.subject || 'Sin materia').trim() || 'Sin materia'
    const weight = Number(planItem.weight) || 0
    const responseChar = answers[index] || ' '
    const correctChar = correctAnswers[index] || ' '
    const isMarkedValid = VALID_MARK.test(responseChar)
    const exception = exceptionByQuestion.get(index + 1)
    const validAnswers = exception?.type === EXCEPTION_TYPES.MULTIPLE_KEY ? parseValidAnswers(exception.validAnswers) : ''

    // Una pregunta anulada o con respuestas múltiples no depende de la letra de la clave.
    const keyMatters = !exception
    if (strictKey && keyMatters && !VALID_MARK.test(correctChar)) {
      throw new Error(`La clave oficial contiene una respuesta inválida en la pregunta ${index + 1}.`)
    }

    let contribution = 0
    let status = 'blank'
    if (exception?.type === EXCEPTION_TYPES.AWARD) {
      contribution = correctValue * weight
      status = 'awarded'
    } else if (exception?.type === EXCEPTION_TYPES.EXCLUDE) {
      contribution = 0
      status = 'excluded'
    } else if (isMarkedValid && (exception?.type === EXCEPTION_TYPES.MULTIPLE_KEY
      ? validAnswers.includes(responseChar)
      : (VALID_MARK.test(correctChar) && responseChar === correctChar))) {
      contribution = correctValue * weight
      status = 'correct'
    } else if (isMarkedValid) {
      contribution = incorrectValue * weight
      status = 'incorrect'
    } else if (responseChar === '*') {
      contribution = 0
      status = 'multiple'
    } else {
      contribution = blankValue * weight
    }

    total += contribution
    if (status !== 'excluded') maxPossible += correctValue * weight
    counts[status] += 1

    questionDetails.push({
      number: index + 1,
      subject,
      weight,
      answer: responseChar.trim(),
      blankSource: status === 'blank' ? (index >= originalAnswersLength ? 'assumed-final' : 'dat') : '',
      correctAnswer: correctChar,
      status,
      score: roundScore(contribution),
      exception: exception?.type || '',
      validAnswers,
    })

    if (!subjects.has(subject)) {
      subjects.set(subject, {
        subject, questions: 0, correct: 0, incorrect: 0, multiple: 0, blank: 0, awarded: 0, excluded: 0, score: 0, totalWeight: 0,
      })
    }
    const breakdown = subjects.get(subject)
    breakdown.questions += 1
    breakdown[status] += 1
    breakdown.score = roundScore(breakdown.score + contribution)
    breakdown.totalWeight = roundScore(breakdown.totalWeight + weight)
  }

  return {
    total: roundScore(total),
    maxPossible: roundScore(maxPossible),
    answers,
    correctAnswers,
    originalAnswersLength,
    assumedBlankCount: Math.max(0, plan.length - originalAnswersLength),
    questionDetails,
    subjectBreakdown: [...subjects.values()],
    counts,
  }
}
