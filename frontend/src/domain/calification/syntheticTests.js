import { buildQuestionPlan, normalize } from '@/utils/helpers'
import { roundScore, scoreAnswerSheet } from './scoreAnswerSheet'
import { calculatePjResults } from './calculatePjResults'

const NEXT_OPTION_MAP = {
  A: 'B',
  B: 'C',
  C: 'D',
  D: 'E',
  E: 'A',
}

function buildAllIncorrectAnswers(correctAnswers) {
  return Array.from(String(correctAnswers || '').toUpperCase())
    .map((ch) => NEXT_OPTION_MAP[ch] || 'B')
    .join('')
}

/**
 * Ejecuta la batería obligatoria de 5 pruebas sintéticas pre-calificación del protocolo Poder Judicial.
 */
export function runPreCalificationSyntheticSuite({
  answerKeyRows = [],
  plantilla = null,
  correctValue = 1,
  incorrectValue = 0,
  blankValue = 0,
  answersLength = 30,
  questionExceptions = [],
  sampleExamCode = '',
  executedAt = new Date().toISOString(),
} = {}) {
  const effectivePlantilla =
    plantilla && Array.isArray(plantilla.items) && plantilla.items.length > 0
      ? plantilla
      : {
          id: 'pj-synthetic-tpl',
          name: 'Poder Judicial — 30 Preguntas',
          items: [{ subject: 'Conocimientos', questionCount: answersLength, ponderation: 1 }],
        }

  const plan = buildQuestionPlan(effectivePlantilla.items)
  const totalWeight = plan.reduce((acc, item) => acc + (Number(item.weight) || 0), 0)

  const normalizedSample = normalize(sampleExamCode)
  const selectedKeyRow =
    (normalizedSample &&
      answerKeyRows.find(
        (k) =>
          normalize(k?.cod_examen || k?.codExamen || k?.area || k?.tipo || '') === normalizedSample,
      )) ||
    answerKeyRows.find((k) => String(k?.answers || '').trim().length > 0) || {
      cod_examen: sampleExamCode || 'E01a',
      answers: 'A'.repeat(answersLength),
    }

  const examCodeTested =
    String(
      selectedKeyRow?.cod_examen ||
        selectedKeyRow?.codExamen ||
        selectedKeyRow?.area ||
        sampleExamCode ||
        'E01a',
    ).trim() || 'E01a'

  const rawKey = String(selectedKeyRow?.answers || '')
    .toUpperCase()
    .replace(/[^A-E]/g, 'A')
    .padEnd(answersLength, 'A')
    .slice(0, answersLength)

  const cases = []

  // Caso 1: ALL_CORRECT
  const allCorrectRes = scoreAnswerSheet({
    answersRaw: rawKey,
    correctAnswersRaw: rawKey,
    plan,
    correctValue,
    incorrectValue,
    blankValue,
    questionExceptions: [],
  })
  const expectedAllCorrectScore = roundScore(totalWeight * correctValue)
  const case1Passed =
    Math.abs(allCorrectRes.score - expectedAllCorrectScore) <= 0.001 &&
    allCorrectRes.correctCount === answersLength &&
    allCorrectRes.incorrectCount === 0
  cases.push({
    code: 'ALL_CORRECT',
    name: '1. Ficha Sintética — Todas las Respuestas Correctas',
    description: `Hoja idéntica a la clave oficial de ${examCodeTested} (${answersLength}/${answersLength} aciertos).`,
    expectedScore: expectedAllCorrectScore,
    obtainedScore: allCorrectRes.score,
    passed: case1Passed,
    details: `Aciertos: ${allCorrectRes.correctCount}/${answersLength} | Puntaje: ${allCorrectRes.score.toFixed(3)} / ${expectedAllCorrectScore.toFixed(3)}`,
  })

  // Caso 2: ALL_INCORRECT
  const allIncorrectAnswers = buildAllIncorrectAnswers(rawKey)
  const allIncorrectRes = scoreAnswerSheet({
    answersRaw: allIncorrectAnswers,
    correctAnswersRaw: rawKey,
    plan,
    correctValue,
    incorrectValue,
    blankValue,
    questionExceptions: [],
  })
  const expectedAllIncorrectScore = roundScore(totalWeight * incorrectValue)
  const case2Passed =
    Math.abs(allIncorrectRes.score - expectedAllIncorrectScore) <= 0.001 &&
    allIncorrectRes.correctCount === 0 &&
    allIncorrectRes.incorrectCount === answersLength
  cases.push({
    code: 'ALL_INCORRECT',
    name: '2. Ficha Sintética — Todas las Respuestas Incorrectas',
    description: `Hoja con desplazamiento cíclico A→B→C→D→E→A respecto a la clave de ${examCodeTested} (0/${answersLength} aciertos).`,
    expectedScore: expectedAllIncorrectScore,
    obtainedScore: allIncorrectRes.score,
    passed: case2Passed,
    details: `Errores: ${allIncorrectRes.incorrectCount}/${answersLength} | Puntaje: ${allIncorrectRes.score.toFixed(3)}`,
  })

  // Caso 3: ALL_BLANK
  const allBlankAnswers = ' '.repeat(answersLength)
  const allBlankRes = scoreAnswerSheet({
    answersRaw: allBlankAnswers,
    correctAnswersRaw: rawKey,
    plan,
    correctValue,
    incorrectValue,
    blankValue,
    questionExceptions: [],
  })
  const expectedAllBlankScore = roundScore(totalWeight * blankValue)
  const case3Passed =
    Math.abs(allBlankRes.score - expectedAllBlankScore) <= 0.001 &&
    allBlankRes.blankCount === answersLength &&
    allBlankRes.correctCount === 0
  cases.push({
    code: 'ALL_BLANK',
    name: '3. Ficha Sintética — Todas las Respuestas en Blanco',
    description: `Hoja con ${answersLength} posiciones en blanco sin marcas ópticas.`,
    expectedScore: expectedAllBlankScore,
    obtainedScore: allBlankRes.score,
    passed: case3Passed,
    details: `Blancos: ${allBlankRes.blankCount}/${answersLength} | Puntaje: ${allBlankRes.score.toFixed(3)}`,
  })

  // Caso 4: WITH_EXCEPTIONS
  const configuredExamExceptions = (questionExceptions || []).filter((exc) => {
    const c = String(exc?.codExamen ?? exc?.area ?? '').trim()
    return !c || c === '*' || c.toUpperCase() === 'TODOS' || normalize(c) === normalize(examCodeTested)
  })
  const syntheticExceptions =
    configuredExamExceptions.length > 0
      ? configuredExamExceptions
      : [
          {
            codExamen: examCodeTested,
            questionNumber: 1,
            type: 'ANULADA_OTORGAR',
            reason: 'Simulación de pregunta anulada con puntaje otorgado',
          },
          {
            codExamen: examCodeTested,
            questionNumber: 2,
            type: 'CLAVE_MULTIPLE',
            validAnswers: 'BD',
            reason: 'Simulación de fe de erratas con doble clave B y D',
          },
        ]

  const syntheticAnswerChars = Array.from(' '.repeat(answersLength))
  let expectedExceptionScore = 0
  for (let i = 0; i < answersLength; i += 1) {
    const qNum = i + 1
    const w = Number(plan[i]?.weight) || 0
    const exc = syntheticExceptions.find((e) => Number(e.questionNumber) === qNum)
    const type = exc?.type ? String(exc.type).trim().toUpperCase() : ''
    if (type === 'ANULADA_OTORGAR') {
      expectedExceptionScore += correctValue * w
    } else if (type === 'ANULADA_EXCLUIR') {
      expectedExceptionScore += 0
    } else if (type === 'CLAVE_MULTIPLE') {
      const validChars = String(exc.validAnswers || rawKey[i])
        .toUpperCase()
        .replace(/[^A-E]/g, '')
      const chosen = validChars[validChars.length - 1] || rawKey[i]
      syntheticAnswerChars[i] = chosen
      expectedExceptionScore += correctValue * w
    } else {
      expectedExceptionScore += blankValue * w
    }
  }
  expectedExceptionScore = roundScore(expectedExceptionScore)

  const withExcRes = scoreAnswerSheet({
    answersRaw: syntheticAnswerChars.join(''),
    correctAnswersRaw: rawKey,
    plan,
    correctValue,
    incorrectValue,
    blankValue,
    questionExceptions: syntheticExceptions,
  })
  const case4Passed = Math.abs(withExcRes.score - expectedExceptionScore) <= 0.001
  cases.push({
    code: 'WITH_EXCEPTIONS',
    name: '4. Ficha Sintética — Examen con Excepciones de Pregunta',
    description:
      configuredExamExceptions.length > 0
        ? `Verifica las ${configuredExamExceptions.length} excepción(es) configuradas para ${examCodeTested}.`
        : `Verifica aplicación de pregunta anulada (otorgar puntaje) y clave múltiple sobre ${examCodeTested}.`,
    expectedScore: expectedExceptionScore,
    obtainedScore: withExcRes.score,
    passed: case4Passed,
    details: `Excepciones probadas: ${syntheticExceptions.length} | Puntaje obtenido: ${withExcRes.score.toFixed(3)} / Esperado: ${expectedExceptionScore.toFixed(3)}`,
  })

  // Caso 5: CANDIDATE_ANNULMENT
  const annulledRun = calculatePjResults({
    area: 'PRUEBA SINTÉTICA PJ',
    plantilla: effectivePlantilla,
    correctValue,
    incorrectValue,
    blankValue,
    answersLength,
    archiveRows: [
      {
        dni: '99999999',
        paterno: 'SINTETICO',
        materno: 'ANULADO',
        nombres: 'POSTULANTE PRUEBA',
        cod_examen: examCodeTested,
        cod_puesto: 'P-TEST',
        puesto: 'PUESTO SINTETICO',
      },
      {
        dni: '88888888',
        paterno: 'SINTETICO',
        materno: 'ACTIVO',
        nombres: 'POSTULANTE CONTROL',
        cod_examen: examCodeTested,
        cod_puesto: 'P-TEST',
        puesto: 'PUESTO SINTETICO',
      },
    ],
    responsesRows: [
      { dni: '99999999', tipo: 'R', answers: rawKey },
      { dni: '88888888', tipo: 'R', answers: rawKey },
    ],
    answerKeyRows: [{ cod_examen: examCodeTested, area: examCodeTested, answers: rawKey }],
    candidateExceptions: [
      {
        dni: '99999999',
        reason: 'Incidencia de prueba de protocolo',
        documentRef: 'Acta Sintética N.° 00-TEST',
      },
    ],
  })

  const annulledInResults = annulledRun.results.some((r) => r.dni === '99999999')
  const annulledInComision =
    Array.isArray(annulledRun.summary?.anuladosComision) &&
    annulledRun.summary.anuladosComision.some(
      (r) => r.dni === '99999999' && r.motivo === 'Participación anulada por comisión',
    )
  const controlInResults = annulledRun.results.some((r) => r.dni === '88888888')
  const case5Passed = !annulledInResults && annulledInComision && controlInResults

  cases.push({
    code: 'CANDIDATE_ANNULMENT',
    name: '5. Prueba de Anulación de Participación de Postulante',
    description:
      'Verifica que un DNI anulado por comisión quede excluido del cuadro de méritos y pase al registro auditado.',
    expectedScore: null,
    obtainedScore: null,
    passed: case5Passed,
    details: case5Passed
      ? 'DNI 99999999 excluido del ranking y registrado en Anulados por Comisión con acta de sustento.'
      : 'Error en aislamiento de postulante anulado.',
  })

  return {
    passedAll: cases.every((c) => c.passed),
    executedAt,
    examCodeTested,
    cases,
  }
}
