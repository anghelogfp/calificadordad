import { stripDigits } from '@/utils/helpers'

function issue(code, message, context = {}) {
  return { code, message, context }
}

function isSequential(values) {
  return values.every((value, index) => value === index + 1)
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
