export function roundScore(value) {
  return Math.round(Number(value || 0) * 1000) / 1000
}

/**
 * Califica una hoja de respuestas contra una clave oficial aplicando el plan de preguntas y excepciones.
 * @param {Object} params
 * @param {string} params.answersRaw - Cadena de respuestas del postulante
 * @param {string} params.correctAnswersRaw - Cadena de clave oficial
 * @param {Array<{subject: string, weight: number}>} params.plan - Plan por pregunta (longitud = answersLength)
 * @param {number} [params.correctValue=1] - Valor por acierto (default PJ: 1)
 * @param {number} [params.incorrectValue=0] - Valor por desacierto (default PJ: 0)
 * @param {number} [params.blankValue=0] - Valor por blanco (default PJ: 0)
 * @param {Array<Object>} [params.questionExceptions=[]] - Excepciones por número de pregunta (1-indexed)
 */
export function scoreAnswerSheet({
  answersRaw = '',
  correctAnswersRaw = '',
  plan = [],
  correctValue = 1,
  incorrectValue = 0,
  blankValue = 0,
  questionExceptions = [],
} = {}) {
  const rawAnswersUpper = String(answersRaw ?? '').toUpperCase()
  const rawCorrectUpper = String(correctAnswersRaw ?? '').toUpperCase()
  const originalAnswersLength = rawAnswersUpper.length
  const totalQuestions = plan.length

  const answersNormalized = rawAnswersUpper.padEnd(totalQuestions, ' ').slice(0, totalQuestions)
  const correctAnswersNormalized = rawCorrectUpper.padEnd(totalQuestions, ' ').slice(0, totalQuestions)

  const exceptionsByQuestion = new Map()
  if (Array.isArray(questionExceptions)) {
    questionExceptions.forEach((exc) => {
      const qNum = Number(exc?.questionNumber)
      if (Number.isInteger(qNum) && qNum >= 1 && qNum <= totalQuestions && exc?.type) {
        exceptionsByQuestion.set(qNum, exc)
      }
    })
  }

  let totalScore = 0
  let maxPossibleScore = 0
  let correctCount = 0
  let incorrectCount = 0
  let blankCount = 0
  let multipleCount = 0
  let annulledGrantedCount = 0
  let annulledExcludedCount = 0

  const questionDetails = []
  const subjectBreakdownByName = new Map()

  for (let index = 0; index < totalQuestions; index += 1) {
    const questionNumber = index + 1
    const planItem = plan[index] || {}
    const subject = String(planItem.subject || 'Sin materia').trim() || 'Sin materia'
    const weight = Number(planItem.weight) || 0

    const responseChar = answersNormalized[index] || ' '
    const correctChar = correctAnswersNormalized[index] || ' '
    const isCorrectCharValid = /^[A-E]$/.test(correctChar)
    const isResponseCharValid = /^[A-E]$/.test(responseChar)
    const isMultipleMark = responseChar === '*'
    const isAssumedFinalBlank = index >= originalAnswersLength

    const exception = exceptionsByQuestion.get(questionNumber)
    const exceptionType = exception?.type ? String(exception.type).trim().toUpperCase() : ''

    let contribution = 0
    let status = 'blank'
    let exceptionApplied = null
    let effectiveCorrectAnswer = correctChar

    if (exceptionType === 'ANULADA_OTORGAR') {
      contribution = correctValue * weight
      status = 'correct'
      exceptionApplied = 'ANULADA_OTORGAR'
      annulledGrantedCount += 1
      correctCount += 1
      maxPossibleScore += correctValue * weight
    } else if (exceptionType === 'ANULADA_EXCLUIR') {
      contribution = 0
      status = 'excluded'
      exceptionApplied = 'ANULADA_EXCLUIR'
      annulledExcludedCount += 1
    } else if (exceptionType === 'CLAVE_MULTIPLE') {
      const validLetters = String(exception.validAnswers || correctChar)
        .toUpperCase()
        .replace(/[^A-E]/g, '')
        .split('')
      const validSet = new Set(validLetters)
      if (validSet.size === 0) {
        throw new Error(`La clave oficial contiene una respuesta inválida en la pregunta ${questionNumber}.`)
      }
      effectiveCorrectAnswer = [...validSet].join('')
      exceptionApplied = 'CLAVE_MULTIPLE'
      maxPossibleScore += correctValue * weight

      if (isResponseCharValid && validSet.has(responseChar)) {
        contribution = correctValue * weight
        status = 'correct'
        correctCount += 1
      } else if (isResponseCharValid) {
        contribution = incorrectValue * weight
        status = 'incorrect'
        incorrectCount += 1
      } else if (isMultipleMark) {
        contribution = 0
        status = 'multiple'
        multipleCount += 1
      } else {
        contribution = blankValue * weight
        status = 'blank'
        blankCount += 1
      }
    } else {
      if (!isCorrectCharValid) {
        throw new Error(`La clave oficial contiene una respuesta inválida en la pregunta ${questionNumber}.`)
      }
      maxPossibleScore += correctValue * weight

      if (isCorrectCharValid && isResponseCharValid && responseChar === correctChar) {
        contribution = correctValue * weight
        status = 'correct'
        correctCount += 1
      } else if (isResponseCharValid) {
        contribution = incorrectValue * weight
        status = 'incorrect'
        incorrectCount += 1
      } else if (isMultipleMark) {
        contribution = 0
        status = 'multiple'
        multipleCount += 1
      } else {
        contribution = blankValue * weight
        status = 'blank'
        blankCount += 1
      }
    }

    totalScore += contribution
    const roundedContribution = roundScore(contribution)

    const detailItem = {
      number: questionNumber,
      subject,
      weight,
      answer: responseChar.trim(),
      blankSource: status === 'blank' ? (isAssumedFinalBlank ? 'assumed-final' : 'dat') : '',
      correctAnswer: effectiveCorrectAnswer,
      status,
      score: roundedContribution,
    }
    if (exceptionApplied) {
      detailItem.exceptionApplied = exceptionApplied
    }
    questionDetails.push(detailItem)

    if (!subjectBreakdownByName.has(subject)) {
      subjectBreakdownByName.set(subject, {
        subject,
        questions: 0,
        correct: 0,
        incorrect: 0,
        multiple: 0,
        blank: 0,
        score: 0,
        totalWeight: 0,
      })
    }
    const subjectBreakdown = subjectBreakdownByName.get(subject)
    subjectBreakdown.questions += 1
    if (status === 'excluded') {
      subjectBreakdown.excluded = (subjectBreakdown.excluded || 0) + 1
    } else {
      subjectBreakdown[status] = (subjectBreakdown[status] || 0) + 1
    }
    subjectBreakdown.score = roundScore(subjectBreakdown.score + contribution)
    subjectBreakdown.totalWeight = roundScore(
      subjectBreakdown.totalWeight + (status === 'excluded' ? 0 : weight),
    )
  }

  return {
    score: roundScore(totalScore),
    maxPossibleScore: roundScore(maxPossibleScore),
    correctCount,
    incorrectCount,
    blankCount,
    multipleCount,
    annulledGrantedCount,
    annulledExcludedCount,
    questionDetails,
    subjectBreakdown: [...subjectBreakdownByName.values()],
    answersNormalized,
    correctAnswersNormalized,
  }
}
