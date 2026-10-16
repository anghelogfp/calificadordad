import {
  normalizeArea,
  normalizeAreaStrict,
  stripDigits,
  buildAreaTipoKey,
  buildQuestionPlan,
} from '@/utils/helpers'
import {
  buildDniCounts,
  getCandidateDniIssue,
  getExactAnswerKey,
  REAL_TEST_TYPES,
  GENERAL_SIMULACRO_AREA,
} from '@/utils/calificationHelpers'
import { scoreAnswerSheet } from './scoreAnswerSheet'
import { calculatePjResults } from './calculatePjResults'

export { calculatePjResults }

function compareByScoreAndName(a, b) {
  const scoreDiff = Number(b.score || 0) - Number(a.score || 0)
  if (scoreDiff !== 0) return scoreDiff

  const nameA = [a.paterno, a.materno, a.nombres].map(value => String(value || '').trim()).join(' ')
  const nameB = [b.paterno, b.materno, b.nombres].map(value => String(value || '').trim()).join(' ')
  const nameDiff = nameA.localeCompare(nameB, 'es', { sensitivity: 'base' })
  if (nameDiff !== 0) return nameDiff

  return String(a.dni || '').localeCompare(String(b.dni || ''))
}

export function calculateAreaResults(params) {
  if (params?.processType === 'poder_judicial') {
    return calculatePjResults(params)
  }

  const {
    area,
    plantilla,
    correctValue,
    incorrectValue,
    blankValue,
    processType,
    simulacroScope,
    answersLength,
    archiveRows,
    responsesRows,
    answerKeyRows,
    responsesByDni,
    answerKeyLookupByAreaTipo,
    answerKeyFallbackByArea,
    areaList,
    vacantesPrograma = {},
    questionExceptions = [],
    timestamp = new Date().toISOString(),
  } = params

  const isRealProcess = processType === 'real'
  const generalSimulacro = !isRealProcess && simulacroScope === 'general'
  const calculationArea = generalSimulacro ? GENERAL_SIMULACRO_AREA : normalizeArea(area, areaList)
  const plan = buildQuestionPlan(plantilla.items)

  if (plan.length !== answersLength) {
    throw new Error(`La plantilla "${plantilla.name}" cubre ${plan.length} preguntas. Deben sumar ${answersLength}.`)
  }

  const totalWeight = plan.reduce((acc, item) => acc + (Number(item.weight) || 0), 0)

  const areaAnswerKeys = answerKeyRows.filter(
    k => k.area?.trim() && normalizeAreaStrict(k.area, areaList) === calculationArea
  )
  const keyTypeCounts = new Map()
  areaAnswerKeys.forEach((key) => {
    const tipo = (key.tipo || '').trim().toUpperCase().slice(0, 1) || 'sin tipo'
    keyTypeCounts.set(tipo, (keyTypeCounts.get(tipo) || 0) + 1)
  })
  const duplicatedKeyTypes = [...keyTypeCounts.entries()]
    .filter(([, count]) => count > 1)
    .map(([tipo]) => tipo)

  if (generalSimulacro) {
    const generalAnswerKeys = answerKeyRows.filter(k => !k.area?.trim())
    if (generalAnswerKeys.length !== 1) {
      throw new Error('El simulacro general requiere exactamente una clave general sin área asignada.')
    }
  } else if (duplicatedKeyTypes.length > 0) {
    throw new Error(`Hay claves duplicadas para ${calculationArea}: ${duplicatedKeyTypes.join(', ')}.`)
  }

  let candidates = generalSimulacro
    ? archiveRows
    : archiveRows.filter((row) => normalizeAreaStrict(row.area, areaList) === calculationArea)

  if (isRealProcess) {
    const keyTypes = new Set(areaAnswerKeys.map(k => (k.tipo || '').trim().toUpperCase().slice(0, 1)).filter(Boolean))
    const missingRealKeyTypes = REAL_TEST_TYPES.filter(tipo => !keyTypes.has(tipo))
    if (missingRealKeyTypes.length > 0) {
      throw new Error(`Faltan claves para ${calculationArea}: ${missingRealKeyTypes.join(', ')}.`)
    }
  }

  if (!isRealProcess && !generalSimulacro && candidates.length === 0) {
    const unassigned = archiveRows.filter(r => !r.area?.trim())
    if (unassigned.length > 0) candidates = unassigned
  }

  if (!candidates.length) {
    throw new Error('No hay postulantes registrados para el área seleccionada.')
  }

  const processedResults = []
  const noCalificados = []
  const dniCounts = buildDniCounts(archiveRows)
  let missingResponses = 0
  let missingKeys = 0
  let duplicateResponses = 0
  let invalidCandidates = 0
  let missingPrograms = 0
  let invalidResponseTypes = 0

  candidates.forEach((candidate) => {
    const dni = stripDigits(candidate.dni)

    const baseNoCalificado = {
      dni,
      paterno: candidate.paterno || '',
      materno: candidate.materno || '',
      nombres: candidate.nombres || '',
      area: calculationArea,
      programa: candidate.programa || '',
    }

    const dniIssue = getCandidateDniIssue(candidate, dniCounts)
    if (dniIssue) {
      invalidCandidates += 1
      noCalificados.push({
        ...baseNoCalificado,
        motivo: dniIssue,
        detalle: 'Corrige el DNI en el padrón para poder vincular y calificar al postulante.',
      })
      return
    }

    if (isRealProcess && !candidate.programa?.trim()) {
      missingPrograms += 1
      noCalificados.push({
        ...baseNoCalificado,
        motivo: 'Sin programa de estudios',
        detalle: 'En convocatoria real se requiere programa para el ranking por carrera.',
      })
      return
    }

    const responseList = responsesByDni.get(dni) || []

    if (!responseList.length) {
      missingResponses += 1
      noCalificados.push({
        ...baseNoCalificado,
        motivo: 'Sin respuesta .dat',
        detalle: 'No se encontró una hoja de respuestas vinculada al DNI.',
      })
      return
    }

    if (responseList.length > 1) {
      duplicateResponses += 1
      noCalificados.push({
        ...baseNoCalificado,
        motivo: 'Respuesta duplicada',
        detalle: `Se encontraron ${responseList.length} hojas de respuestas para el mismo DNI.`,
      })
      return
    }

    const matchForArea = responseList
      .map((row) => {
        const tipo = (row.tipo || '').trim().toUpperCase().slice(0, 1)
        if (isRealProcess && !REAL_TEST_TYPES.includes(tipo)) {
          return {
            row,
            answer: null,
            invalidTipo: tipo || 'vacío',
          }
        }
        const key = buildAreaTipoKey(calculationArea, tipo, areaList)
        const legacyKey = area && tipo ? `${area}|${tipo}` : ''
        const lookupAnswer = key
          ? (answerKeyLookupByAreaTipo?.get(key) || answerKeyLookupByAreaTipo?.get(legacyKey))
          : undefined
        const areaOnlyAnswer = answerKeyFallbackByArea?.get(calculationArea)
        const exactAnswer = isRealProcess
          ? getExactAnswerKey(answerKeyRows, calculationArea, tipo, areaList)
          : generalSimulacro
            ? answerKeyRows.find(k => !k.area?.trim())
            : areaOnlyAnswer ?? lookupAnswer
        const answer = isRealProcess
          ? exactAnswer
          : generalSimulacro
            ? exactAnswer
            : exactAnswer
        return { row, answer, invalidTipo: '' }
      })
      .find((item) => item.answer || item.invalidTipo)

    if (matchForArea?.invalidTipo) {
      invalidResponseTypes += 1
      noCalificados.push({
        ...baseNoCalificado,
        motivo: 'Tipo de prueba inválido',
        detalle: `En convocatoria real la respuesta tiene tipo ${matchForArea.invalidTipo}; debe ser P, Q, R, S o T.`,
      })
      return
    }

    if (!matchForArea || !matchForArea.answer) {
      missingKeys += 1
      noCalificados.push({
        ...baseNoCalificado,
        motivo: 'Sin clave',
        detalle: 'No se pudo asociar la respuesta con una clave válida para el área.',
      })
      return
    }

    const { row: responseRow, answer: answerRow } = matchForArea
    const sheetResult = scoreAnswerSheet({
      answersRaw: responseRow?.answers || '',
      correctAnswersRaw: answerRow?.answers || '',
      plan,
      correctValue,
      incorrectValue,
      blankValue,
      questionExceptions,
    })

    processedResults.push({
      id: `${stripDigits(candidate.dni)}-${calculationArea}`,
      dni: stripDigits(candidate.dni),
      paterno: candidate.paterno || '',
      materno: candidate.materno || '',
      nombres: candidate.nombres || '',
      area: calculationArea,
      programa: candidate.programa || '',
      score: sheetResult.score,
      position: 0,
      positionInPrograma: 0,
      isIngresante: false,
      questionDetails: sheetResult.questionDetails,
      subjectBreakdown: sheetResult.subjectBreakdown,
      answersRaw: sheetResult.answersNormalized,
      correctAnswersRaw: sheetResult.correctAnswersNormalized,
      aula: responseRow.aula || '',
      tipo: responseRow.tipo || '',
      litho: responseRow.litho || '',
      corId: responseRow.examCode || '',
    })
  })

  if (isRealProcess) {
    const byPrograma = new Map()
    processedResults.forEach((r) => {
      const prog = r.programa || ''
      if (!byPrograma.has(prog)) byPrograma.set(prog, [])
      byPrograma.get(prog).push(r)
    })

    byPrograma.forEach((rows, prog) => {
      rows.sort(compareByScoreAndName)
      const cupo = vacantesPrograma?.[prog] ?? 0
      rows.forEach((r, i) => {
        r.positionInPrograma = i + 1
        r.isIngresante = cupo > 0 && r.positionInPrograma <= cupo
      })
    })
  }

  processedResults.sort(compareByScoreAndName)
  processedResults.forEach((r, i) => { r.position = i + 1 })

  const unlinkedResponses = responsesRows.filter(
    (r) => !r.dni || r.dni.trim() === ''
  ).length

  const plantillaSnapshot = (plantilla.items || []).map(i => ({
    subject: i.subject,
    questionCount: i.questionCount,
    ponderation: i.ponderation,
  }))

  return {
    results: processedResults,
    summary: {
      area: calculationArea,
      timestamp,
      totalCandidates: candidates.length,
      missingResponses,
      missingKeys,
      duplicateResponses,
      invalidCandidates,
      missingPrograms,
      invalidResponseTypes,
      unlinkedResponses,
      noCalificados,
      totalWeight: Number(totalWeight.toFixed(3)),
      answersLength,
      correctValue,
      incorrectValue,
      blankValue,
      plantillaId: plantilla.id,
      plantillaName: plantilla.name,
      plantillaSnapshot,
    },
  }
}
