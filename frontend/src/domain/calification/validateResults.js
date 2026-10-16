import { stripDigits } from '@/utils/helpers'

const VALID_QUESTION_STATUSES = new Set(['correct', 'incorrect', 'blank', 'multiple', 'excluded'])

function issue(code, message, context = {}) {
  return { code, message, context }
}

function isSequential(values) {
  return values.every((value, index) => value === index + 1)
}

function isValidSharedRankSequence(values) {
  if (values.length === 0) return true
  if (values[0] !== 1) return false
  for (let i = 1; i < values.length; i += 1) {
    const prev = values[i - 1]
    const curr = values[i]
    if (curr < prev) return false
    if (curr !== prev && curr !== i + 1 && curr !== prev + 1) return false
  }
  return true
}

function roundScore(value) {
  return Math.round(Number(value) * 1000) / 1000
}

function scoresMatch(left, right) {
  return Math.abs(roundScore(left) - roundScore(right)) <= 0.001
}

export function validateCalificationResult({
  result,
  processType = 'simulacro',
  answersLength,
  vacantesPrograma = {},
  vacantesPuesto = {},
} = {}) {
  const errors = []
  const warnings = []
  const results = Array.isArray(result?.results) ? result.results : []
  const summary = result?.summary || {}
  const noCalificados = Array.isArray(summary.noCalificados) ? summary.noCalificados : []
  const expectedAnswersLength = Number(answersLength ?? summary.answersLength)
  const effectiveProcessType = processType || summary.processType || 'simulacro'

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

          const invalidStatusDetail = row.questionDetails.find(
            (q) => q?.status !== undefined && !VALID_QUESTION_STATUSES.has(q.status),
          )
          if (invalidStatusDetail) {
            errors.push(issue('QUESTION_DETAIL_STATUS_INVALID', 'El estado de una pregunta no es válido.', {
              dni,
              number: invalidStatusDetail.number,
              status: invalidStatusDetail.status,
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

  if (effectiveProcessType === 'real') {
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
  } else if (effectiveProcessType === 'poder_judicial') {
    const effectiveVacantes = { ...vacantesPrograma, ...vacantesPuesto }
    const byPuesto = new Map()

    results.forEach((row) => {
      const puestoKey = String(row.codPuesto || row.programa || row.puesto || '').trim()
      const dni = stripDigits(row.dni)
      if (!puestoKey) {
        errors.push(issue('PJ_RESULT_PUESTO_REQUIRED', 'En Poder Judicial todo resultado calificado debe tener puesto asignado.', { dni }))
        return
      }
      if (!byPuesto.has(puestoKey)) byPuesto.set(puestoKey, [])
      byPuesto.get(puestoKey).push(row)
    })

    byPuesto.forEach((rows, puestoKey) => {
      const programPositions = rows.map((row) => Number(row.positionInPrograma))
      if (programPositions.some((position) => !Number.isInteger(position) || position < 1)) {
        errors.push(issue('PROGRAM_POSITION_INVALID', 'Las posiciones por puesto deben ser enteros positivos.', { programa: puestoKey }))
      } else if (!isValidSharedRankSequence(programPositions)) {
        errors.push(issue('PROGRAM_POSITION_SEQUENCE_INVALID', 'Las posiciones por puesto no tienen una secuencia válida.', {
          programa: puestoKey,
          positions: programPositions,
        }))
      }

      const sampleRow = rows[0] || {}
      const cupo = Number(
        effectiveVacantes?.[puestoKey] ??
          effectiveVacantes?.[sampleRow.codPuesto] ??
          effectiveVacantes?.[sampleRow.puesto] ??
          effectiveVacantes?.[sampleRow.programa] ??
          0,
      )
      const requireQuota = summary?.scoringOptions?.requireQuotaForIngreso !== false

      if (requireQuota && cupo > 0) {
        rows.forEach((row) => {
          if (row.isIngresante && Number(row.positionInPrograma) > cupo) {
            errors.push(issue('INGRESANTE_OUT_OF_QUOTA', 'Un ganador de vacante no puede estar fuera del cupo del puesto.', {
              programa: puestoKey,
              dni: stripDigits(row.dni),
              positionInPrograma: row.positionInPrograma,
              cupo,
            }))
          }
        })
      }
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
