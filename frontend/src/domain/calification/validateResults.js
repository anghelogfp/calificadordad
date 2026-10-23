import { stripDigits } from '@/utils/helpers'

function issue(code, message, context = {}) {
  return { code, message, context }
}

function isSequential(values) {
  return values.every((value, index) => value === index + 1)
}

function roundScore(value) {
  return Math.round(Number(value) * 1000) / 1000
}

function scoresMatch(left, right) {
  return Math.abs(roundScore(left) - roundScore(right)) <= 0.001
}

const VALID_MARK = /^[A-E]$/

/**
 * Recalcula el puntaje de una hoja leyendo directamente las respuestas contra la clave,
 * con los pesos y valores usados. Es un control independiente del motor: no reutiliza
 * `questionDetails` para decidir si cada respuesta es correcta, solo sus pesos.
 */
function recomputeFromRaw(row, values) {
  const answers = String(row.answersRaw ?? '')
  const key = String(row.correctAnswersRaw ?? '')
  let total = 0
  const statuses = []
  for (let i = 0; i < row.questionDetails.length; i += 1) {
    const mark = answers[i] || ' '
    const correct = key[i] || ' '
    const weight = Number(row.questionDetails[i]?.weight) || 0
    let status
    let value
    if (VALID_MARK.test(mark) && mark === correct) {
      status = 'correct'
      value = values.correct
    } else if (VALID_MARK.test(mark)) {
      status = 'incorrect'
      value = values.incorrect
    } else if (mark === '*') {
      status = 'multiple'
      value = 0
    } else {
      status = 'blank'
      value = values.blank
    }
    statuses.push(status)
    total += value * weight
  }
  return { total, statuses }
}

export function validateCalificationResult({
  result,
  processType = 'simulacro',
  answersLength,
  vacantesPrograma = {},
} = {}) {
  const errors = []
  const warnings = []
  const results = Array.isArray(result?.results) ? result.results : []
  const summary = result?.summary || {}
  const noCalificados = Array.isArray(summary.noCalificados) ? summary.noCalificados : []
  const expectedAnswersLength = Number(answersLength ?? summary.answersLength)

  if (!result || typeof result !== 'object') {
    errors.push(issue('RESULT_REQUIRED', 'El resultado de calificación es requerido.'))
    return { valid: false, errors, warnings }
  }

  if (!Number.isFinite(expectedAnswersLength) || expectedAnswersLength <= 0) {
    errors.push(issue('ANSWERS_LENGTH_INVALID', 'La longitud esperada de respuestas no es válida.', {
      answersLength: expectedAnswersLength,
    }))
  }

  results.forEach((row, index) => {
    const dni = stripDigits(row.dni)
    if (!dni) {
      errors.push(issue('RESULT_DNI_REQUIRED', 'Un resultado calificado no tiene DNI válido.', { index }))
    }

    if (!Number.isFinite(Number(row.score))) {
      errors.push(issue('SCORE_INVALID', 'El puntaje debe ser un número finito.', { dni, score: row.score }))
    }

    if (Number.isFinite(expectedAnswersLength)) {
      if (String(row.answersRaw ?? '').length !== expectedAnswersLength) {
        errors.push(issue('ANSWERS_RAW_LENGTH_INVALID', 'La longitud de respuestas del candidato no coincide con la configuración.', {
          dni,
          expected: expectedAnswersLength,
          actual: String(row.answersRaw ?? '').length,
        }))
      }

      if (String(row.correctAnswersRaw ?? '').length !== expectedAnswersLength) {
        errors.push(issue('CORRECT_ANSWERS_RAW_LENGTH_INVALID', 'La longitud de la clave oficial usada no coincide con la configuración.', {
          dni,
          expected: expectedAnswersLength,
          actual: String(row.correctAnswersRaw ?? '').length,
        }))
      }

      const values = {
        correct: Number(summary.correctValue),
        incorrect: Number(summary.incorrectValue),
        blank: Number(summary.blankValue),
      }
      const canRecompute = Array.isArray(row.questionDetails)
        && row.questionDetails.length === expectedAnswersLength
        && Object.values(values).every(Number.isFinite)
      if (canRecompute) {
        const recomputed = recomputeFromRaw(row, values)
        if (!scoresMatch(recomputed.total, row.score)) {
          errors.push(issue('SCORE_RECOMPUTE_MISMATCH', 'El puntaje no coincide con el recálculo independiente desde las respuestas y la clave.', {
            dni,
            expected: roundScore(recomputed.total),
            actual: roundScore(row.score),
          }))
        }
        const mismatched = recomputed.statuses
          .map((status, index) => (status === row.questionDetails[index]?.status ? 0 : index + 1))
          .filter(Boolean)
        if (mismatched.length > 0) {
          errors.push(issue('QUESTION_STATUS_MISMATCH', 'El estado de algunas preguntas no coincide con las respuestas y la clave.', {
            dni,
            questions: mismatched,
          }))
        }
      }

      if (row.questionDetails !== undefined) {
        if (!Array.isArray(row.questionDetails)) {
          errors.push(issue('QUESTION_DETAILS_INVALID', 'El detalle por pregunta debe ser una lista.', { dni }))
        } else {
          if (row.questionDetails.length !== expectedAnswersLength) {
            errors.push(issue('QUESTION_DETAILS_LENGTH_INVALID', 'El detalle por pregunta no coincide con la cantidad esperada.', {
              dni,
              expected: expectedAnswersLength,
              actual: row.questionDetails.length,
            }))
          }

          const detailsScore = row.questionDetails.reduce((acc, question) => acc + Number(question?.score || 0), 0)
          if (!scoresMatch(detailsScore, row.score)) {
            errors.push(issue('QUESTION_DETAILS_SCORE_MISMATCH', 'La suma del detalle por pregunta no coincide con el puntaje final.', {
              dni,
              expected: row.score,
              actual: roundScore(detailsScore),
            }))
          }
        }
      }
    }

    if (row.subjectBreakdown !== undefined) {
      if (!Array.isArray(row.subjectBreakdown)) {
        errors.push(issue('SUBJECT_BREAKDOWN_INVALID', 'El detalle por materia debe ser una lista.', { dni }))
      } else {
        const subjectScore = row.subjectBreakdown.reduce((acc, subject) => acc + Number(subject?.score || 0), 0)
        if (!scoresMatch(subjectScore, row.score)) {
          errors.push(issue('SUBJECT_BREAKDOWN_SCORE_MISMATCH', 'La suma del detalle por materia no coincide con el puntaje final.', {
            dni,
            expected: row.score,
            actual: roundScore(subjectScore),
          }))
        }
      }
    }
  })

  // Hojas con menos (o más) respuestas que las esperadas: se calculan, pero hay que revisarlas.
  const padded = results.filter((row) => Number(row.assumedBlankCount) > 0)
  if (padded.length > 0) {
    warnings.push(issue('ANSWERS_PADDED', 'Hay hojas con menos respuestas de las esperadas; se asumieron blancos al final.', {
      count: padded.length,
      dnis: padded.map((row) => stripDigits(row.dni)),
    }))
  }
  const truncated = results.filter((row) => Number(row.answersReadLength) > expectedAnswersLength)
  if (truncated.length > 0) {
    warnings.push(issue('ANSWERS_TRUNCATED', 'Hay hojas con más respuestas de las esperadas; se descartó el excedente.', {
      count: truncated.length,
      dnis: truncated.map((row) => stripDigits(row.dni)),
    }))
  }

  const positions = results.map((row) => Number(row.position))
  if (positions.some((position) => !Number.isInteger(position) || position < 1)) {
    errors.push(issue('POSITION_INVALID', 'Todas las posiciones deben ser enteros positivos.'))
  } else if (!isSequential(positions)) {
    errors.push(issue('POSITION_SEQUENCE_INVALID', 'Las posiciones globales deben ser secuenciales desde 1.', {
      positions,
    }))
  }

  const resultDnis = new Set(results.map((row) => stripDigits(row.dni)).filter(Boolean))
  const noCalificadoDnis = new Set(noCalificados.map((row) => stripDigits(row.dni)).filter(Boolean))
  const duplicatedDnis = [...resultDnis].filter((dni) => noCalificadoDnis.has(dni))
  if (duplicatedDnis.length > 0) {
    errors.push(issue('DNI_IN_RESULT_AND_REJECTED', 'Un DNI no puede estar calificado y no calificado al mismo tiempo.', {
      dnis: duplicatedDnis,
    }))
  }

  if (Number.isFinite(Number(summary.totalCandidates))) {
    const expectedTotal = results.length + noCalificados.length
    if (Number(summary.totalCandidates) !== expectedTotal) {
      errors.push(issue('TOTAL_CANDIDATES_MISMATCH', 'El total de candidatos no coincide con resultados más no calificados.', {
        totalCandidates: summary.totalCandidates,
        results: results.length,
        noCalificados: noCalificados.length,
      }))
    }
  } else {
    errors.push(issue('TOTAL_CANDIDATES_INVALID', 'El resumen no tiene un total de candidatos válido.'))
  }

  if (processType === 'real') {
    const byPrograma = new Map()
    results.forEach((row) => {
      const programa = String(row.programa || '').trim()
      const dni = stripDigits(row.dni)
      if (!programa) {
        errors.push(issue('REAL_RESULT_PROGRAM_REQUIRED', 'En convocatoria real todo resultado calificado debe tener programa.', { dni }))
        return
      }
      if (!byPrograma.has(programa)) byPrograma.set(programa, [])
      byPrograma.get(programa).push(row)
    })

    byPrograma.forEach((rows, programa) => {
      const programPositions = rows.map((row) => Number(row.positionInPrograma))
      if (programPositions.some((position) => !Number.isInteger(position) || position < 1)) {
        errors.push(issue('PROGRAM_POSITION_INVALID', 'Las posiciones por programa deben ser enteros positivos.', { programa }))
      } else if (!isSequential(programPositions)) {
        errors.push(issue('PROGRAM_POSITION_SEQUENCE_INVALID', 'Las posiciones por programa deben ser secuenciales desde 1.', {
          programa,
          positions: programPositions,
        }))
      }

      const cupo = Number(vacantesPrograma?.[programa] ?? 0)
      rows.forEach((row) => {
        if (row.isIngresante && (!Number.isFinite(cupo) || cupo <= 0)) {
          errors.push(issue('INGRESANTE_WITHOUT_VACANTE', 'No puede haber ingresante si el programa no tiene vacantes.', {
            programa,
            dni: stripDigits(row.dni),
            cupo,
          }))
        }

        if (row.isIngresante && Number(row.positionInPrograma) > cupo) {
          errors.push(issue('INGRESANTE_OUT_OF_QUOTA', 'Un ingresante no puede estar fuera del cupo del programa.', {
            programa,
            dni: stripDigits(row.dni),
            positionInPrograma: row.positionInPrograma,
            cupo,
          }))
        }
      })
    })
  } else {
    const ingresantes = results.filter((row) => row.isIngresante)
    if (ingresantes.length > 0) {
      warnings.push(issue('INGRESANTES_IN_SIMULACRO', 'Un simulacro no debería marcar ingresantes.', {
        count: ingresantes.length,
      }))
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  }
}
