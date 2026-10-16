import {
  buildQuestionPlan,
  normalize,
  stripDigits,
} from '@/utils/helpers'
import {
  buildDniCounts,
  getCandidateDniIssue,
} from '@/utils/calificationHelpers'
import { roundScore, scoreAnswerSheet } from './scoreAnswerSheet'

function compareAlphabetical(a, b) {
  const nameA = [a.paterno, a.materno, a.nombres].map((v) => String(v || '').trim()).join(' ')
  const nameB = [b.paterno, b.materno, b.nombres].map((v) => String(v || '').trim()).join(' ')
  const nameDiff = nameA.localeCompare(nameB, 'es', { sensitivity: 'base' })
  if (nameDiff !== 0) return nameDiff
  return String(a.dni || '').localeCompare(String(b.dni || ''))
}

function buildComparator(tieBreakerMode = 'shared_rank') {
  return (a, b) => {
    const scoreDiff = Number(b.score || 0) - Number(a.score || 0)
    if (Math.abs(scoreDiff) > 1e-9) return scoreDiff

    if (tieBreakerMode === 'fewer_incorrect') {
      const correctDiff = Number(b.correctCount || 0) - Number(a.correctCount || 0)
      if (correctDiff !== 0) return correctDiff
      const incorrectDiff = Number(a.incorrectCount || 0) - Number(b.incorrectCount || 0)
      if (incorrectDiff !== 0) return incorrectDiff
    }

    return compareAlphabetical(a, b)
  }
}

function parseObservacionesGrupoAula(observaciones) {
  const raw = String(observaciones || '').trim()
  if (!raw) return { grupo: '', aulaPadron: '' }
  const match = raw.match(/grupo\s*(\d+)\s*-\s*aula\s*([A-Za-z0-9]+)/i)
  if (!match) return { grupo: '', aulaPadron: '' }
  return {
    grupo: `Grupo ${match[1]}`,
    aulaPadron: match[2].toUpperCase(),
  }
}

function buildResponsesByDniMap(responsesRows = [], existingMap = null) {
  if (existingMap instanceof Map && existingMap.size > 0) {
    return existingMap
  }
  const map = new Map()
  ;(responsesRows || []).forEach((row) => {
    const dni = stripDigits(row?.dni)
    if (!dni) return
    if (!map.has(dni)) map.set(dni, [])
    map.get(dni).push(row)
  })
  return map
}

export function calculatePjResults({
  area = 'PODER JUDICIAL',
  plantilla,
  correctValue = 1,
  incorrectValue = 0,
  blankValue = 0,
  answersLength = 30,
  archiveRows = [],
  responsesRows = [],
  answerKeyRows = [],
  responsesByDni = null,
  questionExceptions = [],
  candidateExceptions = [],
  vacantesPuesto = {},
  vacantesPrograma = {},
  scoringOptions = {},
  codExamenFilter = '',
  timestamp = new Date().toISOString(),
} = {}) {
  const effectivePlantilla = plantilla || {
    id: 'pj-default-30',
    name: 'Poder Judicial — 30 Preguntas',
    items: [{ subject: 'Conocimientos', questionCount: answersLength, ponderation: 1 }],
  }

  const plan = buildQuestionPlan(effectivePlantilla.items || [])
  if (plan.length !== answersLength) {
    throw new Error(
      `La plantilla "${effectivePlantilla.name}" cubre ${plan.length} preguntas. Deben sumar ${answersLength}.`,
    )
  }

  const totalWeight = plan.reduce((acc, item) => acc + (Number(item.weight) || 0), 0)
  const effectiveResponsesByDni = buildResponsesByDniMap(responsesRows, responsesByDni)
  const effectiveVacantes = { ...vacantesPrograma, ...vacantesPuesto }

  const useMinPassingScore = Boolean(scoringOptions?.useMinPassingScore)
  const minPassingScore = Number(scoringOptions?.minPassingScore ?? 0)
  const requireQuotaForIngreso =
    scoringOptions?.requireQuotaForIngreso !== undefined
      ? Boolean(scoringOptions.requireQuotaForIngreso)
      : true
  const tieBreakerMode = scoringOptions?.tieBreakerMode || 'shared_rank'

  const answerKeyByExamCode = new Map()
  ;(answerKeyRows || []).forEach((keyRow) => {
    const code = String(keyRow?.cod_examen || keyRow?.codExamen || keyRow?.area || keyRow?.tipo || '').trim()
    if (!code) return
    const normCode = normalize(code)
    if (!answerKeyByExamCode.has(normCode)) {
      answerKeyByExamCode.set(normCode, keyRow)
    }
  })

  const candidateExceptionsByDni = new Map()
  ;(candidateExceptions || []).forEach((exc) => {
    const dni = stripDigits(exc?.dni)
    if (dni) {
      candidateExceptionsByDni.set(dni, exc)
    }
  })

  const normalizedFilter = normalize(codExamenFilter)
  const candidates = normalizedFilter
    ? archiveRows.filter(
      (row) => normalize(row.cod_examen || row.codExamen || row.area || '') === normalizedFilter,
    )
    : archiveRows

  if (!candidates.length) {
    throw new Error('No hay postulantes registrados para calificar.')
  }

  const processedResults = []
  const noCalificados = []
  const anuladosComision = []
  const dniCounts = buildDniCounts(archiveRows)

  let missingResponses = 0
  let missingKeys = 0
  let duplicateResponses = 0
  let invalidCandidates = 0
  let missingExamCode = 0
  let annulledCandidatesCount = 0

  candidates.forEach((candidate) => {
    const dni = stripDigits(candidate.dni)
    const codExamen = String(candidate.cod_examen || candidate.codExamen || candidate.area || '').trim()
    const codPuesto = String(
      candidate.cod_puesto || candidate.codPuesto || candidate.codigo_programa || '',
    ).trim()
    const puesto = String(candidate.puesto || candidate.programa || '').trim()
    const unidad = String(candidate.unidad || '').trim()
    const parsedObs = parseObservacionesGrupoAula(candidate.observaciones)
    const grupo = String(candidate.grupo || parsedObs.grupo || '').trim()
    const aulaPadron = String(
      candidate.aula_padron || candidate.aulaPadron || parsedObs.aulaPadron || '',
    ).trim()
    const programaLabel = puesto || codPuesto || codExamen || ''

    const baseNoCalificado = {
      dni,
      paterno: candidate.paterno || '',
      materno: candidate.materno || '',
      nombres: candidate.nombres || '',
      area: codExamen || area,
      codExamen,
      codPuesto,
      puesto,
      programa: programaLabel,
      unidad,
      grupo,
      aula: aulaPadron,
    }

    if (dni && candidateExceptionsByDni.has(dni)) {
      const exc = candidateExceptionsByDni.get(dni)
      annulledCandidatesCount += 1
      const annulledEntry = {
        ...baseNoCalificado,
        motivo: 'Participación anulada por comisión',
        detalle: exc?.reason || 'Anulado por acuerdo de comisión',
        documento: exc?.documentRef || '',
      }
      anuladosComision.push(annulledEntry)
      noCalificados.push(annulledEntry)
      return
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

    if (!codExamen) {
      missingExamCode += 1
      noCalificados.push({
        ...baseNoCalificado,
        motivo: 'Sin código de examen',
        detalle: 'El postulante no tiene COD_EXAMEN asignado en el padrón.',
      })
      return
    }

    const responseList = effectiveResponsesByDni.get(dni) || []
    if (!responseList.length) {
      missingResponses += 1
      noCalificados.push({
        ...baseNoCalificado,
        motivo: 'Ausente / Sin respuesta .dat',
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

    const answerRow = answerKeyByExamCode.get(normalize(codExamen))
    if (!answerRow) {
      missingKeys += 1
      noCalificados.push({
        ...baseNoCalificado,
        motivo: 'Sin clave para código de examen',
        detalle: `No se encontró clave oficial para el código de examen ${codExamen}.`,
      })
      return
    }

    const applicableQuestionExceptions = (questionExceptions || []).filter((exc) => {
      const excCode = String(exc?.codExamen ?? exc?.area ?? '').trim()
      if (!excCode || excCode === '*' || excCode.toUpperCase() === 'TODOS') return true
      return normalize(excCode) === normalize(codExamen)
    })

    const responseRow = responseList[0]
    const sheetResult = scoreAnswerSheet({
      answersRaw: responseRow?.answers || '',
      correctAnswersRaw: answerRow?.answers || '',
      plan,
      correctValue,
      incorrectValue,
      blankValue,
      questionExceptions: applicableQuestionExceptions,
    })

    const effectivePuestoKey = codPuesto || puesto || codExamen
    processedResults.push({
      id: `${dni}-${effectivePuestoKey}`,
      dni,
      paterno: candidate.paterno || '',
      materno: candidate.materno || '',
      nombres: candidate.nombres || '',
      area: codExamen,
      codExamen,
      codPuesto: effectivePuestoKey,
      puesto: puesto || codPuesto || codExamen,
      programa: puesto || codPuesto || codExamen,
      unidad,
      grupo,
      aula: aulaPadron || responseRow?.aula || '',
      aulaPadron,
      aulaDat: responseRow?.aula || '',
      tipo: responseRow?.tipo || '',
      litho: responseRow?.litho || '',
      corId: responseRow?.examCode || '',
      score: sheetResult.score,
      maxPossibleScore: sheetResult.maxPossibleScore,
      correctCount: sheetResult.correctCount,
      incorrectCount: sheetResult.incorrectCount,
      blankCount: sheetResult.blankCount,
      multipleCount: sheetResult.multipleCount,
      annulledGrantedCount: sheetResult.annulledGrantedCount,
      annulledExcludedCount: sheetResult.annulledExcludedCount,
      questionDetails: sheetResult.questionDetails,
      subjectBreakdown: sheetResult.subjectBreakdown,
      answersRaw: sheetResult.answersNormalized,
      correctAnswersRaw: sheetResult.correctAnswersNormalized,
      position: 0,
      positionInPrograma: 0,
      isTied: false,
      tieCount: 1,
      tieGroupSize: 1,
      isCutoffTie: false,
      isApto: true,
      isIngresante: false,
      condicion: '',
    })
  })

  const compareRows = buildComparator(tieBreakerMode)
  const byPuesto = new Map()
  processedResults.forEach((r) => {
    const key = r.codPuesto || r.programa || r.area || ''
    if (!byPuesto.has(key)) byPuesto.set(key, [])
    byPuesto.get(key).push(r)
  })

  const tiesAtCutoff = []
  let totalTiedCandidates = 0

  byPuesto.forEach((rows, puestoKey) => {
    rows.sort(compareRows)

    const scoreCounts = new Map()
    rows.forEach((r) => {
      const sKey = Number(r.score || 0).toFixed(3)
      scoreCounts.set(sKey, (scoreCounts.get(sKey) || 0) + 1)
    })

    const sampleRow = rows[0] || {}
    const cupo = Number(
      effectiveVacantes?.[puestoKey] ??
        effectiveVacantes?.[sampleRow.codPuesto] ??
        effectiveVacantes?.[sampleRow.puesto] ??
        effectiveVacantes?.[sampleRow.programa] ??
        0,
    )

    let cutoffScoreKey = null
    if (cupo > 0 && rows.length > cupo) {
      const lastInQuotaScore = Number(rows[cupo - 1].score || 0).toFixed(3)
      const firstOutQuotaScore = Number(rows[cupo].score || 0).toFixed(3)
      if (lastInQuotaScore === firstOutQuotaScore) {
        cutoffScoreKey = lastInQuotaScore
      }
    }

    rows.forEach((r, index) => {
      const sKey = Number(r.score || 0).toFixed(3)
      const count = scoreCounts.get(sKey) || 1
      r.isTied = count > 1
      r.tieCount = count
      r.tieGroupSize = count
      if (r.isTied) {
        totalTiedCandidates += 1
      }

      if (tieBreakerMode === 'shared_rank') {
        if (index === 0) {
          r.positionInPrograma = 1
        } else {
          const prevKey = Number(rows[index - 1].score || 0).toFixed(3)
          r.positionInPrograma = prevKey === sKey ? rows[index - 1].positionInPrograma : index + 1
        }
      } else {
        r.positionInPrograma = index + 1
      }

      r.isCutoffTie = cutoffScoreKey !== null && sKey === cutoffScoreKey
      r.isApto = useMinPassingScore ? r.score >= minPassingScore : true

      if (!requireQuotaForIngreso) {
        r.isIngresante = r.isApto
      } else if (cupo > 0) {
        r.isIngresante = r.isApto && r.positionInPrograma <= cupo
      } else {
        r.isIngresante = useMinPassingScore && r.isApto
      }

      if (r.isCutoffTie && r.isApto) {
        r.condicion = 'EMPATE EN CORTE'
      } else if (r.isIngresante) {
        r.condicion = cupo > 0 && requireQuotaForIngreso ? 'GANADOR / ALCANZÓ VACANTE' : 'APROBADO'
      } else if (r.isApto && !r.isIngresante) {
        r.condicion = cupo > 0 ? 'APROBADO (SIN VACANTE)' : 'ELEGIBLE'
      } else {
        r.condicion = 'NO APROBADO'
      }
    })

    if (cutoffScoreKey !== null) {
      const tiedRows = rows.filter((r) => Number(r.score || 0).toFixed(3) === cutoffScoreKey)
      tiesAtCutoff.push({
        codPuesto: sampleRow.codPuesto || puestoKey,
        puesto: sampleRow.puesto || puestoKey,
        programa: sampleRow.programa || puestoKey,
        unidad: sampleRow.unidad || '',
        codExamen: sampleRow.codExamen || '',
        cupo,
        cutoffScore: Number(cutoffScoreKey),
        tiedCount: tiedRows.length,
        candidates: tiedRows.map((r) => ({
          dni: r.dni,
          paterno: r.paterno,
          materno: r.materno,
          nombres: r.nombres,
          score: r.score,
          positionInPrograma: r.positionInPrograma,
        })),
      })
    }
  })

  processedResults.sort(compareRows)
  processedResults.forEach((r, i) => {
    r.position = i + 1
  })

  const unlinkedResponses = (responsesRows || []).filter(
    (r) => !r?.dni || String(r.dni).trim() === '',
  ).length

  const plantillaSnapshot = (effectivePlantilla.items || []).map((i) => ({
    subject: i.subject,
    questionCount: i.questionCount,
    ponderation: i.ponderation,
  }))

  return {
    results: processedResults,
    summary: {
      area,
      processType: 'poder_judicial',
      timestamp,
      totalCandidates: candidates.length,
      calibratedCount: processedResults.length,
      missingResponses,
      missingKeys,
      duplicateResponses,
      invalidCandidates,
      missingPrograms: missingExamCode,
      missingExamCode,
      annulledCandidatesCount,
      invalidResponseTypes: 0,
      unlinkedResponses,
      noCalificados,
      anuladosComision,
      tiesAtCutoff,
      totalTiedCandidates,
      totalWeight: Number(totalWeight.toFixed(3)),
      answersLength,
      correctValue,
      incorrectValue,
      blankValue,
      scoringOptions: {
        useMinPassingScore,
        minPassingScore,
        requireQuotaForIngreso,
        tieBreakerMode,
      },
      plantillaId: effectivePlantilla.id,
      plantillaName: effectivePlantilla.name,
      plantillaSnapshot,
    },
  }
}
